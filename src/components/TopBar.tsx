import type { StepId } from '../types/studio';
import { Download } from 'lucide-react';

interface TopBarProps {
  currentStep: StepId;
  onSavePrimary?: () => void;
  isExporting?: boolean;
  canSave?: boolean;
  isVideo?: boolean;
}

const STEPS: { id: StepId; label: string }[] = [
  { id: 'upload', label: '1. Enviar' },
  { id: 'analyze', label: '2. Aplicar' },
  { id: 'studio', label: '3. Ajustar e Salvar' },
];

export function TopBar({
  currentStep,
  onSavePrimary,
  isExporting = false,
  canSave = false,
  isVideo = false,
}: TopBarProps) {
  return (
    <header className="w-full border-b border-[#262522] bg-[#111110]/95 backdrop-blur-sm">
      <div className="mx-auto flex h-16 max-w-[1440px] items-center justify-between gap-8 px-6">
        {/* Zone 1: Single text element wordmark */}
        <span className="font-display text-xl font-bold tracking-tight text-[#F5F2EB] whitespace-nowrap shrink-0">
          Prensa
        </span>

        {/* Zone 2: Clean typographic step indicator */}
        <nav aria-label="Etapas do estúdio" className="hidden md:flex items-center gap-5 text-sm">
          {STEPS.map((step, index) => {
            const isActive = step.id === currentStep;
            return (
              <div key={step.id} className="flex items-center gap-5">
                {index > 0 && (
                  <span aria-hidden="true" className="text-[#4A4843]">
                    /
                  </span>
                )}
                <span
                  aria-current={isActive ? 'step' : undefined}
                  className={`whitespace-nowrap shrink-0 transition-colors ${
                    isActive
                      ? 'font-semibold text-[#F5F2EB]'
                      : 'font-normal text-[#7D7970]'
                  }`}
                >
                  {step.label}
                </span>
              </div>
            );
          })}
        </nav>

        {/* Zone 3: Single primary action */}
        <div className="flex items-center shrink-0">
          {canSave && onSavePrimary ? (
            <button
              type="button"
              onClick={onSavePrimary}
              disabled={isExporting}
              className="inline-flex items-center gap-2 rounded-lg bg-[#E11D48] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#BE123C] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E11D48] focus-visible:ring-offset-2 focus-visible:ring-offset-[#111110] disabled:opacity-50 whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Download className="h-4 w-4" aria-hidden="true" />
              <span>
                {isExporting
                  ? 'Exportando...'
                  : isVideo
                    ? 'Salvar vídeo'
                    : 'Salvar imagem'}
              </span>
            </button>
          ) : (
            <span className="text-xs text-[#7D7970] whitespace-nowrap shrink-0">
              Estúdio de Impressão
            </span>
          )}
        </div>
      </div>
    </header>
  );
}
