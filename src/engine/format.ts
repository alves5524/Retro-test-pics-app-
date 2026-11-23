import type { AspectRatioId, ExportSizeId, FitMode } from '../types/studio';

export interface AspectOption {
  id: AspectRatioId;
  label: string;
  hint: string;
  ratio: number | null; // width / height, null = source natural ratio
}

export interface ExportSizeOption {
  id: ExportSizeId;
  label: string;
  hint: string;
  maxSide: number | null;
}

export const ASPECT_OPTIONS: AspectOption[] = [
  { id: 'original', label: 'Original', hint: 'Proporção nativa', ratio: null },
  { id: '1:1', label: '1:1', hint: 'Quadrado', ratio: 1 },
  { id: '4:5', label: '4:5', hint: 'Retrato / Feed', ratio: 4 / 5 },
  { id: '3:4', label: '3:4', hint: 'Cartaz', ratio: 3 / 4 },
  { id: '16:9', label: '16:9', hint: 'Widescreen', ratio: 16 / 9 },
  { id: '9:16', label: '9:16', hint: 'Vertical / Reels', ratio: 9 / 16 },
];

export const EXPORT_SIZE_OPTIONS: ExportSizeOption[] = [
  { id: 'original', label: 'Original', hint: 'Resolução nativa', maxSide: null },
  { id: '1080', label: '1080 px', hint: 'Web e redes', maxSide: 1080 },
  { id: '1920', label: '1920 px', hint: 'Full HD', maxSide: 1920 },
  { id: '2400', label: '2400 px', hint: 'Alta / Impressão', maxSide: 2400 },
];

function makeEven(n: number): number {
  const rounded = Math.max(2, Math.round(n));
  return rounded % 2 === 0 ? rounded : rounded + 1;
}

export function computeOutputDimensions(
  srcWidth: number,
  srcHeight: number,
  aspectId: AspectRatioId,
  sizeId: ExportSizeId
): { width: number; height: number } {
  const safeW = Math.max(2, srcWidth);
  const safeH = Math.max(2, srcHeight);
  const aspectOpt = ASPECT_OPTIONS.find((a) => a.id === aspectId);
  const targetRatio = aspectOpt?.ratio ?? safeW / safeH;

  const sizeOpt = EXPORT_SIZE_OPTIONS.find((s) => s.id === sizeId);
  const targetMaxSide = sizeOpt?.maxSide ?? Math.min(2400, Math.max(safeW, safeH));

  if (targetRatio >= 1) {
    const w = targetMaxSide;
    const h = w / targetRatio;
    return { width: makeEven(w), height: makeEven(h) };
  } else {
    const h = targetMaxSide;
    const w = h * targetRatio;
    return { width: makeEven(w), height: makeEven(h) };
  }
}

export function computeFitTransform(
  srcWidth: number,
  srcHeight: number,
  dstWidth: number,
  dstHeight: number,
  fitMode: FitMode
): { uvScale: [number, number]; uvOffset: [number, number] } {
  const srcAspect = Math.max(0.01, srcWidth / Math.max(1, srcHeight));
  const dstAspect = Math.max(0.01, dstWidth / Math.max(1, dstHeight));

  if (Math.abs(srcAspect - dstAspect) < 0.002) {
    return { uvScale: [1, 1], uvOffset: [0, 0] };
  }

  let scaleX = 1;
  let scaleY = 1;

  if (fitMode === 'cover') {
    if (srcAspect > dstAspect) {
      scaleX = dstAspect / srcAspect;
    } else {
      scaleY = srcAspect / dstAspect;
    }
  } else {
    // contain: expand UV range beyond [0, 1] so source fits completely inside target frame
    if (srcAspect > dstAspect) {
      scaleY = srcAspect / dstAspect;
    } else {
      scaleX = dstAspect / srcAspect;
    }
  }

  return {
    uvScale: [scaleX, scaleY],
    uvOffset: [(1 - scaleX) * 0.5, (1 - scaleY) * 0.5],
  };
}
