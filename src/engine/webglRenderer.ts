import type { EffectParams, GradientMap } from '../types/studio';
import { hexToRgbNormalized } from './presets';

const VERTEX_SHADER_SRC = `
attribute vec2 a_position;
attribute vec2 a_texCoord;
varying vec2 v_texCoord;

void main() {
  gl_Position = vec4(a_position, 0.0, 1.0);
  v_texCoord = a_texCoord;
}
`;

const FRAGMENT_SHADER_SRC = `
precision highp float;

uniform sampler2D u_image;
uniform vec2 u_resolution;
uniform float u_time;
uniform float u_intensity;
uniform float u_contrast;
uniform float u_halftoneScale;
uniform float u_halftoneAngle;
uniform float u_grain;
uniform float u_paperTexture;
uniform float u_misregistration;
uniform float u_inkBleed;
uniform float u_useGradientMap;
uniform float u_showOriginal;

uniform vec3 u_shadowColor;
uniform vec3 u_midtoneColor;
uniform vec3 u_highlightColor;

varying vec2 v_texCoord;

float hash12(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

float valueNoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  float a = hash12(i);
  float b = hash12(i + vec2(1.0, 0.0));
  float c = hash12(i + vec2(0.0, 1.0));
  float d = hash12(i + vec2(1.0, 1.0));
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}

float luma(vec3 c) {
  return dot(c, vec3(0.2126, 0.7152, 0.0722));
}

vec3 sampleBleed(vec2 uv, vec2 px, float bleed) {
  vec3 center = texture2D(u_image, uv).rgb;
  if (bleed <= 0.01) return center;
  float r = bleed * 1.8;
  vec3 n = texture2D(u_image, clamp(uv + vec2(0.0, px.y * r), 0.001, 0.999)).rgb;
  vec3 s = texture2D(u_image, clamp(uv - vec2(0.0, px.y * r), 0.001, 0.999)).rgb;
  vec3 e = texture2D(u_image, clamp(uv + vec2(px.x * r, 0.0), 0.001, 0.999)).rgb;
  vec3 w = texture2D(u_image, clamp(uv - vec2(px.x * r, 0.0), 0.001, 0.999)).rgb;
  vec3 avg = (center * 2.0 + n + s + e + w) / 6.0;
  // Ink spreads darker regions slightly into paper
  return mix(center, min(center, avg * 1.03), bleed * 0.75);
}

float halftonePattern(vec2 fragCoord, float value, float scaleAmt, float angleDeg) {
  if (scaleAmt <= 0.01) return value;
  float minDim = max(1.0, min(u_resolution.x, u_resolution.y));
  // Cell size scales gracefully with canvas size so print look stays consistent
  float cellSize = mix(2.8, 12.0, scaleAmt) * (minDim / 760.0);
  cellSize = max(2.2, cellSize);

  float rad = radians(angleDeg);
  float c = cos(rad);
  float s = sin(rad);
  mat2 rot = mat2(c, -s, s, c);

  vec2 p = (rot * fragCoord) / cellSize;
  vec2 cell = fract(p) - 0.5;
  float dist = length(cell) * 1.4142;

  // Invert value -> ink coverage (0 = paper, 1 = full ink)
  float ink = clamp(1.0 - value, 0.0, 1.0);
  float radius = sqrt(ink) * 0.95;
  float edge = max(0.06, 0.28 - scaleAmt * 0.16);
  float dotMask = 1.0 - smoothstep(radius - edge, radius + edge, dist);

  float screenedValue = 1.0 - dotMask;
  return mix(value, screenedValue, smoothstep(0.0, 0.35, scaleAmt));
}

vec3 applyGradientMap(float t) {
  float clamped = clamp(t, 0.0, 1.0);
  if (clamped < 0.5) {
    return mix(u_shadowColor, u_midtoneColor, clamped * 2.0);
  }
  return mix(u_midtoneColor, u_highlightColor, (clamped - 0.5) * 2.0);
}

void main() {
  vec2 uv = v_texCoord;
  vec4 rawSample = texture2D(u_image, uv);

  if (u_showOriginal > 0.5) {
    gl_FragColor = vec4(rawSample.rgb, 1.0);
    return;
  }

  vec2 px = 1.0 / max(vec2(1.0), u_resolution);

  // 1. Chromatic / CMYK Plate Misregistration
  float shiftPx = u_misregistration * 7.5 * (min(u_resolution.x, u_resolution.y) / 760.0);
  vec2 offsetR = vec2(shiftPx * px.x, -shiftPx * 0.55 * px.y);
  vec2 offsetB = vec2(-shiftPx * 0.75 * px.x, shiftPx * 0.7 * px.y);

  vec3 baseCenter = sampleBleed(uv, px, u_inkBleed);
  float rChan = sampleBleed(clamp(uv + offsetR, 0.001, 0.999), px, u_inkBleed).r;
  float gChan = baseCenter.g;
  float bChan = sampleBleed(clamp(uv + offsetB, 0.001, 0.999), px, u_inkBleed).b;
  vec3 misregColor = vec3(rChan, gChan, bChan);

  // 2. Contrast & Ink Punch
  float lum = luma(misregColor);
  float cPower = mix(0.85, 2.8, u_contrast);
  float contrastedLum = clamp((lum - 0.5) * cPower + 0.5, 0.0, 1.0);
  contrastedLum = smoothstep(0.02, 0.98, contrastedLum);

  // 3. Organic Toner Grit & Stipple Grain
  vec2 grainCoord = gl_FragCoord.xy * 0.85 + vec2(u_time * 13.7, u_time * 7.3);
  float fineNoise = hash12(grainCoord) - 0.5;
  float coarseNoise = valueNoise(gl_FragCoord.xy * 0.24 + vec2(u_time * 3.1, 0.0)) - 0.5;
  float combinedGrain = fineNoise * 0.65 + coarseNoise * 0.35;

  // Concentrate grit in shadows/midtones like photocopy toner or spray stencil
  float tonerWeight = mix(0.55, 1.25, 1.0 - contrastedLum);
  float grainedLum = clamp(contrastedLum + combinedGrain * u_grain * 0.42 * tonerWeight, 0.0, 1.0);

  // 4. Halftone Screen Dots
  float screened = halftonePattern(gl_FragCoord.xy, grainedLum, u_halftoneScale, u_halftoneAngle);

  // 5. Gradient Map or Vintage Multi-Ink Color
  vec3 printedColor;
  if (u_useGradientMap > 0.5) {
    printedColor = applyGradientMap(screened);
  } else {
    // Vintage faded ink preservation tinted by highlight paper
    vec3 saturated = mix(vec3(lum), misregColor, 1.15);
    vec3 contrastRgb = clamp((saturated - 0.5) * mix(0.95, 1.85, u_contrast) + 0.5, 0.0, 1.0);
    vec3 dotMod = mix(contrastRgb, vec3(screened), u_halftoneScale * 0.55);
    printedColor = dotMod * mix(vec3(1.0), u_highlightColor * 1.08, 0.45);
    printedColor += combinedGrain * u_grain * 0.14;
  }

  // 6. Paper Fibers & Subtle Organic Poster Creases
  if (u_paperTexture > 0.01) {
    float fiberH = valueNoise(vec2(gl_FragCoord.x * 0.08, gl_FragCoord.y * 0.48));
    float fiberV = valueNoise(vec2(gl_FragCoord.x * 0.46, gl_FragCoord.y * 0.07));
    float tooth = valueNoise(gl_FragCoord.xy * 0.16);
    float speckle = hash12(floor(gl_FragCoord.xy * 0.72));
    float paperRelief = ((fiberH + fiberV) * 0.38 + tooth * 0.24 - 0.5) * 0.18;

    // Subtle single diagonal & half-fold poster creases (only noticeable at higher paperTexture)
    float foldV = abs(uv.x - (0.5 + 0.008 * sin(uv.y * 7.0)));
    float foldH = abs(uv.y - (0.48 + 0.006 * cos(uv.x * 6.0)));
    float creaseMask = smoothstep(0.55, 0.95, u_paperTexture);
    float creaseLine = (smoothstep(0.008, 0.0, foldV) + smoothstep(0.007, 0.0, foldH)) * 0.09 * creaseMask;

    // Tiny worn ink specks on dark ink
    float wornSpeck = step(0.989 - u_paperTexture * 0.014, speckle) * 0.14;

    printedColor = clamp(
      printedColor + (paperRelief - creaseLine) * u_paperTexture + wornSpeck * u_paperTexture * u_highlightColor,
      0.0,
      1.0
    );
  }

  vec3 finalColor = mix(rawSample.rgb, printedColor, clamp(u_intensity, 0.0, 1.0));
  gl_FragColor = vec4(finalColor, 1.0);
}
`;

