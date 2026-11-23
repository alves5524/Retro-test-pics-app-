import type { GradientMap, PrintPreset } from '../types/studio';

export const GRADIENT_MAPS: GradientMap[] = [
  {
    id: 'riso-rosa',
    name: 'Rosa & Carvão',
    shadow: '#212023',
    midtone: '#9C5579',
    highlight: '#F17EB2',
  },
  {
    id: 'estencil-vermelho',
    name: 'Vermelho & Nanquim',
    shadow: '#171719',
    midtone: '#A91B1E',
    highlight: '#EE2424',
  },
  {
    id: 'amarelo-magenta',
    name: 'Amarelo & Magenta',
    shadow: '#131315',
    midtone: '#E11D48',
    highlight: '#F6E318',
  },
  {
    id: 'oliva-creme',
    name: 'Oliva & Creme',
    shadow: '#3C4622',
    midtone: '#9EB442',
    highlight: '#EFE4C9',
  },
  {
    id: 'terracota-sepia',
    name: 'Terracota & Sépia',
    shadow: '#3B241E',
    midtone: '#C95B32',
    highlight: '#EDE4D3',
  },
  {
    id: 'cobalto-marfim',
    name: 'Cobalto & Marfim',
    shadow: '#152046',
    midtone: '#2E5BE3',
    highlight: '#F4EFE4',
  },
  {
    id: 'verde-menta',
    name: 'Verde Riso & Menta',
    shadow: '#133026',
    midtone: '#1E8C62',
    highlight: '#DCF2E4',
  },
  {
    id: 'preto-papel',
    name: 'Preto & Papel',
    shadow: '#141414',
    midtone: '#6E6C68',
    highlight: '#EAE6DC',
  },
];

export const PRINT_PRESETS: PrintPreset[] = [
  {
    id: 'riso-rosa',
    name: 'Riso Rosa',
    subtitle: 'Toner gasto sobre papel rosa vibrante',
    gradientMapId: 'riso-rosa',
    params: {
      intensity: 1,
      contrast: 0.66,
      halftoneScale: 0.22,
      halftoneAngle: 22,
      grain: 0.68,
      paperTexture: 0.56,
      misregistration: 0.14,
      inkBleed: 0.22,
      useGradientMap: true,
    },
  },
  {
    id: 'estencil-vermelho',
    name: 'Estêncil Vermelho',
    subtitle: 'Grão espesso e alto contraste gráfico',
    gradientMapId: 'estencil-vermelho',
    params: {
      intensity: 1,
      contrast: 0.78,
      halftoneScale: 0.08,
      halftoneAngle: 15,
      grain: 0.82,
      paperTexture: 0.44,
      misregistration: 0.08,
      inkBleed: 0.14,
      useGradientMap: true,
    },
  },
  {
    id: 'reticula-cmyk',
    name: 'Retícula CMYK',
    subtitle: 'Pontos de serigrafia com papel dobrado',
    gradientMapId: 'amarelo-magenta',
    params: {
      intensity: 1,
      contrast: 0.64,
      halftoneScale: 0.74,
      halftoneAngle: 38,
      grain: 0.26,
      paperTexture: 0.72,
      misregistration: 0.54,
      inkBleed: 0.18,
      useGradientMap: true,
    },
  },
  {
    id: 'retro-70s',
    name: 'Rétro 70s',
    subtitle: 'Papel envelhecido com tinta oliva suave',
    gradientMapId: 'oliva-creme',
    params: {
      intensity: 1,
      contrast: 0.52,
      halftoneScale: 0.18,
      halftoneAngle: 18,
      grain: 0.54,
      paperTexture: 0.66,
      misregistration: 0.18,
      inkBleed: 0.34,
      useGradientMap: true,
    },
  },
  {
    id: 'editorial-terracota',
    name: 'Editorial 70s',
    subtitle: 'Pontilhismo quente e atmosfera ilustrada',
    gradientMapId: 'terracota-sepia',
    params: {
      intensity: 1,
      contrast: 0.56,
      halftoneScale: 0.14,
      halftoneAngle: 30,
      grain: 0.6,
      paperTexture: 0.5,
      misregistration: 0.2,
      inkBleed: 0.26,
      useGradientMap: true,
    },
  },
  {
    id: 'fotocopia-xerox',
    name: 'Fotocópia Xerox',
    subtitle: 'Zine monocromático de alto impacto',
    gradientMapId: 'preto-papel',
    params: {
      intensity: 1,
      contrast: 0.84,
      halftoneScale: 0.32,
      halftoneAngle: 45,
      grain: 0.74,
      paperTexture: 0.46,
      misregistration: 0.06,
      inkBleed: 0.12,
      useGradientMap: true,
    },
  },
];

export function hexToRgbNormalized(hex: string): [number, number, number] {
  const cleaned = hex.trim().replace('#', '');
  if (!/^[0-9a-fA-F]{6}$/.test(cleaned)) {
    return [0.1, 0.1, 0.1];
  }
  const r = parseInt(cleaned.slice(0, 2), 16) / 255;
  const g = parseInt(cleaned.slice(2, 4), 16) / 255;
  const b = parseInt(cleaned.slice(4, 6), 16) / 255;
  return [r, g, b];
}

export function getPresetById(id: string): PrintPreset {
  return PRINT_PRESETS.find((p) => p.id === id) ?? PRINT_PRESETS[0];
}

export function getGradientMapById(id: string): GradientMap {
  return GRADIENT_MAPS.find((g) => g.id === id) ?? GRADIENT_MAPS[0];
}
