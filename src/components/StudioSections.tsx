import {
  CheckCircle2,
  Mail,
  Printer,
  Scissors,
  Sliders,
} from "lucide-react";
import {
  BRAND_NAME,
  OFFICIAL_SUPPORT_EMAIL,
  PAPER_SIZES,
  PaperKey,
  PHOTO_PRESETS,
  PresetKey,
  STUDIO_ACCENTS,
  StudioAccentKey,
} from "../types/photo";
import { calculateSheetLayout, mmToPixels300Ppi } from "../utils/imageProcessing";

interface StudioSectionsProps {
  gapMm: number;
  selectedPresetKey: PresetKey;
  customWInch: number;
  customHInch: number;
  supportEmail: string;
  onChangeSupportEmail: (email: string) => void;
  studioAccent: StudioAccentKey;
  onChangeStudioAccent: (accent: StudioAccentKey) => void;
  zeroZerosUrl: string;
  onChangeZeroZerosUrl: (url: string) => void;
  onSelectPaperAndDownload?: (paperKey: PaperKey) => void;
  hasImage: boolean;
}

export function StudioSections({
  gapMm,
  selectedPresetKey,
  customWInch,
  customHInch,
  supportEmail,
  onChangeSupportEmail,
  studioAccent,
  onChangeStudioAccent,
  zeroZerosUrl,
  onChangeZeroZerosUrl,
  onSelectPaperAndDownload,
  hasImage,
}: StudioSectionsProps) {
  const gapPx = mmToPixels300Ppi(gapMm);
  const paperKeys = Object.keys(PAPER_SIZES) as PaperKey[];

  const activePreset = PHOTO_PRESETS[selectedPresetKey];
  const activeTileW =
    selectedPresetKey === "custom_inch"
      ? Math.max(150, Math.round(customWInch * 300))
      : activePreset.printW;
  const activeTileH =
    selectedPresetKey === "custom_inch"
      ? Math.max(150, Math.round(customHInch * 300))
      : activePreset.printH;

  return (
    <div className="space-y-8 sm:space-y-10 mt-8 sm:mt-10">
      {/* Paper Capacity & Uniform Gap Matrix */}
      <section id="paper-matrix" className="glass-card p-4 sm:p-6 lg:p-8">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-6">
          <div>
            <h2 className="text-xl sm:text-2xl font-bold text-[#F5F7FA]">
              01. Uniform Gap Capacity Across Every Paper Size
            </h2>
            <p className="text-sm text-[#94A3B8] mt-1 max-w-2xl">
              Every sheet uses the exact same{" "}
              <span className="font-mono-nums font-semibold text-[#00E5FF]">
                {gapMm} mm ({gapPx} px)
              </span>{" "}
              horizontal and vertical cut gap at 300 PPI, automatically picking
              Portrait or Landscape to fit the maximum photos cleanly.
            </p>
          </div>
          <div className="text-xs text-[#00E5FF] font-mono-nums whitespace-nowrap">
            Active Crop: {activeTileW} × {activeTileH} px @ 300 PPI
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="border-b border-[#00E5FF]/15 text-xs text-[#94A3B8]">
                <th className="py-3 pr-4 font-semibold">Paper Size</th>
                <th className="py-3 px-4 font-semibold">300 PPI Pixels</th>
                <th className="py-3 px-4 font-semibold text-right">
                  1.2 × 1.5 in
                </th>
                <th className="py-3 px-4 font-semibold text-right">
                  35 × 45 mm
                </th>
                <th className="py-3 px-4 font-semibold text-right">
                  2 × 2 in
                </th>
                <th className="py-3 px-4 font-semibold text-right">
                  Active Crop Grid
                </th>
                <th className="py-3 pl-4 font-semibold text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {paperKeys.map((pk) => {
                const p = PAPER_SIZES[pk];
                const l12 = calculateSheetLayout(p.w, p.h, 360, 450, gapPx);
                const l35 = calculateSheetLayout(p.w, p.h, 413, 531, gapPx);
                const l22 = calculateSheetLayout(p.w, p.h, 600, 600, gapPx);
                const lActive = calculateSheetLayout(
                  p.w,
                  p.h,
                  activeTileW,
                  activeTileH,
                  gapPx
                );

                return (
                  <tr
                    key={pk}
                    className="hover:bg-[#00E5FF]/5 transition-colors"
                  >
                    <td className="py-3.5 pr-4 font-semibold text-[#F5F7FA] whitespace-nowrap">
                      {p.label}
                    </td>
                    <td className="py-3.5 px-4 font-mono-nums text-[#94A3B8] whitespace-nowrap">
                      {p.dimensionsText}
                    </td>
                    <td className="py-3.5 px-4 font-mono-nums text-right text-[#F5F7FA] font-semibold whitespace-nowrap">
                      {l12.count} ({l12.cols}×{l12.rows})
                    </td>
                    <td className="py-3.5 px-4 font-mono-nums text-right text-[#E2E8F0] whitespace-nowrap">
                      {l35.count} ({l35.cols}×{l35.rows})
                    </td>
                    <td className="py-3.5 px-4 font-mono-nums text-right text-[#E2E8F0] whitespace-nowrap">
                      {l22.count} ({l22.cols}×{l22.rows})
                    </td>
                    <td className="py-3.5 px-4 font-mono-nums text-right text-[#00E5FF] font-semibold whitespace-nowrap">
                      {lActive.count} · {lActive.orientation}
                    </td>
                    <td className="py-3.5 pl-4 text-right whitespace-nowrap">
                      <button
                        type="button"
                        disabled={!hasImage}
                        onClick={() => onSelectPaperAndDownload?.(pk)}
                        className="text-xs font-semibold text-[#00E5FF] hover:text-[#F5F7FA] disabled:text-slate-600 disabled:cursor-not-allowed underline underline-offset-4 cursor-pointer"
                      >
                        Download {p.shortLabel}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {/* Studio Features & Direct Share Configuration */}
      <section
        id="print-services"
        className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start"
      >
        <div className="lg:col-span-8 glass-card p-4 sm:p-6 lg:p-8">
          <h2 className="text-xl sm:text-2xl font-bold text-[#F5F7FA] mb-5 sm:mb-6">
            02. Studio Standards for {BRAND_NAME}
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div className="flex gap-3.5">
              <Printer className="w-5 h-5 text-[#00E5FF] shrink-0 mt-0.5" />
              <div>
                <h3 className="font-semibold text-[#F5F7FA] text-sm">
                  True 300 PPI Embedded Metadata
                </h3>
                <p className="text-sm text-[#94A3B8] mt-1">
                  Every JPEG carries an explicit 300 PPI JFIF header so
                  Photoshop, CorelDRAW, and photo lab printers print exact inch
                  and mm dimensions without manual scaling.
                </p>
              </div>
            </div>

            <div className="flex gap-3.5">
              <Scissors className="w-5 h-5 text-[#00E5FF] shrink-0 mt-0.5" />
              <div>
                <h3 className="font-semibold text-[#F5F7FA] text-sm">
                  Multi-Photo Sheet Tiling
                </h3>
                <p className="text-sm text-[#94A3B8] mt-1">
                  Add multiple different customer photos onto one 4×6 or A4
                  sheet, adjust individual copy counts, and keep the exact same
                  cutting gap between every photo.
                </p>
              </div>
            </div>

            <div className="flex gap-3.5">
              <Sliders className="w-5 h-5 text-[#8B5CF6] shrink-0 mt-0.5" />
              <div>
                <h3 className="font-semibold text-[#F5F7FA] text-sm">
                  Indian Portal KB &amp; DOP Compliance
                </h3>
                <p className="text-sm text-[#94A3B8] mt-1">
                  Built-in binary search JPEG compression keeps files under 20
                  KB or 50 KB with optional candidate name and date-of-photo
                  strips for SSC, UPSC, and Passport Seva.
                </p>
              </div>
            </div>

            <div className="flex gap-3.5">
              <CheckCircle2 className="w-5 h-5 text-[#00E5FF] shrink-0 mt-0.5" />
              <div>
                <h3 className="font-semibold text-[#F5F7FA] text-sm">
                  100% On-Device Privacy
                </h3>
                <p className="text-sm text-[#94A3B8] mt-1">
                  All cropping, brightness tuning, AI background removal, and
                  sheet tiling run directly in your browser. Photos are never
                  uploaded to any external server.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Mail Desk, Theme & Direct Share Setup */}
        <div className="lg:col-span-4 glass-card p-4 sm:p-6 lg:p-8 space-y-4">
          <div className="flex items-center gap-2 text-[#F5F7FA] font-bold text-base">
            <Mail className="w-5 h-5 text-[#00E5FF] shrink-0" />
            <span>Mail Desk &amp; Studio Setup</span>
          </div>
          <p className="text-sm text-[#94A3B8]">
            Configure the email address used for{" "}
            <strong className="font-semibold text-[#F5F7FA]">
              Mail Desk Queries
            </strong>{" "}
            and customize your interactive studio accent.
          </p>

          <div className="space-y-2">
            <label
              htmlFor="support-email-input"
              className="block text-xs font-semibold text-[#E2E8F0]"
            >
              Print Desk Email (for Queries)
            </label>
            <input
              id="support-email-input"
              type="email"
              value={supportEmail}
              onChange={(e) => onChangeSupportEmail(e.target.value)}
              placeholder="studio@example.com"
              className="w-full bg-[#080B12] border border-[#00E5FF]/20 rounded-lg px-3 py-2 text-sm text-[#F5F7FA] focus:outline-none focus:ring-2 focus:ring-[#00E5FF]"
            />
            <div className="text-[11px] text-[#94A3B8] flex flex-wrap items-center justify-between gap-1.5">
              <span>Support Mail:</span>
              <button
                type="button"
                onClick={() => onChangeSupportEmail(OFFICIAL_SUPPORT_EMAIL)}
                className="font-mono-nums text-[#00E5FF] hover:underline break-all text-left cursor-pointer"
                title="Use official Support Mail as active query desk"
              >
                {OFFICIAL_SUPPORT_EMAIL}
              </button>
            </div>
          </div>

          <div>
            <span className="block text-xs font-semibold text-[#E2E8F0] mb-1.5">
              Customize Studio Theme Accent
            </span>
            <div className="grid grid-cols-2 gap-1.5">
              {(Object.keys(STUDIO_ACCENTS) as StudioAccentKey[]).map((key) => {
                const item = STUDIO_ACCENTS[key];
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => onChangeStudioAccent(key)}
                    className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg border text-xs font-medium cursor-pointer transition-colors ${
                      studioAccent === key
                        ? "border-[#00E5FF] bg-[#00E5FF]/15 font-semibold text-[#F5F7FA]"
                        : "border-[#00E5FF]/15 bg-[#080B12]/60 text-[#94A3B8] hover:border-[#00E5FF]/40"
                    }`}
                  >
                    <span
                      className="w-3.5 h-3.5 rounded-full shrink-0"
                      style={{ backgroundColor: item.swatch }}
                    />
                    <span className="truncate">{item.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label
              htmlFor="zerozeros-url-input"
              className="block text-xs font-semibold text-[#E2E8F0] mb-1.5"
            >
              ZeroZeros Portal / Share Link (Optional)
            </label>
            <input
              id="zerozeros-url-input"
              type="url"
              value={zeroZerosUrl}
              onChange={(e) => onChangeZeroZerosUrl(e.target.value)}
              placeholder="https://zerozeros.in or custom desk URL"
              className="w-full bg-[#080B12] border border-[#00E5FF]/20 rounded-lg px-3 py-2 text-sm text-[#F5F7FA] focus:outline-none focus:ring-2 focus:ring-[#00E5FF]"
            />
            <p className="text-xs text-[#94A3B8] mt-1.5">
              Leave blank to use the device&apos;s native file share sheet, or
              enter your ZeroZeros URL to open it directly.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
