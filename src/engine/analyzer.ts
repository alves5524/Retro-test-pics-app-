import type { EffectParams, MediaAnalysis } from '../types/studio';
import { getPresetById } from './presets';

function clamp01(value: number): number {
  if (Number.isNaN(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

/**
 * Pure deterministic pixel-level analyzer for images and video frames.
 * Extracts luminance, contrast spread, saturation, warmth, and edge density,
 * then intelligently tunes preset, gradient map, and shader parameters.
 */
export function analyzeImagePixels(
  pixels: Uint8ClampedArray,
  width: number,
  height: number
): MediaAnalysis {
  const totalPixels = Math.max(1, Math.floor(pixels.length / 4));
  // Sample up to ~16,000 pixels evenly for sub-millisecond analysis
  const stride = Math.max(1, Math.floor(totalPixels / 16000));

  const histogram = new Uint32Array(256);
  let sampleCount = 0;
  let lumSum = 0;
  let satSum = 0;
  let warmthSum = 0;
  let edgeSum = 0;
  let edgeCount = 0;

  for (let i = 0; i < totalPixels; i += stride) {
    const idx = i * 4;
    const r = pixels[idx] / 255;
    const g = pixels[idx + 1] / 255;
    const b = pixels[idx + 2] / 255;

    const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    const maxC = Math.max(r, g, b);
    const minC = Math.min(r, g, b);
    const sat = maxC > 0 ? (maxC - minC) / maxC : 0;

    lumSum += lum;
    satSum += sat;
    warmthSum += r - b;
    sampleCount++;

    const bin = Math.min(255, Math.max(0, Math.round(lum * 255)));
    histogram[bin]++;

    // Horizontal neighbor edge gradient when available
    if (width > 2 && i + 1 < totalPixels && (i % width) < width - 1) {
      const nIdx = (i + 1) * 4;
      const nLum =
        (0.2126 * pixels[nIdx] +
          0.7152 * pixels[nIdx + 1] +
          0.0722 * pixels[nIdx + 2]) /
        255;
      edgeSum += Math.abs(lum - nLum);
      edgeCount++;
    }
  }

  const meanLuminance = clamp01(lumSum / Math.max(1, sampleCount));
  const saturation = clamp01(satSum / Math.max(1, sampleCount));
  const warmth = Math.max(-1, Math.min(1, warmthSum / Math.max(1, sampleCount)));
  const edgeDensity = clamp01((edgeSum / Math.max(1, edgeCount)) * 4.5);

  // Compute p5 and p95 luminance percentiles for contrast spread
  const p5Target = sampleCount * 0.05;
  const p95Target = sampleCount * 0.95;
  let cumulative = 0;
  let p5Bin = 0;
  let p95Bin = 255;
  let foundP5 = false;

  for (let bin = 0; bin < 256; bin++) {
    cumulative += histogram[bin];
    if (!foundP5 && cumulative >= p5Target) {
      p5Bin = bin;
      foundP5 = true;
    }
    if (cumulative >= p95Target) {
      p95Bin = bin;
      break;
    }
  }

  const contrastSpread = clamp01((p95Bin - p5Bin) / 255);

  // Intelligent preset routing based on visual character
  let recommendedPresetId = 'riso-rosa';
  if (contrastSpread > 0.65 && edgeDensity > 0.32) {
    recommendedPresetId = saturation > 0.35 ? 'reticula-cmyk' : 'estencil-vermelho';
  } else if (warmth > 0.08 && meanLuminance > 0.48) {
    recommendedPresetId = saturation > 0.32 ? 'editorial-terracota' : 'retro-70s';
  } else if (meanLuminance < 0.36) {
    recommendedPresetId = 'estencil-vermelho';
  } else if (contrastSpread < 0.36) {
    recommendedPresetId = 'riso-rosa';
  } else if (saturation < 0.14) {
    recommendedPresetId = 'fotocopia-xerox';
  } else {
    recommendedPresetId = 'retro-70s';
  }

  const basePreset = getPresetById(recommendedPresetId);

  // Intelligently adapt parameters to the specific image profile
  const contrastBoost = contrastSpread < 0.42 ? 0.12 : contrastSpread > 0.78 ? -0.1 : 0;
  const halftoneAdapt = edgeDensity > 0.45 ? -0.12 : edgeDensity < 0.18 ? 0.1 : 0;
  const grainAdapt = meanLuminance < 0.35 ? -0.1 : 0.04;

  const optimizedParams: EffectParams = {
    ...basePreset.params,
    contrast: clamp01(basePreset.params.contrast + contrastBoost),
    halftoneScale: clamp01(basePreset.params.halftoneScale + halftoneAdapt),
    grain: clamp01(basePreset.params.grain + grainAdapt),
    paperTexture: clamp01(basePreset.params.paperTexture),
    misregistration: clamp01(basePreset.params.misregistration),
    inkBleed: clamp01(basePreset.params.inkBleed),
  };

  const summaryTags: string[] = [];
  if (meanLuminance > 0.62) summaryTags.push('Luz alta');
  else if (meanLuminance < 0.36) summaryTags.push('Tom escuro');
  else summaryTags.push('Exposição equilibrada');

  if (contrastSpread > 0.65) summaryTags.push('Contraste marcado');
  else if (contrastSpread < 0.38) summaryTags.push('Contraste suave');
  else summaryTags.push('Contraste médio');

  if (warmth > 0.08) summaryTags.push('Paleta quente');
  else if (warmth < -0.08) summaryTags.push('Paleta fria');
  else summaryTags.push('Tom neutro');

  return {
    meanLuminance,
    contrastSpread,
    saturation,
    warmth,
    edgeDensity,
    recommendedPresetId,
    recommendedGradientId: basePreset.gradientMapId,
    optimizedParams,
    summaryTags,
  };
}
