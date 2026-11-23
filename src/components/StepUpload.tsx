import { useRef, useState, type ChangeEvent, type DragEvent } from 'react';
import { Upload, Image as ImageIcon, Film } from 'lucide-react';

interface StepUploadProps {
  onSelectFile: (file: File) => void;
  onUseSamplePhoto: () => void;
  onUseSampleVideo: () => void;
  errorMessage: string | null;
}

export function StepUpload({
  onSelectFile,
  onUseSamplePhoto,
  onUseSampleVideo,
  errorMessage,
}: StepUploadProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      onSelectFile(file);
    }
    event.target.value = '';
  };

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragging(false);
    const file = event.dataTransfer.files?.[0];
    if (file) {
      onSelectFile(file);
    }
  };

  return (
    <main className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-4xl flex-col items-center justify-center px-6 py-12">
      <div className="mb-8 text-center">
        <h1 className="font-display text-3xl font-semibold tracking-tight text-[#F5F2EB] sm:text-5xl text-balance">
          Arte de impressão retrô em segundos
        </h1>
        <p className="mx-auto mt-3 max-w-xl text-base text-[#A8A39A] leading-relaxed">
          Suba uma imagem ou vídeo. O estúdio analisa luz, contraste e cor para aplicar texturas de risografia, retícula e papel vintage automaticamente.
        </p>
      </div>

      <div
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        className={`w-full max-w-2xl rounded-2xl border border-dashed p-10 text-center transition-colors ${
          isDragging
            ? 'border-[#E11D48] bg-[#1C1B19]'
            : 'border-[#33312D] bg-[#171614] hover:border-[#4D4A44]'
        }`}
      >
        <input
          ref={inputRef}
          id="media-upload-input"
          type="file"
          accept="image/*,video/*"
          onChange={handleFileChange}
          className="sr-only"
          aria-label="Selecionar imagem ou vídeo do dispositivo"
        />

        <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-xl bg-[#22211E] text-[#F5F2EB]">
          <Upload className="h-6 w-6" aria-hidden="true" />
        </div>

        <h2 className="font-display text-xl font-semibold text-[#F5F2EB]">
          Arraste uma foto ou vídeo aqui
        </h2>
        <p className="mt-1.5 text-sm text-[#8E8A81]">
          PNG, JPG, WebP, MP4 ou WebM · processamento local com baixa latência
        </p>

        <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="inline-flex items-center gap-2 rounded-lg bg-[#F5F2EB] px-5 py-2.5 text-sm font-semibold text-[#111110] transition-colors hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E11D48] whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Upload className="h-4 w-4" aria-hidden="true" />
            <span>Escolher arquivo</span>
          </button>
        </div>

        {errorMessage && (
          <p role="alert" className="mt-5 text-sm font-medium text-[#FB7185]">
            {errorMessage}
          </p>
        )}
      </div>

      <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row">
        <span className="text-xs text-[#7D7970]">Ou comece agora com:</span>
        <div className="flex flex-wrap items-center justify-center gap-3">
          <button
            type="button"
            onClick={onUseSamplePhoto}
            className="inline-flex items-center gap-2 rounded-lg border border-[#2C2B28] bg-[#171614] px-4 py-2 text-sm font-medium text-[#E4E0D8] transition-colors hover:border-[#494640] hover:bg-[#1E1D1B] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E11D48] whitespace-nowrap shrink-0 cursor-pointer"
          >
            <ImageIcon className="h-4 w-4 text-[#A8A39A]" aria-hidden="true" />
            <span>Foto de exemplo</span>
          </button>
          <button
            type="button"
            onClick={onUseSampleVideo}
            className="inline-flex items-center gap-2 rounded-lg border border-[#2C2B28] bg-[#171614] px-4 py-2 text-sm font-medium text-[#E4E0D8] transition-colors hover:border-[#494640] hover:bg-[#1E1D1B] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E11D48] whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Film className="h-4 w-4 text-[#A8A39A]" aria-hidden="true" />
            <span>Vídeo em movimento</span>
          </button>
        </div>
      </div>
    </main>
  );
}
