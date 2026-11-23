import { useCallback, useEffect, useRef, useState } from 'react';
import { TopBar } from './components/TopBar';
import { StepUpload } from './components/StepUpload';
import { StepAnalyze } from './components/StepAnalyze';
import { StepStudio } from './components/StepStudio';
import type {
  EffectParams,
  GradientMap,
  MediaAnalysis,
  MediaFormatConfig,
  MediaSourceInfo,
  StepId,
} from './types/studio';
import { analyzeImagePixels } from './engine/analyzer';
import {
  generateRandomLook,
  getGradientMapById,
  getPresetById,
  PRINT_PRESETS,
} from './engine/presets';
import { createSamplePhotoCanvas, drawProceduralMotionFrame } from './utils/sampleMedia';

function extractPixelsFromSource(
  source: HTMLImageElement | HTMLCanvasElement | HTMLVideoElement,
  srcW: number,
  srcH: number
): Uint8ClampedArray | null {
  const sampleSize = 128;
  const aspect = srcW / Math.max(1, srcH);
  const w = aspect >= 1 ? sampleSize : Math.max(16, Math.round(sampleSize * aspect));
  const h = aspect >= 1 ? Math.max(16, Math.round(sampleSize / aspect)) : sampleSize;

  const offscreen = document.createElement('canvas');
  offscreen.width = w;
  offscreen.height = h;
  const ctx = offscreen.getContext('2d');
  if (!ctx) return null;
  ctx.drawImage(source, 0, 0, w, h);
  return ctx.getImageData(0, 0, w, h).data;
}

