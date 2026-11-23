import test from 'node:test';
import assert from 'node:assert/strict';
import { analyzeImagePixels } from './analyzer';
import { hexToRgbNormalized, PRINT_PRESETS, GRADIENT_MAPS } from './presets';

function makeSolidPixels(
  width: number,
  height: number,
  r: number,
  g: number,
  b: number
): Uint8ClampedArray {
  const arr = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < width * height; i++) {
    arr[i * 4] = r;
    arr[i * 4 + 1] = g;
    arr[i * 4 + 2] = b;
    arr[i * 4 + 3] = 255;
  }
  return arr;
}

function makeCheckerPixels(width: number, height: number): Uint8ClampedArray {
  const arr = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      const bright = (x + y) % 2 === 0;
      arr[idx] = bright ? 245 : 15;
      arr[idx + 1] = bright ? 210 : 12;
      arr[idx + 2] = bright ? 40 : 18;
      arr[idx + 3] = 255;
    }
  }
  return arr;
}

test('hexToRgbNormalized converts 6-digit hex colors cleanly', () => {
  const [r, g, b] = hexToRgbNormalized('#FF8000');
  assert.ok(Math.abs(r - 1) < 0.001);
  assert.ok(Math.abs(g - 128 / 255) < 0.001);
  assert.equal(b, 0);
});

test('all presets reference a valid gradient map id', () => {
  const gradientIds = new Set(GRADIENT_MAPS.map((g) => g.id));
  for (const preset of PRINT_PRESETS) {
    assert.ok(gradientIds.has(preset.gradientMapId), `Missing gradient for ${preset.id}`);
  }
});

test('analyzeImagePixels handles low-contrast flat gray image and boosts contrast', () => {
  const pixels = makeSolidPixels(64, 64, 128, 128, 128);
  const result = analyzeImagePixels(pixels, 64, 64);
  assert.equal(result.recommendedPresetId, 'riso-rosa');
  assert.ok(result.contrastSpread < 0.05);
  assert.ok(result.optimizedParams.contrast >= 0.7);
  assert.ok(result.summaryTags.includes('Contraste suave'));
});

test('analyzeImagePixels detects high-contrast saturated graphic media', () => {
  const pixels = makeCheckerPixels(64, 64);
  const result = analyzeImagePixels(pixels, 64, 64);
  assert.equal(result.recommendedPresetId, 'reticula-cmyk');
  assert.ok(result.contrastSpread > 0.7);
  assert.ok(result.edgeDensity > 0.35);
  assert.ok(result.summaryTags.includes('Contraste marcado'));
});

test('analyzeImagePixels detects warm bright media and picks retro/editorial preset', () => {
  const pixels = makeSolidPixels(64, 64, 225, 175, 120);
  const result = analyzeImagePixels(pixels, 64, 64);
  assert.ok(
    result.recommendedPresetId === 'editorial-terracota' ||
      result.recommendedPresetId === 'retro-70s' ||
      result.recommendedPresetId === 'riso-rosa'
  );
  assert.ok(result.warmth > 0.1);
  assert.ok(result.summaryTags.includes('Paleta quente'));
});
