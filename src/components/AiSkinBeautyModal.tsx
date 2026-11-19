import React, { useEffect } from "react";
import {
  Check,
  Loader2,
  RotateCcw,
  Sparkles,
  Sun,
  Wand2,
  X,
} from "lucide-react";
import {
  AI_BEAUTY_QUICK_PRESETS,
  AiSkinBeautyOptions,
  DEFAULT_AI_SKIN_BEAUTY_OPTIONS,
  SKIN_TONE_PRESETS,
  SkinWhiteningLevel,
  hasAnyAiBeautyOption,
} from "../types/photo";

interface AiSkinBeautyModalProps {
  isOpen: boolean;
  onClose: () => void;
  previewImageUrl: string | null;
  options: AiSkinBeautyOptions;
  onChangeOptions: (next: AiSkinBeautyOptions) => void;
  onApply: (chosen: AiSkinBeautyOptions) => void;
  isApplying: boolean;
  statusText: string;
  aiBeautyApplied: boolean;
  onRestoreOriginal?: () => void;
}

const WHITENING_LEVELS: Array<{
  id: SkinWhiteningLevel;
  label: string;
  sub: string;
}> = [
  { id: "off", label: "Off", sub: "No lift" },
  { id: "light", label: "Light", sub: "Subtle glow" },
  { id: "medium", label: "Medium", sub: "Studio fair" },
  { id: "bright", label: "Bright", sub: "High whitening" },
];

