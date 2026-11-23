import { useEffect, useRef, useState } from 'react';
import {
  RotateCcw,
  Sparkles,
  Shuffle,
  Eye,
  Play,
  Pause,
  Download,
  ImageDown,
  Film,
  ArrowLeft,
} from 'lucide-react';
import type {
  EffectParams,
  GradientMap,
  MediaAnalysis,
  MediaFormatConfig,
  MediaSourceInfo,
} from '../types/studio';
import { GRADIENT_MAPS, PRINT_PRESETS } from '../engine/presets';
import {
  ASPECT_OPTIONS,
  EXPORT_SIZE_OPTIONS,
  computeFitTransform,
  computeOutputDimensions,
} from '../engine/format';
import { VintagePrintWebGLRenderer } from '../engine/webglRenderer';
import { drawProceduralMotionFrame } from '../utils/sampleMedia';

type ControlTab = 'presets' | 'gradients' | 'params' | 'format';

interface StepStudioProps {
  mediaInfo: MediaSourceInfo;
  imageElement: HTMLImageElement | HTMLCanvasElement | null;
  videoElement: HTMLVideoElement | null;
  analysis: MediaAnalysis;
  activePresetId: string;
  gradientMap: GradientMap;
  params: EffectParams;
  formatConfig: MediaFormatConfig;
  onSelectPreset: (presetId: string) => void;
  onSelectGradientMap: (map: GradientMap) => void;
  onUpdateGradientColor: (key: 'shadow' | 'midtone' | 'highlight', value: string) => void;
  onUpdateParam: <K extends keyof EffectParams>(key: K, value: EffectParams[K]) => void;
  onUpdateFormatConfig: (patch: Partial<MediaFormatConfig>) => void;
  onApplySmartAutoTune: () => void;
  onRandomizeEffect: () => void;
  onChangeMedia: () => void;
  registerPrimarySaveHandler: (fn: (() => void) | null) => void;
  onExportStateChange: (exporting: boolean) => void;
}

function formatTimecode(sec: number): string {
  const safe = Math.max(0, Math.floor(sec));
  const mins = Math.floor(safe / 60);
  const rem = safe % 60;
  return `${String(mins).padStart(2, '0')}:${String(rem).padStart(2, '0')}`;
}

function computeDisplaySize(srcW: number, srcH: number, maxDim = 1280): [number, number] {
  if (srcW <= 0 || srcH <= 0) return [800, 800];
  const scale = Math.min(1, maxDim / Math.max(srcW, srcH));
  return [Math.max(2, Math.round(srcW * scale)), Math.max(2, Math.round(srcH * scale))];
}

