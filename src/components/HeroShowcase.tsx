import {
  ArrowDown,
  ArrowLeftRight,
  ArrowRight,
  Briefcase,
  FileText,
  Image as ImageIcon,
  Sliders,
  Sparkles,
} from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import heroPrintImg from "../assets/images/hero_print_studio_1794673000273.jpg";
import { WebsiteSettings } from "../types/cms";
import { BRAND_NAME } from "../types/photo";

export type WorkspaceMode =
  | "passport"
  | "enhance"
  | "xerox"
  | "converters"
  | "resume";

interface HeroShowcaseProps {
  onJumpToStudio: () => void;
  workspaceMode: WorkspaceMode;
  onSelectWorkspaceMode: (mode: WorkspaceMode) => void;
  cmsSettings?: WebsiteSettings;
}

const PARTICLES = [
  { top: "16%", left: "12%", size: 4, delay: 0 },
  { top: "28%", left: "82%", size: 5, delay: 0.7 },
  { top: "64%", left: "18%", size: 3, delay: 1.4 },
  { top: "48%", left: "88%", size: 4, delay: 2.1 },
  { top: "76%", left: "66%", size: 3, delay: 0.9 },
];

const WORKSPACE_TABS: Array<{
  id: WorkspaceMode;
  label: string;
  icon: typeof ImageIcon;
}> = [
  { id: "passport", label: "Passport Photo Studio", icon: ImageIcon },
  { id: "enhance", label: "AI Photo Enhance", icon: Sparkles },
  { id: "xerox", label: "Aadhaar / PAN / ID Xerox", icon: FileText },
  { id: "converters", label: "PDF, XML & Text", icon: ArrowLeftRight },
  { id: "resume", label: "Resume Maker", icon: Briefcase },
];

