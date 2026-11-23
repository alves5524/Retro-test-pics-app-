export type StepId = 'upload' | 'analyze' | 'studio';

export type MediaKind = 'image' | 'video' | 'procedural';

export interface EffectParams {
  intensity: number; // 0..1
  contrast: number; // 0..1
  halftoneScale: number; // 0..1 (0 = off)
  halftoneAngle: number; // 0..90 degrees
  grain: number; // 0..1
  paperTexture: number; // 0..1
  misregistration: number; // 0..1
  inkBleed: number; // 0..1
  useGradientMap: boolean;
}

export interface GradientMap {
  id: string;
  name: string;
  shadow: string; // Hex color for dark ink
  midtone: string; // Hex color for midtones
  highlight: string; // Hex color for paper base
}

export interface PrintPreset {
  id: string;
  name: string;
  subtitle: string;
  gradientMapId: string;
  params: EffectParams;
}

export interface MediaAnalysis {
  meanLuminance: number; // 0..1
  contrastSpread: number; // 0..1 (p95 - p5)
  saturation: number; // 0..1
  warmth: number; // -1 (cool) .. +1 (warm)
  edgeDensity: number; // 0..1
  recommendedPresetId: string;
  recommendedGradientId: string;
  optimizedParams: EffectParams;
  summaryTags: string[];
}

export type AspectRatioId = 'original' | '1:1' | '4:5' | '3:4' | '16:9' | '9:16';

export type ExportSizeId = 'original' | '1080' | '1920' | '2400';

export type FitMode = 'cover' | 'contain';

export interface MediaFormatConfig {
  aspectRatio: AspectRatioId;
  exportSize: ExportSizeId;
  fitMode: FitMode;
}

export interface MediaSourceInfo {
  id: string;
  name: string;
  kind: MediaKind;
  width: number;
  height: number;
  durationSec?: number;
  objectUrl?: string;
}