export function StepStudio({
  mediaInfo,
  imageElement,
  videoElement,
  analysis,
  activePresetId,
  gradientMap,
  params,
  formatConfig,
  onSelectPreset,
  onSelectGradientMap,
  onUpdateGradientColor,
  onUpdateParam,
  onUpdateFormatConfig,
  onApplySmartAutoTune,
  onRandomizeEffect,
  onChangeMedia,
  registerPrimarySaveHandler,
  onExportStateChange,
}: StepStudioProps) {
  const [activeTab, setActiveTab] = useState<ControlTab>('presets');
  const [showOriginal, setShowOriginal] = useState(false);
  const [isPlaying, setIsPlaying] = useState(mediaInfo.kind !== 'image');
  const [currentTime, setCurrentTime] = useState(0);
  const [targetFps, setTargetFps] = useState<24 | 30 | 60>(30);
  const [exportProgress, setExportProgress] = useState<number | null>(null);
  const [saveFeedback, setSaveFeedback] = useState<string | null>(null);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rendererRef = useRef<VintagePrintWebGLRenderer | null>(null);
  const proceduralCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const proceduralTimeRef = useRef<number>(0);

  // Keep latest props in refs so playback loop never restarts or tears down WebGL
  const paramsRef = useRef(params);
  paramsRef.current = params;
  const gradientRef = useRef(gradientMap);
  gradientRef.current = gradientMap;
  const showOriginalRef = useRef(showOriginal);
  showOriginalRef.current = showOriginal;
  const targetFpsRef = useRef(targetFps);
  targetFpsRef.current = targetFps;
  const isPlayingRef = useRef(isPlaying);
  isPlayingRef.current = isPlaying;

  const isVideoMode = mediaInfo.kind !== 'image';
  const durationSec = mediaInfo.durationSec ?? 6;
  const exportDims = computeOutputDimensions(
    mediaInfo.width,
    mediaInfo.height,
    formatConfig.aspectRatio,
    formatConfig.exportSize
  );
  const [renderW, renderH] = computeDisplaySize(exportDims.width, exportDims.height, 1280);
  const fitTransform = computeFitTransform(
    mediaInfo.width,
    mediaInfo.height,
    renderW,
    renderH,
    formatConfig.fitMode
  );
  const fitTransformRef = useRef(fitTransform);
  fitTransformRef.current = fitTransform;

  // Initialize WebGL renderer once when canvas mounts
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const renderer = new VintagePrintWebGLRenderer(canvas);
    rendererRef.current = renderer;

    return () => {
      renderer.dispose();
      rendererRef.current = null;
    };
  }, []);

  // Helper to render the active source frame once
  const renderCurrentFrame = (uploadTexture = true) => {
    const renderer = rendererRef.current;
    if (!renderer || !renderer.isReady()) return;

    let src: TexImageSource | null = null;
    if (mediaInfo.kind === 'image') {
      src = imageElement;
    } else if (mediaInfo.kind === 'video') {
      if (videoElement && videoElement.readyState >= 2) {
        src = videoElement;
      }
    } else if (mediaInfo.kind === 'procedural') {
      if (!proceduralCanvasRef.current) {
        const c = document.createElement('canvas');
        c.width = mediaInfo.width;
        c.height = mediaInfo.height;
        proceduralCanvasRef.current = c;
      }
      const pCanvas = proceduralCanvasRef.current;
      const pCtx = pCanvas.getContext('2d');
      if (pCtx) {
        drawProceduralMotionFrame(
          pCtx,
          pCanvas.width,
          pCanvas.height,
          proceduralTimeRef.current
        );
      }
      src = pCanvas;
    }

    if (!src) return;
    renderer.render(src, paramsRef.current, gradientRef.current, {
      width: renderW,
      height: renderH,
      showOriginal: showOriginalRef.current,
      animateGrain: isVideoMode && isPlayingRef.current,
      uploadTexture,
      uvScale: fitTransformRef.current.uvScale,
      uvOffset: fitTransformRef.current.uvOffset,
    });
  };

  // On-demand render whenever parameters, gradient map, compare toggle, format, or static image change
  useEffect(() => {
    renderCurrentFrame(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    params,
    gradientMap,
    showOriginal,
    imageElement,
    mediaInfo.id,
    renderW,
    renderH,
    formatConfig.aspectRatio,
    formatConfig.exportSize,
    formatConfig.fitMode,
  ]);

  // Low-latency video / procedural motion playback loop (only active while playing!)
  useEffect(() => {
    if (!isVideoMode || !isPlaying) return;

    let rafId = 0;
    let lastDrawMs = performance.now();
    let lastUiSyncMs = performance.now();

    if (mediaInfo.kind === 'video' && videoElement) {
      videoElement.play().catch(() => {
        setIsPlaying(false);
      });
    }

    const tick = (now: number) => {
      const frameInterval = 1000 / targetFpsRef.current;
      if (now - lastDrawMs >= frameInterval - 1) {
        const dt = Math.min(0.1, (now - lastDrawMs) / 1000);
        lastDrawMs = now;

        if (mediaInfo.kind === 'procedural') {
          proceduralTimeRef.current = (proceduralTimeRef.current + dt) % durationSec;
          renderCurrentFrame(true);
          if (now - lastUiSyncMs > 120) {
            lastUiSyncMs = now;
            setCurrentTime(proceduralTimeRef.current);
          }
        } else if (mediaInfo.kind === 'video' && videoElement) {
          if (videoElement.readyState >= 2) {
            renderCurrentFrame(true);
          }
          if (now - lastUiSyncMs > 120) {
            lastUiSyncMs = now;
            setCurrentTime(videoElement.currentTime);
          }
        }
      }
      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(rafId);
      if (mediaInfo.kind === 'video' && videoElement && !videoElement.paused) {
        videoElement.pause();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isVideoMode, isPlaying, mediaInfo.id, mediaInfo.kind, videoElement, durationSec]);

  const handleTogglePlay = () => {
    setIsPlaying((prev) => !prev);
  };

  const handleSeek = (newTime: number) => {
    const clamped = Math.max(0, Math.min(durationSec, newTime));
    setCurrentTime(clamped);
    if (mediaInfo.kind === 'procedural') {
      proceduralTimeRef.current = clamped;
      renderCurrentFrame(true);
    } else if (mediaInfo.kind === 'video' && videoElement) {
      videoElement.currentTime = clamped;
      const onSeeked = () => {
        renderCurrentFrame(true);
        videoElement.removeEventListener('seeked', onSeeked);
      };
      videoElement.addEventListener('seeked', onSeeked);
    }
  };

  const showSavedBanner = (msg: string) => {
    setSaveFeedback(msg);
    window.setTimeout(() => {
      setSaveFeedback((curr) => (curr === msg ? null : curr));
    }, 2800);
  };

  const triggerDownload = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const handleSaveStill = (format: 'image/png' | 'image/jpeg') => {
    const ext = format === 'image/png' ? 'png' : 'jpg';
    const baseName = mediaInfo.name.replace(/\.[^/.]+$/, '');
    const filename = `${baseName}-prensa.${ext}`;

    // Render at selected export dimensions using an offscreen WebGL canvas
    const expW = exportDims.width;
    const expH = exportDims.height;
    const exportCanvas = document.createElement('canvas');
    const expRenderer = new VintagePrintWebGLRenderer(exportCanvas);

    let src: TexImageSource | null = null;
    if (mediaInfo.kind === 'image') src = imageElement;
    else if (mediaInfo.kind === 'video') src = videoElement;
    else if (mediaInfo.kind === 'procedural') src = proceduralCanvasRef.current;

    if (expRenderer.isReady() && src) {
      expRenderer.render(src, paramsRef.current, gradientRef.current, {
        width: expW,
        height: expH,
        showOriginal: showOriginalRef.current,
        animateGrain: false,
        uploadTexture: true,
        uvScale: fitTransformRef.current.uvScale,
        uvOffset: fitTransformRef.current.uvOffset,
      });
      exportCanvas.toBlob(
        (blob) => {
          expRenderer.dispose();
          if (blob) {
            triggerDownload(blob, filename);
            showSavedBanner(`Salvo como ${filename}`);
          }
        },
        format,
        0.94
      );
      return;
    }

    // Fallback to main canvas
    canvasRef.current?.toBlob(
      (blob) => {
        if (blob) {
          triggerDownload(blob, filename);
          showSavedBanner(`Salvo como ${filename}`);
        }
      },
      format,
      0.94
    );
  };

  const handleExportVideo = async () => {
    const canvas = canvasRef.current;
    if (!canvas || typeof MediaRecorder === 'undefined' || !canvas.captureStream) {
      handleSaveStill('image/png');
      return;
    }

    const baseName = mediaInfo.name.replace(/\.[^/.]+$/, '');
    const filename = `${baseName}-prensa.webm`;
    const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
      ? 'video/webm;codecs=vp9'
      : 'video/webm';

    setExportProgress(0);
    onExportStateChange(true);
    setIsPlaying(false);

    const stream = canvas.captureStream(targetFps);
    const recorder = new MediaRecorder(stream, {
      mimeType,
      videoBitsPerSecond: 6_000_000,
    });
    const chunks: BlobPart[] = [];
    recorder.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) chunks.push(e.data);
    };

    const finishedPromise = new Promise<void>((resolve) => {
      recorder.onstop = () => {
        const blob = new Blob(chunks, { type: mimeType });
        triggerDownload(blob, filename);
        showSavedBanner(`Vídeo salvo (${filename})`);
        resolve();
      };
    });

    recorder.start(100);

    if (mediaInfo.kind === 'procedural') {
      const totalFrames = Math.max(12, Math.round(durationSec * targetFps));
      const stepMs = 1000 / targetFps;
      for (let i = 0; i < totalFrames; i++) {
        proceduralTimeRef.current = (i / totalFrames) * durationSec;
        renderCurrentFrame(true);
        setCurrentTime(proceduralTimeRef.current);
        setExportProgress(Math.round(((i + 1) / totalFrames) * 100));
        await new Promise((r) => setTimeout(r, stepMs));
      }
      recorder.stop();
      await finishedPromise;
    } else if (mediaInfo.kind === 'video' && videoElement) {
      const wasLoop = videoElement.loop;
      videoElement.loop = false;
      videoElement.currentTime = 0;

      await new Promise<void>((resolve) => {
        const onSeeked = () => {
          videoElement.removeEventListener('seeked', onSeeked);
          resolve();
        };
        videoElement.addEventListener('seeked', onSeeked);
      });

      await new Promise<void>((resolve) => {
        let raf = 0;
        const step = () => {
          if (videoElement.readyState >= 2) {
            renderCurrentFrame(true);
          }
          const pct = durationSec > 0 ? Math.min(99, Math.round((videoElement.currentTime / durationSec) * 100)) : 50;
          setExportProgress(pct);
          setCurrentTime(videoElement.currentTime);
          if (videoElement.ended) {
            cancelAnimationFrame(raf);
            resolve();
            return;
          }
          raf = requestAnimationFrame(step);
        };
        videoElement.play().then(() => {
          raf = requestAnimationFrame(step);
        }).catch(() => resolve());
      });

      videoElement.loop = wasLoop;
      setExportProgress(100);
      recorder.stop();
      await finishedPromise;
    }

    setExportProgress(null);
    onExportStateChange(false);
    setIsPlaying(true);
  };

  // Register primary TopBar save action
  useEffect(() => {
    registerPrimarySaveHandler(() => {
      if (isVideoMode) {
        void handleExportVideo();
      } else {
        handleSaveStill('image/png');
      }
    });
    return () => registerPrimarySaveHandler(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isVideoMode, mediaInfo.id, targetFps]);

  return (
    <main className="mx-auto grid min-h-[calc(100vh-4rem)] max-w-[1440px] grid-cols-1 lg:grid-cols-[1fr_360px]">
      {/* Left / Center Canvas Viewport */}
      <section className="flex flex-col justify-between px-6 py-5 lg:border-r lg:border-[#262522]">
        {/* Clean workspace utility bar */}
        <div className="flex flex-wrap items-center justify-between gap-4 pb-4">
          <button
            type="button"
            onClick={onChangeMedia}
            className="inline-flex items-center gap-2 rounded-lg border border-[#2C2B28] bg-[#171614] px-3 py-1.5 text-xs font-medium text-[#D8D3C9] transition-colors hover:border-[#494640] hover:text-white whitespace-nowrap shrink-0 cursor-pointer"
          >
            <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Trocar mídia</span>
          </button>

          <div className="flex items-center gap-2 text-xs text-[#8E8A81] font-mono-nums">
            <span>{exportDims.width} × {exportDims.height}</span>
            <span aria-hidden="true">·</span>
            <span>{isVideoMode ? 'Vídeo / Motion' : 'Imagem'}</span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={onRandomizeEffect}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[#2C2B28] bg-[#171614] px-3 py-1.5 text-xs font-medium text-[#D8D3C9] transition-colors hover:border-[#494640] hover:text-white whitespace-nowrap shrink-0 cursor-pointer"
              title="Sortear outro preset, cores e parâmetros aleatoriamente"
            >
              <Shuffle className="h-3.5 w-3.5 text-[#F5F2EB]" aria-hidden="true" />
              <span>Aleatório</span>
            </button>

            <button
              type="button"
              onClick={onApplySmartAutoTune}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[#2C2B28] bg-[#171614] px-3 py-1.5 text-xs font-medium text-[#D8D3C9] transition-colors hover:border-[#494640] hover:text-white whitespace-nowrap shrink-0 cursor-pointer"
              title="Reaplicar configuração calculada para esta mídia"
            >
              <Sparkles className="h-3.5 w-3.5 text-[#E11D48]" aria-hidden="true" />
              <span>Inteligente</span>
            </button>

            <button
              type="button"
              onClick={() => setShowOriginal((v) => !v)}
              aria-pressed={showOriginal}
              className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                showOriginal
                  ? 'border-[#F5F2EB] bg-[#F5F2EB] text-[#111110]'
                  : 'border-[#2C2B28] bg-[#171614] text-[#D8D3C9] hover:border-[#494640] hover:text-white'
              }`}
            >
              <Eye className="h-3.5 w-3.5" aria-hidden="true" />
              <span>{showOriginal ? 'Vendo original' : 'Original'}</span>
            </button>
          </div>
        </div>

        {/* Central Framed Print Artwork Canvas */}
        <div className="flex flex-1 items-center justify-center py-2">
          <div className="relative flex max-h-[68vh] max-w-full items-center justify-center overflow-hidden rounded-xl border border-[#262522] bg-[#0B0B0A] p-2">
            <canvas
              ref={canvasRef}
              data-testid="studio-canvas"
              aria-label={`Prévia em tempo real de ${mediaInfo.name}`}
              className="max-h-[64vh] max-w-full rounded-lg object-contain"
              style={{ aspectRatio: `${renderW} / ${renderH}` }}
            />
          </div>
        </div>

        {/* Video / Motion Transport Controls */}
        {isVideoMode ? (
          <div className="mt-4 flex flex-wrap items-center justify-between gap-4 rounded-xl border border-[#262522] bg-[#171614] px-4 py-3">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={handleTogglePlay}
                aria-label={isPlaying ? 'Pausar vídeo' : 'Reproduzir vídeo'}
                className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-[#F5F2EB] text-[#111110] transition-colors hover:bg-white cursor-pointer"
              >
                {isPlaying ? (
                  <Pause className="h-4 w-4" aria-hidden="true" />
                ) : (
                  <Play className="h-4 w-4" aria-hidden="true" />
                )}
              </button>
              <span className="font-mono-nums text-xs text-[#D8D3C9] whitespace-nowrap">
                {formatTimecode(currentTime)} / {formatTimecode(durationSec)}
              </span>
            </div>

            <div className="flex flex-1 items-center px-2 min-w-[160px]">
              <input
                type="range"
                aria-label="Linha do tempo do vídeo"
                min={0}
                max={durationSec}
                step={0.04}
                value={currentTime}
                onChange={(e) => handleSeek(parseFloat(e.target.value))}
                className="studio-slider w-full"
              />
            </div>

            <div className="flex items-center gap-1 rounded-lg bg-[#111110] p-1" role="group" aria-label="Taxa de quadros">
              {([24, 30, 60] as const).map((fps) => (
                <button
                  key={fps}
                  type="button"
                  onClick={() => setTargetFps(fps)}
                  className={`rounded-md px-2.5 py-1 font-mono-nums text-xs transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    targetFps === fps
                      ? 'bg-[#2C2B28] font-medium text-[#F5F2EB]'
                      : 'text-[#8E8A81] hover:text-[#D8D3C9]'
                  }`}
                >
                  {fps} fps
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="mt-3 flex items-center justify-center gap-2 text-xs text-[#7D7970]">
            <span>Análise detectada:</span>
            <span>{analysis.summaryTags.join(' · ')}</span>
          </div>
        )}
      </section>

      {/* Right Control Panel */}
      <aside className="flex flex-col justify-between bg-[#141312] p-5">
        <div className="flex flex-col gap-5">
          {/* Segmented Control Tabs */}
          <div
            className="grid grid-cols-4 gap-1 rounded-lg bg-[#1D1C1A] p-1"
            role="tablist"
            aria-label="Controles do efeito"
          >
            {(
              [
                { id: 'presets', label: 'Presets' },
                { id: 'gradients', label: 'Cores' },
                { id: 'params', label: 'Ajustes' },
                { id: 'format', label: 'Formato' },
              ] as const
            ).map((tab) => {
              const selected = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  aria-selected={selected}
                  onClick={() => setActiveTab(tab.id)}
                  className={`rounded-md px-1.5 py-2 text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    selected
                      ? 'bg-[#2C2B28] text-[#F5F2EB]'
                      : 'text-[#8E8A81] hover:text-[#D8D3C9]'
                  }`}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>

          {/* Tab 1: Presets */}
          {activeTab === 'presets' && (
            <div className="grid grid-cols-1 gap-2.5" role="tabpanel" aria-label="Presets de impressão">
              {PRINT_PRESETS.map((preset) => {
                const isSelected = preset.id === activePresetId;
                const gMap =
                  GRADIENT_MAPS.find((g) => g.id === preset.gradientMapId) ?? GRADIENT_MAPS[0];
                return (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => onSelectPreset(preset.id)}
                    aria-pressed={isSelected}
                    className={`flex items-center justify-between gap-3 rounded-xl border p-3.5 text-left transition-colors cursor-pointer ${
                      isSelected
                        ? 'border-[#E11D48] bg-[#1E1C1A]'
                        : 'border-[#262522] bg-[#181715] hover:border-[#3A3833]'
                    }`}
                  >
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-[#F5F2EB]">
                        {preset.name}
                      </div>
                      <div className="mt-0.5 truncate text-xs text-[#8E8A81]">
                        {preset.subtitle}
                      </div>
                    </div>
                    <div
                      aria-hidden="true"
                      className="flex h-7 w-12 shrink-0 overflow-hidden rounded-md border border-[#2C2B28]"
                    >
                      <span className="flex-1" style={{ backgroundColor: gMap.shadow }} />
                      <span className="flex-1" style={{ backgroundColor: gMap.midtone }} />
                      <span className="flex-1" style={{ backgroundColor: gMap.highlight }} />
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          {/* Tab 2: Gradient Maps */}
          {activeTab === 'gradients' && (
            <div className="flex flex-col gap-5" role="tabpanel" aria-label="Gradient Maps">
              <div className="flex items-center justify-between border-b border-[#262522] pb-3">
                <label
                  htmlFor="toggle-gradient-map"
                  className="text-sm font-medium text-[#F5F2EB]"
                >
                  Ativar Gradient Map
                </label>
                <button
                  id="toggle-gradient-map"
                  type="button"
                  role="switch"
                  aria-checked={params.useGradientMap}
                  onClick={() => onUpdateParam('useGradientMap', !params.useGradientMap)}
                  className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors cursor-pointer ${
                    params.useGradientMap ? 'bg-[#E11D48]' : 'bg-[#2C2B28]'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 rounded-full bg-white transition-transform ${
                      params.useGradientMap ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>

              <div className="grid grid-cols-2 gap-2">
                {GRADIENT_MAPS.map((map) => {
                  const isSelected = map.id === gradientMap.id;
                  return (
                    <button
                      key={map.id}
                      type="button"
                      onClick={() => {
                        if (!params.useGradientMap) {
                          onUpdateParam('useGradientMap', true);
                        }
                        onSelectGradientMap(map);
                      }}
                      aria-pressed={isSelected}
                      className={`flex flex-col gap-2 rounded-xl border p-2.5 text-left transition-colors cursor-pointer ${
                        isSelected
                          ? 'border-[#E11D48] bg-[#1E1C1A]'
                          : 'border-[#262522] bg-[#181715] hover:border-[#3A3833]'
                      }`}
                    >
                      <div
                        className="h-5 w-full rounded-md border border-[#2C2B28]"
                        style={{
                          background: `linear-gradient(90deg, ${map.shadow} 0%, ${map.midtone} 50%, ${map.highlight} 100%)`,
                        }}
                      />
                      <span className="truncate text-xs font-medium text-[#E4E0D8]">
                        {map.name}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Live 3-stop Color Pickers */}
              <div className="flex flex-col gap-3 border-t border-[#262522] pt-4">
                <div className="text-xs font-medium text-[#A8A39A]">
                  Ajuste fino de cores
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {(
                    [
                      { key: 'shadow', label: 'Tinta' },
                      { key: 'midtone', label: 'Meio-tom' },
                      { key: 'highlight', label: 'Papel' },
                    ] as const
                  ).map(({ key, label }) => (
                    <label
                      key={key}
                      className="flex flex-col gap-1.5 rounded-lg border border-[#262522] bg-[#181715] p-2 cursor-pointer"
                    >
                      <span className="text-[11px] text-[#8E8A81]">{label}</span>
                      <div className="flex min-w-0 items-center gap-1.5">
                        <input
                          type="color"
                          value={gradientMap[key]}
                          onChange={(e) => onUpdateGradientColor(key, e.target.value)}
                          className="h-5 w-5 shrink-0 cursor-pointer rounded border-0 bg-transparent p-0"
                        />
                        <span className="min-w-0 truncate font-mono-nums text-[10px] text-[#D8D3C9]">
                          {gradientMap[key].toUpperCase()}
                        </span>
                      </div>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Tab 3: Parameters */}
          {activeTab === 'params' && (
            <div className="flex flex-col gap-4" role="tabpanel" aria-label="Parâmetros do efeito">
              <ParamSlider
                id="param-intensity"
                label="Intensidade"
                value={params.intensity}
                min={0}
                max={1}
                step={0.01}
                display={`${Math.round(params.intensity * 100)}%`}
                onChange={(v) => onUpdateParam('intensity', v)}
              />
              <ParamSlider
                id="param-contrast"
                label="Contraste de tinta"
                value={params.contrast}
                min={0}
                max={1}
                step={0.01}
                display={`${Math.round(params.contrast * 100)}%`}
                onChange={(v) => onUpdateParam('contrast', v)}
              />
              <ParamSlider
                id="param-halftone"
                label="Retícula (Halftone)"
                value={params.halftoneScale}
                min={0}
                max={1}
                step={0.01}
                display={`${Math.round(params.halftoneScale * 100)}%`}
                onChange={(v) => onUpdateParam('halftoneScale', v)}
              />
              <ParamSlider
                id="param-angle"
                label="Ângulo da retícula"
                value={params.halftoneAngle}
                min={0}
                max={90}
                step={1}
                display={`${Math.round(params.halftoneAngle)}°`}
                onChange={(v) => onUpdateParam('halftoneAngle', v)}
              />
              <ParamSlider
                id="param-grain"
                label="Granulação / Toner"
                value={params.grain}
                min={0}
                max={1}
                step={0.01}
                display={`${Math.round(params.grain * 100)}%`}
                onChange={(v) => onUpdateParam('grain', v)}
              />
              <ParamSlider
                id="param-paper"
                label="Textura e dobras do papel"
                value={params.paperTexture}
                min={0}
                max={1}
                step={0.01}
                display={`${Math.round(params.paperTexture * 100)}%`}
                onChange={(v) => onUpdateParam('paperTexture', v)}
              />
              <ParamSlider
                id="param-misreg"
                label="Desalinhamento CMYK"
                value={params.misregistration}
                min={0}
                max={1}
                step={0.01}
                display={`${Math.round(params.misregistration * 100)}%`}
                onChange={(v) => onUpdateParam('misregistration', v)}
              />
              <ParamSlider
                id="param-bleed"
                label="Absorção de tinta"
                value={params.inkBleed}
                min={0}
                max={1}
                step={0.01}
                display={`${Math.round(params.inkBleed * 100)}%`}
                onChange={(v) => onUpdateParam('inkBleed', v)}
              />

              <button
                type="button"
                onClick={onApplySmartAutoTune}
                className="mt-1 inline-flex items-center justify-center gap-2 rounded-lg border border-[#2C2B28] bg-[#181715] px-3 py-2 text-xs font-medium text-[#D8D3C9] transition-colors hover:border-[#494640] hover:text-white cursor-pointer"
              >
                <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Restaurar ajuste inteligente</span>
              </button>
            </div>
          )}

          {/* Tab 4: Formato e Tamanho */}
          {activeTab === 'format' && (
            <div className="flex flex-col gap-5" role="tabpanel" aria-label="Formato e tamanho">
              <div>
                <div className="mb-2.5 text-xs font-medium text-[#A8A39A]">
                  Proporção da tela
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {ASPECT_OPTIONS.map((opt) => {
                    const selected = formatConfig.aspectRatio === opt.id;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        aria-pressed={selected}
                        onClick={() => onUpdateFormatConfig({ aspectRatio: opt.id })}
                        className={`flex flex-col items-start gap-1 rounded-xl border p-2.5 text-left transition-colors cursor-pointer ${
                          selected
                            ? 'border-[#E11D48] bg-[#1E1C1A]'
                            : 'border-[#262522] bg-[#181715] hover:border-[#3A3833]'
                        }`}
                      >
                        <span className="font-mono-nums text-xs font-semibold text-[#F5F2EB]">
                          {opt.label}
                        </span>
                        <span className="truncate w-full text-[11px] text-[#8E8A81]">
                          {opt.hint}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="border-t border-[#262522] pt-4">
                <div className="mb-2.5 flex items-center justify-between text-xs">
                  <span className="font-medium text-[#A8A39A]">Tamanho de saída</span>
                  <span className="font-mono-nums text-[#F5F2EB]">
                    {exportDims.width} × {exportDims.height} px
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {EXPORT_SIZE_OPTIONS.map((opt) => {
                    const selected = formatConfig.exportSize === opt.id;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        aria-pressed={selected}
                        onClick={() => onUpdateFormatConfig({ exportSize: opt.id })}
                        className={`flex flex-col items-start gap-0.5 rounded-xl border p-2.5 text-left transition-colors cursor-pointer ${
                          selected
                            ? 'border-[#E11D48] bg-[#1E1C1A]'
                            : 'border-[#262522] bg-[#181715] hover:border-[#3A3833]'
                        }`}
                      >
                        <span className="font-mono-nums text-xs font-semibold text-[#F5F2EB]">
                          {opt.label}
                        </span>
                        <span className="text-[11px] text-[#8E8A81]">{opt.hint}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="border-t border-[#262522] pt-4">
                <div className="mb-2.5 text-xs font-medium text-[#A8A39A]">
                  Enquadramento
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {(
                    [
                      { id: 'cover', label: 'Preencher', hint: 'Recorte central' },
                      { id: 'contain', label: 'Inteira', hint: 'Com margem papel' },
                    ] as const
                  ).map((mode) => {
                    const selected = formatConfig.fitMode === mode.id;
                    return (
                      <button
                        key={mode.id}
                        type="button"
                        aria-pressed={selected}
                        onClick={() => onUpdateFormatConfig({ fitMode: mode.id })}
                        className={`flex flex-col items-start gap-0.5 rounded-xl border p-2.5 text-left transition-colors cursor-pointer ${
                          selected
                            ? 'border-[#E11D48] bg-[#1E1C1A]'
                            : 'border-[#262522] bg-[#181715] hover:border-[#3A3833]'
                        }`}
                      >
                        <span className="text-xs font-semibold text-[#F5F2EB]">
                          {mode.label}
                        </span>
                        <span className="text-[11px] text-[#8E8A81]">{mode.hint}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Pinned Save Footer */}
        <div className="mt-6 border-t border-[#262522] pt-4">
          {exportProgress !== null && (
            <div className="mb-3">
              <div className="mb-1.5 flex items-center justify-between text-xs text-[#D8D3C9]">
                <span>Renderizando quadros do vídeo</span>
                <span className="font-mono-nums">{exportProgress}%</span>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-[#262522]">
                <div
                  className="h-full bg-[#E11D48] transition-all duration-150"
                  style={{ width: `${exportProgress}%` }}
                />
              </div>
            </div>
          )}

          {isVideoMode ? (
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => void handleExportVideo()}
                disabled={exportProgress !== null}
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-[#3A3833] bg-[#22211E] px-3 py-2.5 text-xs font-semibold text-[#F5F2EB] transition-colors hover:border-[#59564F] hover:bg-[#2C2B28] disabled:opacity-50 whitespace-nowrap cursor-pointer"
              >
                <Film className="h-4 w-4" aria-hidden="true" />
                <span>Baixar WebM</span>
              </button>
              <button
                type="button"
                onClick={() => handleSaveStill('image/png')}
                disabled={exportProgress !== null}
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-[#2C2B28] bg-[#181715] px-3 py-2.5 text-xs font-medium text-[#D8D3C9] transition-colors hover:border-[#494640] hover:text-white disabled:opacity-50 whitespace-nowrap cursor-pointer"
              >
                <ImageDown className="h-4 w-4" aria-hidden="true" />
                <span>Quadro PNG</span>
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => handleSaveStill('image/png')}
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-[#3A3833] bg-[#22211E] px-3 py-2.5 text-xs font-semibold text-[#F5F2EB] transition-colors hover:border-[#59564F] hover:bg-[#2C2B28] whitespace-nowrap cursor-pointer"
              >
                <Download className="h-4 w-4" aria-hidden="true" />
                <span>Baixar PNG</span>
              </button>
              <button
                type="button"
                onClick={() => handleSaveStill('image/jpeg')}
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-[#2C2B28] bg-[#181715] px-3 py-2.5 text-xs font-medium text-[#D8D3C9] transition-colors hover:border-[#494640] hover:text-white whitespace-nowrap cursor-pointer"
              >
                <ImageDown className="h-4 w-4" aria-hidden="true" />
                <span>Baixar JPG</span>
              </button>
            </div>
          )}

          {saveFeedback && (
            <p role="status" className="mt-2.5 text-center text-xs font-medium text-[#4ADE80]">
              {saveFeedback}
            </p>
          )}
        </div>
      </aside>
    </main>
  );
}

interface ParamSliderProps {
  id: string;
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  display: string;
  onChange: (value: number) => void;
}

function ParamSlider({
  id,
  label,
  value,
  min,
  max,
  step,
  display,
  onChange,
}: ParamSliderProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between text-xs">
        <label htmlFor={id} className="font-medium text-[#D8D3C9]">
          {label}
        </label>
        <span className="font-mono-nums text-[#8E8A81]">{display}</span>
      </div>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="studio-slider w-full"
      />
    </div>
  );
}