export function HeroShowcase({
  onJumpToStudio,
  workspaceMode,
  onSelectWorkspaceMode,
  cmsSettings,
}: HeroShowcaseProps) {
  const prefersReducedMotion = useReducedMotion();

  const heroImage = cmsSettings?.heroBgImageUrl?.trim() || heroPrintImg;
  const heroEyebrow =
    cmsSettings?.heroEyebrow?.trim() ||
    `${BRAND_NAME} · Precision Digital Print Studio`;
  const headlineTop = cmsSettings?.heroHeadlineTop?.trim() || "BRING YOUR";
  const headlineHighlight =
    cmsSettings?.heroHeadlineHighlight?.trim() || "CREATIVITY";
  const headlineBottom = cmsSettings?.heroHeadlineBottom?.trim() || "TO LIFE.";
  const subtitle =
    cmsSettings?.heroSubtitle?.trim() ||
    `Premium printing. Exceptional design. Unlimited creativity. Transform your ideas into stunning visual experiences with ${BRAND_NAME}.`;
  const primaryLabel =
    cmsSettings?.heroPrimaryCtaLabel?.trim() || "Explore Our Services";
  const primaryHref = cmsSettings?.heroPrimaryCtaHref?.trim() || "#services";
  const secondaryLabel =
    cmsSettings?.heroSecondaryCtaLabel?.trim() || "Get a Free Quote";
  const secondaryHref = cmsSettings?.heroSecondaryCtaHref?.trim() || "#quote";

  return (
    <section
      id="home"
      className="relative min-h-[calc(100vh-4rem)] flex flex-col justify-between overflow-hidden bg-[#080B12] border-b border-[#00E5FF]/15"
    >
      {/* Background Photography with Slow Cinematic Zoom */}
      <motion.div
        aria-hidden="true"
        className="absolute inset-0 z-0"
        initial={prefersReducedMotion ? false : { scale: 1.02 }}
        animate={prefersReducedMotion ? undefined : { scale: 1.09 }}
        transition={{
          duration: 18,
          repeat: Infinity,
          repeatType: "reverse",
          ease: "easeInOut",
        }}
      >
        <img
          src={heroImage}
          alt="SUN-NOVA PRINT SERVICE futuristic wide-format digital printing machine"
          referrerPolicy="no-referrer"
          className="w-full h-full object-cover object-center opacity-45"
        />
      </motion.div>

      {/* Dark Scrim, Futuristic Grid & Atmospheric Glow */}
      <div
        aria-hidden="true"
        className="absolute inset-0 z-0 bg-gradient-to-b from-[#080B12]/80 via-[#080B12]/70 to-[#080B12]"
      />
      <div
        aria-hidden="true"
        className="absolute inset-0 z-0 bg-[radial-gradient(ellipse_at_center,rgba(8,11,18,0.25)_0%,rgba(8,11,18,0.88)_100%)]"
      />
      <div
        aria-hidden="true"
        className="absolute inset-0 z-0 futuristic-grid-bg opacity-60"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-20 left-1/4 w-[320px] sm:w-[440px] h-[320px] sm:h-[440px] rounded-full bg-[#00E5FF]/12 blur-[125px]"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute bottom-0 right-1/5 w-[300px] sm:w-[420px] h-[300px] sm:h-[420px] rounded-full bg-[#8B5CF6]/15 blur-[130px]"
      />

      {/* Floating Ambient Light Particles */}
      {!prefersReducedMotion &&
        PARTICLES.map((p, idx) => (
          <motion.span
            key={idx}
            aria-hidden="true"
            className="pointer-events-none absolute rounded-full bg-[#00E5FF]"
            style={{
              top: p.top,
              left: p.left,
              width: p.size,
              height: p.size,
              boxShadow: "0 0 12px rgba(0, 229, 255, 0.8)",
            }}
            animate={{ y: [-10, 10, -10], opacity: [0.25, 0.75, 0.25] }}
            transition={{
              duration: 5 + idx,
              delay: p.delay,
              repeat: Infinity,
              ease: "easeInOut",
            }}
          />
        ))}

      {/* Main Centered Hero + Unified Workbench Header */}
      <div className="relative z-10 max-w-6xl mx-auto w-full flex-1 flex flex-col justify-center px-4 sm:px-6 pt-8 pb-6 sm:pt-11 sm:pb-8 lg:pt-12 lg:pb-8">
        <motion.div
          initial={prefersReducedMotion ? false : { opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.65, ease: [0.16, 1, 0.3, 1] }}
          className="w-full text-center"
        >
          <p className="text-[11px] sm:text-xs font-mono-nums tracking-[0.18em] sm:tracking-[0.22em] text-[#00E5FF] mb-3 sm:mb-4 uppercase">
            {heroEyebrow}
          </p>

          <h1
            className="text-3xl sm:text-5xl lg:text-[52px] xl:text-[62px] font-extrabold tracking-tight leading-[1.08] text-[#F5F7FA] max-w-6xl mx-auto"
            style={{ textWrap: "balance" }}
          >
            <span>{headlineTop}</span>{" "}
            <span className="bg-gradient-to-r from-[#00E5FF] via-[#7DD3FC] to-[#8B5CF6] bg-clip-text text-transparent drop-shadow-[0_0_24px_rgba(0,229,255,0.3)]">
              {headlineHighlight}
            </span>{" "}
            <span>{headlineBottom}</span>
          </h1>

          <p className="mt-4 sm:mt-5 text-sm sm:text-base text-[#94A3B8] max-w-2xl mx-auto leading-relaxed">
            {subtitle.includes(BRAND_NAME) ? (
              <>
                {subtitle.split(BRAND_NAME)[0]}
                <strong className="text-[#F5F7FA] font-semibold">
                  {BRAND_NAME}
                </strong>
                {subtitle.split(BRAND_NAME).slice(1).join(BRAND_NAME)}
              </>
            ) : (
              subtitle
            )}
          </p>

          <div className="mt-6 sm:mt-7 flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center justify-center gap-3">
            <a
              href={primaryHref}
              className="inline-flex items-center justify-center gap-2 bg-gradient-to-r from-[#00E5FF] to-[#8B5CF6] text-[#080B12] font-bold text-sm px-6 py-3 rounded-xl shadow-[0_0_28px_rgba(0,229,255,0.28)] hover:brightness-110 transition-all whitespace-nowrap shrink-0"
            >
              <span>{primaryLabel}</span>
              <ArrowRight className="w-4 h-4" />
            </a>

            <a
              href={secondaryHref}
              className="inline-flex items-center justify-center gap-2 bg-[#111827]/75 backdrop-blur-xl text-[#F5F7FA] border border-[#00E5FF]/30 hover:border-[#00E5FF]/70 hover:shadow-[0_0_20px_rgba(0,229,255,0.2)] font-semibold text-sm px-6 py-3 rounded-xl transition-all whitespace-nowrap shrink-0"
            >
              <Sparkles className="w-4 h-4 text-[#00E5FF]" />
              <span>{secondaryLabel}</span>
            </a>

            <button
              type="button"
              onClick={onJumpToStudio}
              className="inline-flex items-center justify-center gap-2 bg-[#161D2B]/85 hover:bg-[#1E273B] text-[#E2E8F0] border border-white/15 hover:border-[#8B5CF6]/50 font-semibold text-sm px-5 py-3 rounded-xl transition-all cursor-pointer whitespace-nowrap shrink-0"
            >
              <Sliders className="w-4 h-4 text-[#8B5CF6]" />
              <span>Open 300 PPI Studio</span>
            </button>
          </div>

          {/* Centered Studio Workbench Intro + 5-Tab Mode Switcher */}
          <div className="mt-8 sm:mt-9 max-w-5xl mx-auto">
            <div className="text-[11px] sm:text-xs font-mono-nums uppercase tracking-[0.14em] sm:tracking-[0.16em] text-[#00E5FF] leading-relaxed">
              <div>
                300 PPI INTERACTIVE STUDIO · AI PHOTO ENHANCE (HD/4K) ·
              </div>
              <div>AADHAAR | PAN XEROX · RESUME &amp; PDF STUDIO</div>
            </div>

            <h2
              className="mt-2 text-2xl sm:text-3xl lg:text-[36px] font-extrabold tracking-tight text-[#F5F7FA] leading-tight"
              style={{ textWrap: "balance" }}
            >
              Passport Photo Maker, AI Enhance &amp; Print Workbench
            </h2>

            <p className="mt-2.5 text-xs sm:text-sm md:text-[15px] text-[#CBD5E1] max-w-3xl mx-auto leading-relaxed">
              Crop to 1.2 × 1.5 in or 35 × 45 mm at 300 PPI, upscale &amp; restore
              photos in AI Photo Enhance Studio, print Aadhaar &amp; PAN Xerox
              sheets, convert PDFs/OCR, or build a Resume.
            </p>

            <div
              role="tablist"
              aria-label="Studio Workspace Modes"
              className="mt-5 sm:mt-6 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-1.5 p-1.5 bg-[#0D131F]/90 backdrop-blur-xl border border-[#00E5FF]/22 rounded-xl shadow-[0_10px_35px_rgba(0,0,0,0.45)] w-full"
            >
              {WORKSPACE_TABS.map((tab) => {
                const Icon = tab.icon;
                const active = workspaceMode === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    onClick={() => onSelectWorkspaceMode(tab.id)}
                    className={`inline-flex items-center justify-center gap-1.5 px-2 md:px-2.5 lg:px-3 py-2 sm:py-2.5 text-[11px] sm:text-xs lg:text-sm rounded-lg transition-all cursor-pointer min-h-[40px] sm:min-h-[42px] whitespace-nowrap ${
                      active
                        ? "bg-gradient-to-r from-[#00E5FF] to-[#8B5CF6] text-[#080B12] font-bold shadow-[0_0_20px_rgba(0,229,255,0.28)]"
                        : "text-[#94A3B8] hover:text-[#F5F7FA] hover:bg-white/5 font-semibold"
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
                    <span className="truncate">{tab.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </motion.div>

        {/* Bottom-Left Scroll Indicator */}
        <div className="mt-7 sm:mt-8 flex items-center justify-start">
          <motion.a
            href="#studio-workbench"
            aria-label="Scroll to interactive studio"
            className="inline-flex items-center gap-2 text-xs font-mono-nums text-[#94A3B8] hover:text-[#00E5FF] transition-colors"
            animate={prefersReducedMotion ? undefined : { y: [0, 5, 0] }}
            transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
          >
            <ArrowDown className="w-4 h-4 text-[#00E5FF]" />
            <span>Scroll to interactive studio &amp; services</span>
          </motion.a>
        </div>
      </div>
    </section>
  );
}

