import { ArrowDown, ArrowRight, Sparkles, Sliders } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import heroPrintImg from "../assets/images/hero_print_studio_1794673000273.jpg";
import { BRAND_NAME } from "../types/photo";

interface HeroShowcaseProps {
  onJumpToStudio: () => void;
}

const PARTICLES = [
  { top: "18%", left: "12%", size: 4, delay: 0 },
  { top: "32%", left: "78%", size: 5, delay: 0.7 },
  { top: "64%", left: "24%", size: 3, delay: 1.4 },
  { top: "52%", left: "86%", size: 4, delay: 2.1 },
  { top: "76%", left: "62%", size: 3, delay: 0.9 },
];

export function HeroShowcase({ onJumpToStudio }: HeroShowcaseProps) {
  const prefersReducedMotion = useReducedMotion();

  return (
    <section
      id="home"
      className="relative min-h-[88vh] flex items-center overflow-hidden bg-[#080B12] border-b border-[#00E5FF]/15"
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
          src={heroPrintImg}
          alt="SUN-NOVA PRINT SERVICE futuristic wide-format digital printing machine"
          referrerPolicy="no-referrer"
          className="w-full h-full object-cover object-center opacity-50"
        />
      </motion.div>

      {/* Dark Scrim, Futuristic Grid & Atmospheric Glow */}
      <div
        aria-hidden="true"
        className="absolute inset-0 z-0 bg-gradient-to-b from-[#080B12]/80 via-[#080B12]/65 to-[#080B12]"
      />
      <div
        aria-hidden="true"
        className="absolute inset-0 z-0 bg-gradient-to-r from-[#080B12]/95 via-[#080B12]/65 to-transparent"
      />
      <div
        aria-hidden="true"
        className="absolute inset-0 z-0 futuristic-grid-bg opacity-65"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-24 -left-24 w-[440px] h-[440px] rounded-full bg-[#00E5FF]/12 blur-[120px]"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute bottom-0 right-0 w-[420px] h-[420px] rounded-full bg-[#8B5CF6]/15 blur-[130px]"
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

      {/* Main Content */}
      <div className="relative z-10 max-w-7xl mx-auto w-full px-4 sm:px-6 py-20 lg:py-28">
        <motion.div
          initial={prefersReducedMotion ? false : { opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.65, ease: [0.16, 1, 0.3, 1] }}
          className="max-w-3xl"
        >
          <p className="text-xs sm:text-sm font-mono-nums tracking-[0.2em] text-[#00E5FF] mb-5 uppercase">
            {BRAND_NAME} · Precision Digital Print Studio
          </p>

          <h1
            className="text-4xl sm:text-6xl lg:text-7xl font-extrabold tracking-tight leading-[1.03] text-[#F5F7FA]"
            style={{ textWrap: "balance" }}
          >
            BRING YOUR
            <br />
            <span className="bg-gradient-to-r from-[#00E5FF] via-[#7DD3FC] to-[#8B5CF6] bg-clip-text text-transparent drop-shadow-[0_0_24px_rgba(0,229,255,0.3)]">
              CREATIVITY
            </span>
            <br />
            TO LIFE.
          </h1>

          <p className="mt-6 text-base sm:text-lg text-[#94A3B8] max-w-2xl leading-relaxed">
            Premium printing. Exceptional design. Unlimited creativity.
            Transform your ideas into stunning visual experiences with{" "}
            <span className="text-[#F5F7FA] font-semibold">{BRAND_NAME}</span>.
          </p>

          <div className="mt-8 flex flex-wrap items-center gap-3.5">
            <a
              href="#services"
              className="inline-flex items-center gap-2 bg-gradient-to-r from-[#00E5FF] to-[#8B5CF6] text-[#080B12] font-bold text-sm px-6 py-3.5 rounded-xl shadow-[0_0_28px_rgba(0,229,255,0.28)] hover:brightness-110 transition-all whitespace-nowrap shrink-0"
            >
              <span>Explore Our Services</span>
              <ArrowRight className="w-4 h-4" />
            </a>

            <a
              href="#quote"
              className="inline-flex items-center gap-2 bg-[#111827]/75 backdrop-blur-xl text-[#F5F7FA] border border-[#00E5FF]/30 hover:border-[#00E5FF]/70 hover:shadow-[0_0_20px_rgba(0,229,255,0.2)] font-semibold text-sm px-6 py-3.5 rounded-xl transition-all whitespace-nowrap shrink-0"
            >
              <Sparkles className="w-4 h-4 text-[#00E5FF]" />
              <span>Get a Free Quote</span>
            </a>

            <button
              type="button"
              onClick={onJumpToStudio}
              className="inline-flex items-center gap-2 bg-[#161D2B]/80 hover:bg-[#1E273B] text-[#E2E8F0] border border-white/10 hover:border-[#8B5CF6]/50 font-semibold text-sm px-5 py-3.5 rounded-xl transition-all cursor-pointer whitespace-nowrap shrink-0"
            >
              <Sliders className="w-4 h-4 text-[#8B5CF6]" />
              <span>Open 300 PPI Studio</span>
            </button>
          </div>
        </motion.div>

        {/* Scroll Indicator */}
        <motion.a
          href="#studio-workbench"
          aria-label="Scroll to interactive studio"
          className="mt-14 inline-flex items-center gap-2 text-xs font-mono-nums text-[#94A3B8] hover:text-[#00E5FF] transition-colors"
          animate={prefersReducedMotion ? undefined : { y: [0, 6, 0] }}
          transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
        >
          <ArrowDown className="w-4 h-4 text-[#00E5FF]" />
          <span>Scroll to interactive studio &amp; services</span>
        </motion.a>
      </div>
    </section>
  );
}
