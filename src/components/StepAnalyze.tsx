import type { MediaAnalysis, MediaSourceInfo } from '../types/studio';
import { getPresetById } from '../engine/presets';
import { ArrowRight } from 'lucide-react';

interface StepAnalyzeProps {
  mediaInfo: MediaSourceInfo;
  analysis: MediaAnalysis;
  onContinue: () => void;
}

export function StepAnalyze({ mediaInfo, analysis, onContinue }: StepAnalyzeProps) {
  const preset = getPresetById(analysis.recommendedPresetId);

  return (
    <main className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-2xl flex-col items-center justify-center px-6 py-12">
      <div className="w-full rounded-2xl border border-[#262522] bg-[#171614] p-8">
        <p className="text-xs font-medium text-[#A8A39A]">
          Análise inteligente concluída
        </p>
        <h1 className="mt-2 font-display text-2xl font-semibold tracking-tight text-[#F5F2EB] sm:text-3xl">
          Aplicando {preset.name}
        </h1>
        <p className="mt-2 text-sm text-[#9B968D]">
          {preset.subtitle} — ajustado automaticamente para {mediaInfo.name}.
        </p>

        <div className="mt-6 flex flex-wrap items-center gap-2 text-sm text-[#D8D3C9]">
          {analysis.summaryTags.map((tag, idx) => (
            <span key={tag} className="inline-flex items-center gap-2">
              {idx > 0 && (
                <span aria-hidden="true" className="text-[#59564F]">
                  ·
                </span>
              )}
              <span>{tag}</span>
            </span>
          ))}
        </div>

        <div className="mt-6 grid grid-cols-3 gap-4 border-t border-[#262522] pt-5">
          <div>
            <div className="text-xs text-[#8E8A81]">Luminosidade</div>
            <div className="mt-1 font-mono-nums text-lg font-medium text-[#F5F2EB]">
              {Math.round(analysis.meanLuminance * 100)}%
            </div>
          </div>
          <div>
            <div className="text-xs text-[#8E8A81]">Contraste</div>
            <div className="mt-1 font-mono-nums text-lg font-medium text-[#F5F2EB]">
              {Math.round(analysis.contrastSpread * 100)}%
            </div>
          </div>
          <div>
            <div className="text-xs text-[#8E8A81]">Retícula ideal</div>
            <div className="mt-1 font-mono-nums text-lg font-medium text-[#F5F2EB]">
              {Math.round(analysis.optimizedParams.halftoneScale * 100)}%
            </div>
          </div>
        </div>

        <div className="mt-6 flex items-center justify-between gap-4">
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-[#262522]">
            <div className="h-full w-full origin-left animate-[pulse_1.1s_ease-in-out_infinite] rounded-full bg-[#E11D48]" />
          </div>
          <button
            type="button"
            onClick={onContinue}
            className="inline-flex items-center gap-1.5 rounded-lg bg-[#262522] px-4 py-2 text-xs font-medium text-[#F5F2EB] transition-colors hover:bg-[#33312D] whitespace-nowrap shrink-0 cursor-pointer"
          >
            <span>Abrir resultado</span>
            <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        </div>
      </div>
    </main>
  );
}