export class VintagePrintWebGLRenderer {
  private canvas: HTMLCanvasElement;
  private gl: WebGLRenderingContext | null = null;
  private program: WebGLProgram | null = null;
  private texture: WebGLTexture | null = null;
  private uniforms: Record<string, WebGLUniformLocation | null> = {};
  private startTime = performance.now();

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.initWebGL();
  }

  public isReady(): boolean {
    return Boolean(this.gl && this.program && this.texture);
  }

  private compileShader(type: number, src: string): WebGLShader | null {
    const gl = this.gl;
    if (!gl) return null;
    const shader = gl.createShader(type);
    if (!shader) return null;
    gl.shaderSource(shader, src);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      console.error('Shader compile error:', gl.getShaderInfoLog(shader));
      gl.deleteShader(shader);
      return null;
    }
    return shader;
  }

  private initWebGL(): void {
    const gl = this.canvas.getContext('webgl', {
      preserveDrawingBuffer: true,
      antialias: false,
      alpha: false,
      powerPreference: 'high-performance',
    });

    if (!gl) return;
    this.gl = gl;

    const vs = this.compileShader(gl.VERTEX_SHADER, VERTEX_SHADER_SRC);
    const fs = this.compileShader(gl.FRAGMENT_SHADER, FRAGMENT_SHADER_SRC);
    if (!vs || !fs) return;

    const program = gl.createProgram();
    if (!program) return;
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      console.error('Program link error:', gl.getProgramInfoLog(program));
      return;
    }

    this.program = program;
    gl.useProgram(program);

    // Fullscreen quad
    const posBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, posBuffer);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
      gl.STATIC_DRAW
    );
    const posLoc = gl.getAttribLocation(program, 'a_position');
    gl.enableVertexAttribArray(posLoc);
    gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);

    const texBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, texBuffer);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([0, 0, 1, 0, 0, 1, 0, 1, 1, 0, 1, 1]),
      gl.STATIC_DRAW
    );
    const texLoc = gl.getAttribLocation(program, 'a_texCoord');
    gl.enableVertexAttribArray(texLoc);
    gl.vertexAttribPointer(texLoc, 2, gl.FLOAT, false, 0, 0);

    // Texture setup (NPOT compatible)
    const texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 1);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    this.texture = texture;

    const uniformNames = [
      'u_image',
      'u_resolution',
      'u_time',
      'u_intensity',
      'u_contrast',
      'u_halftoneScale',
      'u_halftoneAngle',
      'u_grain',
      'u_paperTexture',
      'u_misregistration',
      'u_inkBleed',
      'u_useGradientMap',
      'u_showOriginal',
      'u_shadowColor',
      'u_midtoneColor',
      'u_highlightColor',
    ];

    for (const name of uniformNames) {
      this.uniforms[name] = gl.getUniformLocation(program, name);
    }
  }

  public uploadSource(source: TexImageSource): void {
    if (!this.gl || !this.texture) return;
    const gl = this.gl;
    gl.bindTexture(gl.TEXTURE_2D, this.texture);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 1);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
  }

  public render(
    source: TexImageSource | null,
    params: EffectParams,
    gradient: GradientMap,
    options: {
      width: number;
      height: number;
      showOriginal?: boolean;
      animateGrain?: boolean;
      uploadTexture?: boolean;
    }
  ): void {
    const gl = this.gl;
    const program = this.program;
    if (!gl || !program) return;

    const targetW = Math.max(1, Math.round(options.width));
    const targetH = Math.max(1, Math.round(options.height));

    if (this.canvas.width !== targetW || this.canvas.height !== targetH) {
      this.canvas.width = targetW;
      this.canvas.height = targetH;
    }

    gl.viewport(0, 0, targetW, targetH);
    gl.useProgram(program);

    if (source && options.uploadTexture !== false) {
      this.uploadSource(source);
    }

    const elapsed = options.animateGrain ? (performance.now() - this.startTime) * 0.001 : 0.0;

    const shadow = hexToRgbNormalized(gradient.shadow);
    const midtone = hexToRgbNormalized(gradient.midtone);
    const highlight = hexToRgbNormalized(gradient.highlight);

    gl.uniform1i(this.uniforms.u_image, 0);
    gl.uniform2f(this.uniforms.u_resolution, targetW, targetH);
    gl.uniform1f(this.uniforms.u_time, elapsed);
    gl.uniform1f(this.uniforms.u_intensity, params.intensity);
    gl.uniform1f(this.uniforms.u_contrast, params.contrast);
    gl.uniform1f(this.uniforms.u_halftoneScale, params.halftoneScale);
    gl.uniform1f(this.uniforms.u_halftoneAngle, params.halftoneAngle);
    gl.uniform1f(this.uniforms.u_grain, params.grain);
    gl.uniform1f(this.uniforms.u_paperTexture, params.paperTexture);
    gl.uniform1f(this.uniforms.u_misregistration, params.misregistration);
    gl.uniform1f(this.uniforms.u_inkBleed, params.inkBleed);
    gl.uniform1f(this.uniforms.u_useGradientMap, params.useGradientMap ? 1.0 : 0.0);
    gl.uniform1f(this.uniforms.u_showOriginal, options.showOriginal ? 1.0 : 0.0);

    gl.uniform3f(this.uniforms.u_shadowColor, shadow[0], shadow[1], shadow[2]);
    gl.uniform3f(this.uniforms.u_midtoneColor, midtone[0], midtone[1], midtone[2]);
    gl.uniform3f(this.uniforms.u_highlightColor, highlight[0], highlight[1], highlight[2]);

    gl.drawArrays(gl.TRIANGLES, 0, 6);
  }

  public dispose(): void {
    if (!this.gl) return;
    if (this.texture) this.gl.deleteTexture(this.texture);
    if (this.program) this.gl.deleteProgram(this.program);
    this.gl = null;
  }
}