export const AiSkinBeautyModal: React.FC<AiSkinBeautyModalProps> = ({
  isOpen,
  onClose,
  previewImageUrl,
  options,
  onChangeOptions,
  onApply,
  isApplying,
  statusText,
  aiBeautyApplied,
  onRestoreOriginal,
}) => {
  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !isApplying) {
        onClose();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isOpen, isApplying, onClose]);

  if (!isOpen) return null;

  const canApply = hasAnyAiBeautyOption(options) && !isApplying;

  const toggleField = (
    key:
      | "removePimples"
      | "smoothSkinAndShine"
      | "removeDarkCircles"
      | "studioLighting"
  ) => {
    onChangeOptions({
      ...options,
      [key]: !options[key],
    });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-[#080B12]/80 backdrop-blur-md"
      role="dialog"
      aria-modal="true"
      aria-labelledby="ai-skin-beauty-modal-title"
      onClick={() => {
        if (!isApplying) onClose();
      }}
    >
      <div
        className="w-full max-w-2xl max-h-[92vh] overflow-y-auto bg-[#111827] border border-[#00E5FF]/25 rounded-2xl shadow-[0_24px_64px_rgba(0,0,0,0.75)] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-[#00E5FF]/15 sticky top-0 bg-[#111827]/95 backdrop-blur-md z-10">
          <div className="flex items-center gap-3 min-w-0">
            {previewImageUrl && (
              <img
                src={previewImageUrl}
                alt="Portrait preview"
                className="w-11 h-11 rounded-lg object-cover border border-[#00E5FF]/35 shrink-0"
              />
            )}
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-[#00E5FF] shrink-0" />
                <h2
                  id="ai-skin-beauty-modal-title"
                  className="text-sm sm:text-base font-bold text-[#F5F7FA] truncate"
                >
                  AI Skin Beauty &amp; Pimple Removal
                </h2>
              </div>
              <p className="text-xs text-[#94A3B8] truncate">
                Choose retouch options · Runs instantly on-device · 300 PPI ready
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={isApplying}
            aria-label="Close AI Skin Beauty options"
            className="inline-flex items-center justify-center w-9 h-9 rounded-lg bg-[#161D2B] border border-[#00E5FF]/20 text-[#94A3B8] hover:text-[#F5F7FA] hover:border-[#00E5FF]/50 transition-colors cursor-pointer disabled:opacity-40 shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 space-y-5">
          {/* Quick Presets */}
          <div>
            <div className="flex items-center justify-between gap-2 mb-2">
              <span className="text-xs font-semibold text-[#E2E8F0]">
                Quick Studio Presets
              </span>
              <button
                type="button"
                onClick={() => onChangeOptions(DEFAULT_AI_SKIN_BEAUTY_OPTIONS)}
                className="text-xs font-medium text-[#00E5FF] hover:text-[#F5F7FA] cursor-pointer whitespace-nowrap"
              >
                Recommended Defaults
              </button>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {AI_BEAUTY_QUICK_PRESETS.map((preset) => {
                const isSelected =
                  preset.options.removePimples === options.removePimples &&
                  preset.options.smoothSkinAndShine ===
                    options.smoothSkinAndShine &&
                  preset.options.removeDarkCircles ===
                    options.removeDarkCircles &&
                  preset.options.studioLighting === options.studioLighting &&
                  preset.options.whiteningLevel === options.whiteningLevel &&
                  preset.options.skinTone === options.skinTone;

                return (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => onChangeOptions({ ...preset.options })}
                    className={`flex flex-col items-start gap-0.5 px-3 py-2.5 rounded-xl border text-left transition-colors cursor-pointer min-h-[44px] ${
                      isSelected
                        ? "border-[#00E5FF] bg-[#00E5FF]/15 text-[#F5F7FA]"
                        : "border-[#00E5FF]/15 bg-[#080B12]/70 hover:border-[#00E5FF]/45 text-[#E2E8F0]"
                    }`}
                  >
                    <span className="text-xs font-bold truncate w-full">
                      {preset.label}
                    </span>
                    <span className="text-[11px] text-[#94A3B8] line-clamp-1 w-full">
                      {preset.description}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 4 Core AI Retouch Checkboxes */}
          <div>
            <span className="block text-xs font-semibold text-[#E2E8F0] mb-2">
              Choose Retouch Actions
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {[
                {
                  key: "removePimples" as const,
                  title: "Remove Pimples, Acne & Dark Spots",
                  desc: "Auto-detects and heals red pimples, acne marks, and blemishes.",
                },
                {
                  key: "smoothSkinAndShine" as const,
                  title: "Smooth Skin, Pores & Oil Shine",
                  desc: "Softens pores and forehead glare while keeping eyes & hair sharp.",
                },
                {
                  key: "removeDarkCircles" as const,
                  title: "Remove Under-Eye Dark Circles",
                  desc: "Brightens tired under-eye shadows naturally without washing out.",
                },
                {
                  key: "studioLighting" as const,
                  title: "Studio Portrait Lighting & Clarity",
                  desc: "Adds flattering softbox face light and crisp eye/hair clarity.",
                },
              ].map((item) => {
                const checked = options[item.key];
                return (
                  <button
                    key={item.key}
                    type="button"
                    role="checkbox"
                    aria-checked={checked}
                    onClick={() => toggleField(item.key)}
                    className={`flex items-start gap-3 p-3 rounded-xl border text-left transition-colors cursor-pointer min-h-[56px] ${
                      checked
                        ? "border-[#00E5FF] bg-[#00E5FF]/12 text-[#F5F7FA]"
                        : "border-[#00E5FF]/15 bg-[#080B12]/70 hover:border-[#00E5FF]/40 text-[#94A3B8]"
                    }`}
                  >
                    <span
                      className={`mt-0.5 inline-flex items-center justify-center w-5 h-5 rounded-md border shrink-0 transition-colors ${
                        checked
                          ? "bg-[#00E5FF] border-[#00E5FF] text-[#080B12]"
                          : "bg-[#111827] border-[#00E5FF]/35 text-transparent"
                      }`}
                      aria-hidden="true"
                    >
                      <Check className="w-3.5 h-3.5 stroke-[3]" />
                    </span>
                    <div className="min-w-0">
                      <div className="text-xs font-bold text-[#F5F7FA]">
                        {item.title}
                      </div>
                      <div className="text-[11px] text-[#94A3B8] leading-snug mt-0.5">
                        {item.desc}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Skin Whitening / Fair Glow Strength */}
          <div>
            <div className="flex items-center justify-between gap-2 mb-2">
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#E2E8F0]">
                <Sun className="w-3.5 h-3.5 text-[#00E5FF]" />
                <span>Skin Whitening &amp; Fair Glow Strength</span>
              </span>
              <span className="text-[11px] font-mono-nums text-[#00E5FF] capitalize">
                {options.whiteningLevel}
              </span>
            </div>
            <div className="grid grid-cols-4 gap-2">
              {WHITENING_LEVELS.map((lvl) => {
                const active = options.whiteningLevel === lvl.id;
                return (
                  <button
                    key={lvl.id}
                    type="button"
                    onClick={() =>
                      onChangeOptions({ ...options, whiteningLevel: lvl.id })
                    }
                    className={`flex flex-col items-center justify-center px-2 py-2.5 rounded-xl border transition-colors cursor-pointer min-h-[48px] ${
                      active
                        ? "border-[#00E5FF] bg-[#00E5FF]/15 text-[#F5F7FA]"
                        : "border-[#00E5FF]/15 bg-[#080B12]/70 hover:border-[#00E5FF]/40 text-[#E2E8F0]"
                    }`}
                  >
                    <span className="text-xs font-bold whitespace-nowrap">
                      {lvl.label}
                    </span>
                    <span className="text-[10px] text-[#94A3B8] whitespace-nowrap">
                      {lvl.sub}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* All-Skin-Type Colour & Tone Choice */}
          <div>
            <div className="flex items-center justify-between gap-2 mb-2">
              <span className="text-xs font-semibold text-[#E2E8F0]">
                Skin Tone &amp; Colour Choice (All Skin Types)
              </span>
              <span className="text-[11px] font-mono-nums text-[#94A3B8]">
                {SKIN_TONE_PRESETS.find((t) => t.id === options.skinTone)
                  ?.label || "Keep Original"}
              </span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {SKIN_TONE_PRESETS.map((tone) => {
                const active = options.skinTone === tone.id;
                return (
                  <button
                    key={tone.id}
                    type="button"
                    onClick={() =>
                      onChangeOptions({ ...options, skinTone: tone.id })
                    }
                    className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl border text-left transition-colors cursor-pointer min-h-[44px] ${
                      active
                        ? "border-[#00E5FF] bg-[#00E5FF]/15 text-[#F5F7FA]"
                        : "border-[#00E5FF]/15 bg-[#080B12]/70 hover:border-[#00E5FF]/40 text-[#E2E8F0]"
                    }`}
                  >
                    <span
                      className="w-5 h-5 rounded-full border border-white/30 shrink-0"
                      style={{ backgroundColor: tone.swatch }}
                      aria-hidden="true"
                    />
                    <div className="min-w-0">
                      <div className="text-xs font-bold truncate">
                        {tone.label}
                      </div>
                      <div className="text-[10px] text-[#94A3B8] truncate">
                        {tone.description}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 border-t border-[#00E5FF]/15 bg-[#0D1322]/90 sticky bottom-0">
          <div className="flex items-center gap-2">
            {aiBeautyApplied && onRestoreOriginal && (
              <button
                type="button"
                onClick={() => {
                  onRestoreOriginal();
                  onClose();
                }}
                disabled={isApplying}
                className="inline-flex items-center gap-1.5 px-3 py-2.5 rounded-xl text-xs font-semibold text-[#F5F7FA] bg-[#161D2B] border border-[#00E5FF]/20 hover:border-[#00E5FF]/50 transition-colors cursor-pointer whitespace-nowrap min-h-[42px]"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Restore Original</span>
              </button>
            )}
          </div>

          <div className="flex items-center gap-2.5 ml-auto">
            <button
              type="button"
              onClick={onClose}
              disabled={isApplying}
              className="px-4 py-2.5 rounded-xl text-xs font-semibold text-[#94A3B8] hover:text-[#F5F7FA] bg-[#161D2B] border border-white/10 transition-colors cursor-pointer whitespace-nowrap min-h-[42px]"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => onApply(options)}
              disabled={!canApply}
              className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold bg-gradient-to-r from-[#00E5FF] to-[#8B5CF6] text-[#080B12] hover:brightness-110 disabled:opacity-45 disabled:cursor-not-allowed transition-all cursor-pointer whitespace-nowrap shadow-[0_0_24px_rgba(0,229,255,0.25)] min-h-[42px]"
            >
              {isApplying ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>{statusText || "Applying AI Skin Beauty..."}</span>
                </>
              ) : (
                <>
                  <Wand2 className="w-4 h-4" />
                  <span>Apply AI Skin Beauty</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