export default function App() {
  const [step, setStep] = useState<StepId>('upload');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [mediaInfo, setMediaInfo] = useState<MediaSourceInfo | null>(null);
  const [imageEl, setImageEl] = useState<HTMLImageElement | HTMLCanvasElement | null>(null);
  const [videoEl, setVideoEl] = useState<HTMLVideoElement | null>(null);
  const [analysis, setAnalysis] = useState<MediaAnalysis | null>(null);

  const [activePresetId, setActivePresetId] = useState<string>(PRINT_PRESETS[0].id);
  const [gradientMap, setGradientMap] = useState<GradientMap>(() =>
    getGradientMapById(PRINT_PRESETS[0].gradientMapId)
  );
  const [params, setParams] = useState<EffectParams>(() => ({ ...PRINT_PRESETS[0].params }));
  const [formatConfig, setFormatConfig] = useState<MediaFormatConfig>({
    aspectRatio: 'original',
    exportSize: 'original',
    fitMode: 'cover',
  });
  const [isExporting, setIsExporting] = useState(false);

  const primarySaveRef = useRef<(() => void) | null>(null);
  const analyzeTimerRef = useRef<number | null>(null);
  const activeUrlRef = useRef<string | null>(null);

  const cleanupMediaUrls = () => {
    if (activeUrlRef.current) {
      URL.revokeObjectURL(activeUrlRef.current);
      activeUrlRef.current = null;
    }
    if (analyzeTimerRef.current !== null) {
      window.clearTimeout(analyzeTimerRef.current);
      analyzeTimerRef.current = null;
    }
  };

  useEffect(() => {
    return () => cleanupMediaUrls();
  }, []);

  const startSmartAnalysis = useCallback(
    (
      info: MediaSourceInfo,
      pixels: Uint8ClampedArray | null,
      skipDelay = false
    ) => {
      const result = pixels
        ? analyzeImagePixels(pixels, 128, 128)
        : analyzeImagePixels(new Uint8ClampedArray(128 * 128 * 4).fill(140), 128, 128);

      setMediaInfo(info);
      setAnalysis(result);
      setActivePresetId(result.recommendedPresetId);
      setGradientMap(getGradientMapById(result.recommendedGradientId));
      setParams({ ...result.optimizedParams });
      setFormatConfig({
        aspectRatio: 'original',
        exportSize: 'original',
        fitMode: 'cover',
      });
      setErrorMessage(null);

      if (skipDelay) {
        setStep('studio');
      } else {
        setStep('analyze');
        analyzeTimerRef.current = window.setTimeout(() => {
          setStep('studio');
        }, 850);
      }
    },
    []
  );

  const handleUseSamplePhoto = useCallback(
    (skipDelay = false) => {
      cleanupMediaUrls();
      const canvas = createSamplePhotoCanvas(960, 1200);
      setVideoEl(null);
      setImageEl(canvas);
      const pixels = extractPixelsFromSource(canvas, canvas.width, canvas.height);
      startSmartAnalysis(
        {
          id: `sample-photo-${Date.now()}`,
          name: 'retrato-editorial.png',
          kind: 'image',
          width: canvas.width,
          height: canvas.height,
        },
        pixels,
        skipDelay
      );
    },
    [startSmartAnalysis]
  );

  const handleUseSampleVideo = useCallback(
    (skipDelay = false) => {
      cleanupMediaUrls();
      const canvas = document.createElement('canvas');
      canvas.width = 720;
      canvas.height = 720;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        drawProceduralMotionFrame(ctx, 720, 720, 0.4);
      }
      setImageEl(null);
      setVideoEl(null);
      const pixels = extractPixelsFromSource(canvas, 720, 720);
      startSmartAnalysis(
        {
          id: `sample-video-${Date.now()}`,
          name: 'animacao-cinetica.webm',
          kind: 'procedural',
          width: 720,
          height: 720,
          durationSec: 6,
        },
        pixels,
        skipDelay
      );
    },
    [startSmartAnalysis]
  );

  // Support ?autostart=1 for automated testing or instant jump to studio
  useEffect(() => {
    const query = new URLSearchParams(window.location.search);
    if (query.get('autostart') === '1') {
      if (query.get('demo') === 'video') {
        handleUseSampleVideo(true);
      } else {
        handleUseSamplePhoto(true);
      }
    }
  }, [handleUseSamplePhoto, handleUseSampleVideo]);

  const handleSelectFile = (file: File) => {
    setErrorMessage(null);
    const isImage = file.type.startsWith('image/');
    const isVideo = file.type.startsWith('video/');

    if (!isImage && !isVideo) {
      setErrorMessage('Formato não suportado. Envie uma imagem (PNG, JPG, WebP) ou vídeo (MP4, WebM).');
      return;
    }

    cleanupMediaUrls();
    const objectUrl = URL.createObjectURL(file);
    activeUrlRef.current = objectUrl;

    if (isImage) {
      const img = new Image();
      img.onload = () => {
        setVideoEl(null);
        setImageEl(img);
        const pixels = extractPixelsFromSource(img, img.naturalWidth, img.naturalHeight);
        startSmartAnalysis(
          {
            id: `img-${Date.now()}`,
            name: file.name,
            kind: 'image',
            width: img.naturalWidth,
            height: img.naturalHeight,
            objectUrl,
          },
          pixels
        );
      };
      img.onerror = () => {
        setErrorMessage('Não foi possível ler esta imagem. Tente outro arquivo.');
      };
      img.src = objectUrl;
    } else {
      const video = document.createElement('video');
      video.muted = true;
      video.loop = true;
      video.playsInline = true;
      video.preload = 'auto';

      const handleReady = () => {
        video.removeEventListener('loadeddata', handleReady);
        setImageEl(null);
        setVideoEl(video);
        const w = video.videoWidth || 720;
        const h = video.videoHeight || 720;
        const pixels = extractPixelsFromSource(video, w, h);
        startSmartAnalysis(
          {
            id: `vid-${Date.now()}`,
            name: file.name,
            kind: 'video',
            width: w,
            height: h,
            durationSec: Number.isFinite(video.duration) && video.duration > 0 ? video.duration : 6,
            objectUrl,
          },
          pixels
        );
      };

      video.addEventListener('loadeddata', handleReady);
      video.onerror = () => {
        setErrorMessage('Não foi possível reproduzir este vídeo no navegador. Tente MP4 (H.264) ou WebM.');
      };
      video.src = objectUrl;
      video.load();
    }
  };

  const handleSelectPreset = (presetId: string) => {
    const preset = getPresetById(presetId);
    setActivePresetId(preset.id);
    setGradientMap(getGradientMapById(preset.gradientMapId));
    setParams({ ...preset.params });
  };

  const handleSelectGradientMap = (map: GradientMap) => {
    setGradientMap({ ...map });
  };

  const handleUpdateGradientColor = (
    key: 'shadow' | 'midtone' | 'highlight',
    value: string
  ) => {
    setGradientMap((prev) => ({
      ...prev,
      id: 'custom',
      name: 'Personalizado',
      [key]: value,
    }));
  };

  const handleUpdateParam = <K extends keyof EffectParams>(
    key: K,
    value: EffectParams[K]
  ) => {
    setParams((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  const handleApplySmartAutoTune = () => {
    if (!analysis) return;
    setActivePresetId(analysis.recommendedPresetId);
    setGradientMap(getGradientMapById(analysis.recommendedGradientId));
    setParams({ ...analysis.optimizedParams });
  };

  const handleRandomizeEffect = () => {
    const next = generateRandomLook(activePresetId, gradientMap.id);
    setActivePresetId(next.presetId);
    setGradientMap(next.gradientMap);
    setParams(next.params);
  };

  const handleChangeMedia = () => {
    cleanupMediaUrls();
    if (videoEl) {
      videoEl.pause();
    }
    setVideoEl(null);
    setImageEl(null);
    setMediaInfo(null);
    setAnalysis(null);
    setErrorMessage(null);
    setStep('upload');
  };

  return (
    <div className="min-h-screen bg-[#111110] text-[#F5F2EB]">
      <TopBar
        currentStep={step}
        canSave={step === 'studio'}
        isVideo={mediaInfo?.kind !== 'image'}
        isExporting={isExporting}
        onSavePrimary={() => primarySaveRef.current?.()}
      />

      {step === 'upload' && (
        <StepUpload
          onSelectFile={handleSelectFile}
          onUseSamplePhoto={() => handleUseSamplePhoto(false)}
          onUseSampleVideo={() => handleUseSampleVideo(false)}
          errorMessage={errorMessage}
        />
      )}

      {step === 'analyze' && mediaInfo && analysis && (
        <StepAnalyze
          mediaInfo={mediaInfo}
          analysis={analysis}
          onContinue={() => {
            if (analyzeTimerRef.current !== null) {
              window.clearTimeout(analyzeTimerRef.current);
              analyzeTimerRef.current = null;
            }
            setStep('studio');
          }}
        />
      )}

      {step === 'studio' && mediaInfo && analysis && (
        <StepStudio
          mediaInfo={mediaInfo}
          imageElement={imageEl}
          videoElement={videoEl}
          analysis={analysis}
          activePresetId={activePresetId}
          gradientMap={gradientMap}
          params={params}
          formatConfig={formatConfig}
          onSelectPreset={handleSelectPreset}
          onSelectGradientMap={handleSelectGradientMap}
          onUpdateGradientColor={handleUpdateGradientColor}
          onUpdateParam={handleUpdateParam}
          onUpdateFormatConfig={(patch) =>
            setFormatConfig((prev) => ({ ...prev, ...patch }))
          }
          onApplySmartAutoTune={handleApplySmartAutoTune}
          onRandomizeEffect={handleRandomizeEffect}
          onChangeMedia={handleChangeMedia}
          registerPrimarySaveHandler={(fn) => {
            primarySaveRef.current = fn;
          }}
          onExportStateChange={setIsExporting}
        />
      )}
    </div>
  );
}
