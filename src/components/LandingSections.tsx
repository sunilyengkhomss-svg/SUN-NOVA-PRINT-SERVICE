import React, { useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  Award,
  BadgeCheck,
  BookOpen,
  Camera,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CreditCard,
  FileCheck2,
  FileImage,
  FileText,
  Flag,
  Layers,
  LayoutGrid,
  Mail,
  Maximize2,
  Package,
  Palette,
  PenTool,
  Printer,
  Quote,
  Send,
  ShieldCheck,
  Shirt,
  Sparkles,
  Sticker,
  Upload,
  X,
} from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import aboutAtelierImg from "../assets/images/about_creative_atelier_1794673002411.jpg";
import heroPrintImg from "../assets/images/hero_print_studio_1794673000273.jpg";
import serviceCardsImg from "../assets/images/service_business_cards_1794673000584.jpg";
import serviceLargeFormatImg from "../assets/images/service_large_format_1794673000530.jpg";
import serviceMerchImg from "../assets/images/service_packaging_merch_1794673001916.jpg";
import {
  PortfolioItemRecord,
  ServiceRecord,
  WebsiteSettings,
} from "../types/cms";
import { BRAND_NAME, OFFICIAL_SUPPORT_EMAIL } from "../types/photo";
import { submitPublicContact, submitPublicQuote } from "../utils/adminApi";

interface LandingSectionsProps {
  supportEmail: string;
  onOpenMailModal: (subject?: string, body?: string) => void;
  onLaunchStudioMode: (mode: "passport" | "xerox" | "converters" | "resume") => void;
  cmsSettings?: WebsiteSettings;
  cmsServices?: ServiceRecord[];
  cmsPortfolio?: PortfolioItemRecord[];
}

interface PrintServiceItem {
  id: string;
  name: string;
  description: string;
  image: string;
  icon: React.ComponentType<{ className?: string }>;
  studioMode?: "passport" | "xerox" | "converters" | "resume";
}

function getServiceVisuals(id: string, name: string) {
  const key = `${id} ${name}`.toLowerCase();
  if (key.includes("business card") || key.includes("brochure") || key.includes("invitation")) {
    return {
      icon: key.includes("brochure") ? BookOpen : key.includes("invitation") ? Mail : CreditCard,
      image: serviceCardsImg,
    };
  }
  if (key.includes("banner") || key.includes("poster") || key.includes("large")) {
    return {
      icon: key.includes("poster") ? FileImage : key.includes("large") ? Printer : Flag,
      image: serviceLargeFormatImg,
    };
  }
  if (key.includes("flex") || key.includes("vinyl")) {
    return {
      icon: key.includes("flex") ? Maximize2 : Layers,
      image: heroPrintImg,
    };
  }
  if (key.includes("sticker") || key.includes("shirt") || key.includes("logo") || key.includes("id")) {
    return {
      icon: key.includes("sticker")
        ? Sticker
        : key.includes("shirt")
        ? Shirt
        : key.includes("logo")
        ? Palette
        : BadgeCheck,
      image: serviceMerchImg,
    };
  }
  if (key.includes("photo") || key.includes("passport")) {
    return { icon: Camera, image: aboutAtelierImg };
  }
  if (key.includes("flyer") || key.includes("graphic")) {
    return {
      icon: key.includes("graphic") ? PenTool : FileText,
      image: aboutAtelierImg,
    };
  }
  return { icon: Printer, image: serviceLargeFormatImg };
}

function getPortfolioFallbackImage(category: string, index: number): string {
  const c = category.toLowerCase();
  if (c.includes("business") || c.includes("graphic")) return serviceCardsImg;
  if (c.includes("poster")) return serviceLargeFormatImg;
  if (c.includes("packag") || c.includes("custom")) return serviceMerchImg;
  if (c.includes("banner")) return heroPrintImg;
  if (c.includes("brand")) return aboutAtelierImg;
  return [serviceCardsImg, serviceLargeFormatImg, serviceMerchImg, heroPrintImg][
    index % 4
  ];
}

const PRINTING_SERVICES: PrintServiceItem[] = [
  {
    id: "business-cards",
    name: "Business Card Printing",
    description:
      "Heavy matte, textured cotton, and metallic foil-accented cards built for executive first impressions.",
    image: serviceCardsImg,
    icon: CreditCard,
  },
  {
    id: "banner-printing",
    name: "Banner Printing",
    description:
      "High-opacity weather-resistant event, storefront, and stage banners with razor-sharp typography.",
    image: serviceLargeFormatImg,
    icon: Flag,
  },
  {
    id: "flex-printing",
    name: "Flex Printing",
    description:
      "Durable outdoor frontlit and backlit flex signage engineered for long-range outdoor visibility.",
    image: heroPrintImg,
    icon: Maximize2,
  },
  {
    id: "poster-printing",
    name: "Poster Printing",
    description:
      "Gallery-grade satin and gloss promotional posters with rich saturated blacks and vivid highlights.",
    image: serviceLargeFormatImg,
    icon: FileImage,
  },
  {
    id: "flyer-printing",
    name: "Flyer Printing",
    description:
      "Crisp promotional handbills and campaign mailers on calibrated coated paper stocks.",
    image: aboutAtelierImg,
    icon: FileText,
  },
  {
    id: "brochure-printing",
    name: "Brochure Printing",
    description:
      "Bi-fold and tri-fold corporate brochures with clean scoring and color-consistent photography.",
    image: serviceCardsImg,
    icon: BookOpen,
  },
  {
    id: "sticker-printing",
    name: "Sticker Printing",
    description:
      "Custom die-cut waterproof vinyl and holographic brand stickers for packaging and gear.",
    image: serviceMerchImg,
    icon: Sticker,
  },
  {
    id: "vinyl-printing",
    name: "Vinyl Printing",
    description:
      "Self-adhesive matte and clear architectural vinyl graphics for glass, walls, and vehicle wraps.",
    image: heroPrintImg,
    icon: Layers,
  },
  {
    id: "photo-printing",
    name: "Photo Printing",
    description:
      "True 300 PPI archival passport photos, studio portraits, and uniform-gap photo sheets.",
    image: aboutAtelierImg,
    icon: Camera,
    studioMode: "passport",
  },
  {
    id: "tshirt-printing",
    name: "T-Shirt Printing",
    description:
      "High-definition DTF and heat-transfer custom apparel printing built to withstand repeated washes.",
    image: serviceMerchImg,
    icon: Shirt,
  },
  {
    id: "invitation-cards",
    name: "Invitation Card Printing",
    description:
      "Bespoke ceremonial, corporate gala, and wedding invitations on heavyweight specialty stock.",
    image: serviceCardsImg,
    icon: Mail,
  },
  {
    id: "custom-graphic-design",
    name: "Custom Graphic Design",
    description:
      "Print-ready artwork layout, pre-press color separation, and campaign visual composition.",
    image: aboutAtelierImg,
    icon: PenTool,
  },
  {
    id: "logo-design",
    name: "Logo Design",
    description:
      "Scalable vector brand identities engineered to stay crisp from micro business cards to billboards.",
    image: serviceMerchImg,
    icon: Palette,
  },
  {
    id: "id-card-printing",
    name: "ID Card Printing",
    description:
      "CR80 laminated employee badges, visitor passes, and Aadhaar/PAN smart sheet layouts.",
    image: serviceMerchImg,
    icon: BadgeCheck,
    studioMode: "xerox",
  },
  {
    id: "large-format-printing",
    name: "Large Format Printing",
    description:
      "Architectural boards, trade-show backdrops, and exhibition displays up to wide-format rolls.",
    image: serviceLargeFormatImg,
    icon: Printer,
  },
];

type PortfolioCategory =
  | "All"
  | "Branding"
  | "Business Cards"
  | "Banners"
  | "Posters"
  | "Packaging"
  | "Graphic Design"
  | "Custom Printing";

const PORTFOLIO_CATEGORIES: PortfolioCategory[] = [
  "All",
  "Branding",
  "Business Cards",
  "Banners",
  "Posters",
  "Packaging",
  "Graphic Design",
  "Custom Printing",
];

interface PortfolioWork {
  id: string;
  title: string;
  category: Exclude<PortfolioCategory, "All">;
  subtitle: string;
  image: string;
}

const PORTFOLIO_WORKS: PortfolioWork[] = [
  {
    id: "pf-1",
    title: "Monolith Foil Stationery Suite",
    category: "Business Cards",
    subtitle: "Cyan metallic edge foil on 400gsm obsidian cotton stock",
    image: serviceCardsImg,
  },
  {
    id: "pf-2",
    title: "Futurism Wide-Format Exhibition",
    category: "Posters",
    subtitle: "Wide-gamut UV pigment output on matte exhibition film",
    image: serviceLargeFormatImg,
  },
  {
    id: "pf-3",
    title: "Aurora Structural Packaging & Apparel",
    category: "Packaging",
    subtitle: "Rigid matte gift box, die-cut decals, and DTF jersey print",
    image: serviceMerchImg,
  },
  {
    id: "pf-4",
    title: "Spectra Industrial Vinyl Roll",
    category: "Banners",
    subtitle: "High-contrast storefront and backdrop flex installation",
    image: heroPrintImg,
  },
  {
    id: "pf-5",
    title: "Atelier Brand System & Swatch Calibration",
    category: "Branding",
    subtitle: "Vector identity system with full CMYK press specifications",
    image: aboutAtelierImg,
  },
  {
    id: "pf-6",
    title: "Cybernetic Die-Cut Sticker & Badge Kit",
    category: "Custom Printing",
    subtitle: "Holographic laminated vinyl decals & CR80 staff access badges",
    image: serviceMerchImg,
  },
  {
    id: "pf-7",
    title: "Editorial Tri-Fold & Gala Invite System",
    category: "Graphic Design",
    subtitle: "Precision layout architecture & dark-ink spot varnishing",
    image: serviceCardsImg,
  },
];

const WORKFLOW_STEPS = [
  {
    step: "Step 01",
    title: "Choose Your Service",
    desc: "Pick any of our 15 studio print or design specialties—or configure 300 PPI photos and ID cards directly.",
    icon: LayoutGrid,
  },
  {
    step: "Step 02",
    title: "Upload Your Design",
    desc: "Attach your print-ready PDF, PNG, JPG, or vector artwork along with your size, stock, and finish preferences.",
    icon: Upload,
  },
  {
    step: "Step 03",
    title: "Approve Your Preview",
    desc: "Review pre-press proportions, crop guides, and print desk specifications cleanly before production starts.",
    icon: FileCheck2,
  },
  {
    step: "Step 04",
    title: "Print & Deliver",
    desc: "Produced on calibrated digital and large-format presses with sharp color accuracy and dependable turnaround.",
    icon: Printer,
  },
];

const STUDIO_BENCHMARKS = [
  {
    title: "True 300 PPI Calibration & Edge Sharpness",
    detail:
      "Every passport sheet, ID card, and studio print embeds explicit 300 PPI physical scaling so lab printers and commercial presses reproduce dimensions with zero distortion.",
    tag: "Verified Print Standard · Pre-Press Verified",
  },
  {
    title: "Privacy-First Artwork & Document Workflow",
    detail:
      "Personal portraits, ID scans, PDF conversions, and resume renders process locally in browser memory—your sensitive documents stay under your control.",
    tag: "On-Device Security · Direct Mail Quotation",
  },
  {
    title: "Wide-Format Color & Finishing Discipline",
    detail:
      "From heavy 400gsm matte stationery and metallic foil accents to vibrant flex banners and waterproof vinyl decals, every run undergoes visual inspection.",
    tag: "Commercial Quality Control · Color Inspected",
  },
];

export function LandingSections({
  supportEmail,
  onOpenMailModal,
  onLaunchStudioMode,
  cmsSettings,
  cmsServices,
  cmsPortfolio,
}: LandingSectionsProps) {
  const prefersReducedMotion = useReducedMotion();

  const resolvedServices: PrintServiceItem[] = useMemo(() => {
    if (!cmsServices || cmsServices.length === 0) return PRINTING_SERVICES;
    return cmsServices
      .filter((s) => s.is_published !== 0)
      .map((s) => {
        const fallback = getServiceVisuals(s.id, s.name);
        return {
          id: s.id,
          name: s.name,
          description: s.description,
          image: s.image_url?.trim() || fallback.image,
          icon: fallback.icon,
          studioMode: s.studio_mode || undefined,
        };
      });
  }, [cmsServices]);

  const resolvedPortfolio = useMemo(() => {
    if (!cmsPortfolio || cmsPortfolio.length === 0) return PORTFOLIO_WORKS;
    return cmsPortfolio
      .filter((p) => p.is_published !== 0)
      .map((p, idx) => ({
        id: p.id,
        title: p.title,
        category: p.category as Exclude<PortfolioCategory, "All">,
        subtitle: p.subtitle,
        image: p.image_url?.trim() || getPortfolioFallbackImage(p.category, idx),
      }));
  }, [cmsPortfolio]);

  const portfolioCategories = useMemo(() => {
    const extra = Array.from(
      new Set(resolvedPortfolio.map((w) => w.category).filter(Boolean))
    );
    const merged = Array.from(
      new Set(["All", ...PORTFOLIO_CATEGORIES.filter((c) => c !== "All"), ...extra])
    );
    return merged as string[];
  }, [resolvedPortfolio]);

  // Portfolio category filter & lightbox
  const [activePortfolioCat, setActivePortfolioCat] = useState<string>("All");
  const [lightboxIdx, setLightboxIdx] = useState<number | null>(null);

  const filteredPortfolio = useMemo(() => {
    if (activePortfolioCat === "All") return resolvedPortfolio;
    return resolvedPortfolio.filter((w) => w.category === activePortfolioCat);
  }, [activePortfolioCat, resolvedPortfolio]);

  useEffect(() => {
    if (lightboxIdx === null) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setLightboxIdx(null);
      if (e.key === "ArrowRight") {
        setLightboxIdx((i) =>
          i === null ? null : (i + 1) % filteredPortfolio.length
        );
      }
      if (e.key === "ArrowLeft") {
        setLightboxIdx((i) =>
          i === null
            ? null
            : (i - 1 + filteredPortfolio.length) % filteredPortfolio.length
        );
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [lightboxIdx, filteredPortfolio.length]);

  // Quotation Form State
  const [quoteService, setQuoteService] = useState(PRINTING_SERVICES[0].name);
  const [quoteSize, setQuoteSize] = useState("Standard (Customisable)");
  const [quoteMaterial, setQuoteMaterial] = useState("350gsm Matte Velvet Cardstock");
  const [quoteQuantity, setQuoteQuantity] = useState("100");
  const [quoteColorMode, setQuoteColorMode] = useState<"color" | "bw">("color");
  const [quoteFile, setQuoteFile] = useState<{
    name: string;
    sizeKB: number;
    file: File;
  } | null>(null);
  const [quoteNotes, setQuoteNotes] = useState("");
  const [quoteName, setQuoteName] = useState("");
  const [quoteEmail, setQuoteEmail] = useState("");
  const [quotePhone, setQuotePhone] = useState("");
  const [isSubmittingQuote, setIsSubmittingQuote] = useState(false);
  const [quoteStatus, setQuoteStatus] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  // Testimonial / Benchmark Carousel State
  const [benchmarkIdx, setBenchmarkIdx] = useState(0);

  // Contact Form State
  const [contactName, setContactName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [contactSubject, setContactSubject] = useState("");
  const [contactProject, setContactProject] = useState("");
  const [isSubmittingContact, setIsSubmittingContact] = useState(false);
  const [contactStatus, setContactStatus] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  const handleSelectServiceForQuote = (serviceName: string) => {
    setQuoteService(serviceName);
    const el = document.getElementById("quote");
    el?.scrollIntoView({ behavior: "smooth" });
  };

  const handleQuoteArtworkChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
    const isImg = file.type.startsWith("image/");
    const maxMb = isPdf
      ? cmsSettings?.maxPdfUploadMb || 20
      : isImg
      ? cmsSettings?.maxImageUploadMb || 15
      : cmsSettings?.maxCustomUploadMb || 25;
    if (file.size > maxMb * 1024 * 1024) {
      setQuoteStatus({
        type: "error",
        text: `File exceeds the ${maxMb} MB studio upload limit. Please compress or send via Mail Desk.`,
      });
      e.target.value = "";
      return;
    }
    setQuoteStatus(null);
    setQuoteFile({
      name: file.name,
      sizeKB: Math.max(1, Math.round(file.size / 1024)),
      file,
    });
  };

  const buildQuoteDraftBody = () =>
    [
      `Print Quotation Request — ${BRAND_NAME}`,
      `----------------------------------------`,
      `Service: ${quoteService}`,
      `Print Size: ${quoteSize}`,
      `Material: ${quoteMaterial}`,
      `Quantity: ${quoteQuantity}`,
      `Print Mode: ${quoteColorMode === "color" ? "Full Color (CMYK)" : "Black & White"}`,
      `Artwork File: ${
        quoteFile ? `${quoteFile.name} (${quoteFile.sizeKB} KB)` : "Optional / Via Email"
      }`,
      `Pricing Tier: Request a Quote`,
      quoteName.trim() ? `Customer Name: ${quoteName.trim()}` : "",
      quoteEmail.trim() ? `Customer Email: ${quoteEmail.trim()}` : "",
      quotePhone.trim() ? `Phone: ${quotePhone.trim()}` : "",
      quoteNotes.trim() ? `Requirements:\n${quoteNotes.trim()}` : "",
    ]
      .filter(Boolean)
      .join("\n");

  const handleQuoteSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quoteName.trim() || !quoteEmail.trim()) {
      setQuoteStatus({
        type: "error",
        text: "Please enter your name and reply email to submit a quotation request.",
      });
      return;
    }

    try {
      setIsSubmittingQuote(true);
      setQuoteStatus(null);
      const fd = new FormData();
      fd.set("customerName", quoteName.trim());
      fd.set("customerEmail", quoteEmail.trim());
      if (quotePhone.trim()) fd.set("phoneNumber", quotePhone.trim());
      fd.set("serviceType", quoteService);
      fd.set("paperSize", quoteSize);
      fd.set("material", quoteMaterial);
      fd.set("quantity", quoteQuantity || "1");
      fd.set(
        "colorMode",
        quoteColorMode === "color" ? "Full Color (CMYK)" : "Black & White"
      );
      fd.set("description", quoteNotes.trim());
      if (quoteFile?.file) {
        fd.set("attachment", quoteFile.file);
      }

      const res = await submitPublicQuote(fd);
      setQuoteStatus({
        type: "success",
        text: `Quotation request submitted (Ref #${res.quoteId.slice(0, 8)}). Our print team has received your specifications and will reply to ${quoteEmail.trim()}.`,
      });
      setQuoteNotes("");
      setQuoteFile(null);
    } catch (err) {
      setQuoteStatus({
        type: "error",
        text:
          err instanceof Error
            ? `${err.message} You can also send directly via Mail Desk.`
            : "Could not save quote request to backend. Please use Mail Desk.",
      });
    } finally {
      setIsSubmittingQuote(false);
    }
  };

  const handleContactSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!contactName.trim() || !contactEmail.trim() || !contactProject.trim()) {
      setContactStatus({
        type: "error",
        text: "Please fill in your name, email, and project message.",
      });
      return;
    }

    try {
      setIsSubmittingContact(true);
      setContactStatus(null);
      const res = await submitPublicContact({
        customerName: contactName.trim(),
        customerEmail: contactEmail.trim(),
        phoneNumber: contactPhone.trim() || undefined,
        subject:
          contactSubject.trim() ||
          `Print Project Inquiry from ${contactName.trim()}`,
        message: contactProject.trim(),
      });
      setContactStatus({
        type: "success",
        text: `Message sent to Print Desk (Ref #${res.messageId.slice(0, 8)}). We will respond to ${contactEmail.trim()}.`,
      });
      setContactProject("");
      setContactSubject("");
    } catch (err) {
      setContactStatus({
        type: "error",
        text:
          err instanceof Error
            ? err.message
            : "Could not send message. Please use Open Mail Desk.",
      });
    } finally {
      setIsSubmittingContact(false);
    }
  };

  return (
    <div className="space-y-24 py-16">
      {/* 5. PRINTING SERVICES SHOWCASE */}
      <section id="services" className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-10">
          <div>
            <p className="text-xs font-mono-nums uppercase tracking-[0.2em] text-[#00E5FF] mb-2">
              01 · Printing &amp; Creative Capabilities
            </p>
            <h2
              className="text-2xl sm:text-4xl font-extrabold tracking-tight text-[#F5F7FA]"
              style={{ textWrap: "balance" }}
            >
              Commercial Print &amp; Design Services
            </h2>
          </div>
          <p className="text-sm text-[#94A3B8] max-w-md">
            Precision color output across cards, wide-format signage, bespoke
            merchandise, and digital identity design.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
          {resolvedServices.map((srv, idx) => {
            const Icon = srv.icon;
            return (
              <motion.article
                key={srv.id}
                initial={prefersReducedMotion ? false : { opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.15 }}
                transition={{ duration: 0.35, delay: (idx % 4) * 0.05 }}
                whileHover={prefersReducedMotion ? undefined : { y: -4 }}
                className="glass-card-interactive overflow-hidden flex flex-col group"
              >
                <div className="relative h-44 w-full overflow-hidden bg-[#080B12]">
                  <img
                    src={srv.image}
                    alt={srv.name}
                    loading="lazy"
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105 opacity-85"
                  />
                  <div
                    aria-hidden="true"
                    className="absolute inset-0 bg-gradient-to-t from-[#111827] via-transparent to-transparent"
                  />
                  <div className="absolute top-3 right-3 w-9 h-9 rounded-xl bg-[#080B12]/75 backdrop-blur-md border border-[#00E5FF]/30 flex items-center justify-center text-[#00E5FF]">
                    <Icon className="w-4 h-4" />
                  </div>
                </div>

                <div className="p-5 flex-1 flex flex-col">
                  <h3 className="text-base font-bold text-[#F5F7FA] group-hover:text-[#00E5FF] transition-colors">
                    {srv.name}
                  </h3>
                  <p className="text-xs text-[#94A3B8] mt-2 leading-relaxed flex-1">
                    {srv.description}
                  </p>

                  <div className="mt-4 pt-3 border-t border-[#00E5FF]/10 flex items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => handleSelectServiceForQuote(srv.name)}
                      className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#00E5FF] hover:text-[#F5F7FA] transition-colors cursor-pointer whitespace-nowrap"
                    >
                      <span>Learn More</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>

                    {srv.studioMode ? (
                      <button
                        type="button"
                        onClick={() => onLaunchStudioMode(srv.studioMode!)}
                        className="text-[11px] font-semibold text-[#8B5CF6] hover:text-[#00E5FF] underline underline-offset-4 cursor-pointer whitespace-nowrap"
                      >
                        Open Tool
                      </button>
                    ) : (
                      <span className="text-[11px] font-mono-nums text-[#94A3B8]">
                        Request a Quote
                      </span>
                    )}
                  </div>
                </div>
              </motion.article>
            );
          })}
        </div>
      </section>

      {/* 6. PREMIUM PORTFOLIO GALLERY */}
      <section id="portfolio" className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 mb-8">
          <div>
            <p className="text-xs font-mono-nums uppercase tracking-[0.2em] text-[#00E5FF] mb-2">
              02 · Selected Studio Works
            </p>
            <h2
              className="text-2xl sm:text-4xl font-extrabold tracking-tight text-[#F5F7FA]"
              style={{ textWrap: "balance" }}
            >
              Print &amp; Design Portfolio
            </h2>
          </div>

          <div className="flex flex-wrap gap-1.5 p-1.5 bg-[#111827]/85 border border-[#00E5FF]/15 rounded-xl">
            {portfolioCategories.map((cat) => {
              const active = activePortfolioCat === cat;
              return (
                <button
                  key={cat}
                  type="button"
                  onClick={() => {
                    setActivePortfolioCat(cat);
                    setLightboxIdx(null);
                  }}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer whitespace-nowrap shrink-0 ${
                    active
                      ? "bg-gradient-to-r from-[#00E5FF] to-[#8B5CF6] text-[#080B12]"
                      : "text-[#94A3B8] hover:text-[#F5F7FA] hover:bg-white/5"
                  }`}
                >
                  {cat}
                </button>
              );
            })}
          </div>
        </div>

        <motion.div
          layout
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5"
        >
          <AnimatePresence mode="popLayout">
            {filteredPortfolio.map((work, idx) => (
              <motion.button
                key={work.id}
                layout
                type="button"
                initial={prefersReducedMotion ? false : { opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.25 }}
                onClick={() => setLightboxIdx(idx)}
                className={`glass-card-interactive overflow-hidden group relative text-left cursor-pointer ${
                  idx === 0 && filteredPortfolio.length >= 4
                    ? "sm:col-span-2 lg:col-span-2"
                    : ""
                }`}
              >
                <div className="relative h-64 sm:h-72 w-full overflow-hidden bg-[#080B12]">
                  <img
                    src={work.image}
                    alt={work.title}
                    loading="lazy"
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105 opacity-90"
                  />
                  <div
                    aria-hidden="true"
                    className="absolute inset-0 bg-gradient-to-t from-[#080B12] via-[#080B12]/35 to-transparent"
                  />
                  <div className="absolute inset-x-0 bottom-0 p-5">
                    <span className="text-[11px] font-mono-nums text-[#00E5FF]">
                      {work.category}
                    </span>
                    <h3 className="text-lg font-bold text-[#F5F7FA] mt-0.5">
                      {work.title}
                    </h3>
                    <p className="text-xs text-[#94A3B8] mt-1">{work.subtitle}</p>
                  </div>
                </div>
              </motion.button>
            ))}
          </AnimatePresence>
        </motion.div>

        {/* Portfolio Lightbox Modal */}
        {lightboxIdx !== null && filteredPortfolio[lightboxIdx] && (
          <div
            role="dialog"
            aria-modal="true"
            aria-label={filteredPortfolio[lightboxIdx].title}
            className="fixed inset-0 z-50 bg-[#080B12]/90 backdrop-blur-xl flex items-center justify-center p-4"
          >
            <div className="glass-card max-w-4xl w-full overflow-hidden border border-[#00E5FF]/35">
              <div className="px-5 py-3.5 border-b border-[#00E5FF]/15 flex items-center justify-between gap-4">
                <div>
                  <span className="text-xs font-mono-nums text-[#00E5FF]">
                    {filteredPortfolio[lightboxIdx].category}
                  </span>
                  <h3 className="text-base font-bold text-[#F5F7FA]">
                    {filteredPortfolio[lightboxIdx].title}
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setLightboxIdx(null)}
                  aria-label="Close preview"
                  className="p-2 rounded-lg bg-[#161D2B] text-[#94A3B8] hover:text-[#F5F7FA] cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="relative bg-[#080B12] max-h-[65vh] flex items-center justify-center overflow-hidden">
                <img
                  src={filteredPortfolio[lightboxIdx].image}
                  alt={filteredPortfolio[lightboxIdx].title}
                  referrerPolicy="no-referrer"
                  className="max-h-[65vh] w-full object-contain"
                />
              </div>

              <div className="px-5 py-4 flex flex-wrap items-center justify-between gap-3 border-t border-[#00E5FF]/15">
                <p className="text-xs text-[#94A3B8]">
                  {filteredPortfolio[lightboxIdx].subtitle}
                </p>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      setLightboxIdx((i) =>
                        i === null
                          ? null
                          : (i - 1 + filteredPortfolio.length) %
                            filteredPortfolio.length
                      )
                    }
                    className="p-2 rounded-lg bg-[#161D2B] border border-[#00E5FF]/20 text-[#F5F7FA] hover:border-[#00E5FF]/60 cursor-pointer"
                    aria-label="Previous project"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setLightboxIdx((i) =>
                        i === null ? null : (i + 1) % filteredPortfolio.length
                      )
                    }
                    className="p-2 rounded-lg bg-[#161D2B] border border-[#00E5FF]/20 text-[#F5F7FA] hover:border-[#00E5FF]/60 cursor-pointer"
                    aria-label="Next project"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const title = filteredPortfolio[lightboxIdx].title;
                      setLightboxIdx(null);
                      handleSelectServiceForQuote(
                        `Custom Print (${title})`
                      );
                    }}
                    className="px-4 py-2 rounded-lg bg-gradient-to-r from-[#00E5FF] to-[#8B5CF6] text-[#080B12] text-xs font-bold cursor-pointer whitespace-nowrap"
                  >
                    Request Similar Print
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </section>

      {/* 7. HOW IT WORKS */}
      <section id="workflow" className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="mb-10">
          <p className="text-xs font-mono-nums uppercase tracking-[0.2em] text-[#00E5FF] mb-2">
            03 · Studio Production Workflow
          </p>
          <h2
            className="text-2xl sm:text-4xl font-extrabold tracking-tight text-[#F5F7FA]"
            style={{ textWrap: "balance" }}
          >
            From Artwork Upload to Final Print
          </h2>
        </div>

        <div className="relative">
          {/* Desktop Animated Progress Track */}
          <div
            aria-hidden="true"
            className="hidden lg:block absolute top-11 left-12 right-12 h-[2px] bg-[#161D2B] overflow-hidden"
          >
            <motion.div
              className="h-full bg-gradient-to-r from-[#00E5FF] via-[#7DD3FC] to-[#8B5CF6] shadow-[0_0_16px_rgba(0,229,255,0.65)]"
              initial={prefersReducedMotion ? { width: "100%" } : { width: "0%" }}
              whileInView={{ width: "100%" }}
              viewport={{ once: true, amount: 0.3 }}
              transition={{ duration: 1.1, ease: "easeOut" }}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 relative">
            {WORKFLOW_STEPS.map((item, idx) => {
              const Icon = item.icon;
              return (
                <motion.div
                  key={item.step}
                  initial={prefersReducedMotion ? false : { opacity: 0, y: 14 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, amount: 0.2 }}
                  transition={{ duration: 0.4, delay: idx * 0.1 }}
                  className="glass-card p-6 relative flex flex-col"
                >
                  <div className="flex items-center justify-between mb-5">
                    <div className="w-11 h-11 rounded-xl bg-[#080B12] border border-[#00E5FF]/35 flex items-center justify-center text-[#00E5FF] shadow-[0_0_18px_rgba(0,229,255,0.18)]">
                      <Icon className="w-5 h-5" />
                    </div>
                    <span className="font-mono-nums text-xs font-bold text-[#8B5CF6]">
                      {item.step}
                    </span>
                  </div>
                  <h3 className="text-base font-bold text-[#F5F7FA]">
                    {item.title}
                  </h3>
                  <p className="text-xs text-[#94A3B8] mt-2 leading-relaxed">
                    {item.desc}
                  </p>
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>

      {/* 8. FILE UPLOAD AND PRINT QUOTE */}
      <section id="quote" className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="mb-8">
          <p className="text-xs font-mono-nums uppercase tracking-[0.2em] text-[#00E5FF] mb-2">
            04 · Custom Print Estimation
          </p>
          <h2
            className="text-2xl sm:text-4xl font-extrabold tracking-tight text-[#F5F7FA]"
            style={{ textWrap: "balance" }}
          >
            Upload Artwork &amp; Request Print Quote
          </h2>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          <form
            onSubmit={handleQuoteSubmit}
            className="lg:col-span-8 glass-card p-6 sm:p-8 space-y-5"
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label
                  htmlFor="quote-service"
                  className="block text-xs font-semibold text-[#E2E8F0] mb-1.5"
                >
                  Printing Service
                </label>
                <select
                  id="quote-service"
                  value={quoteService}
                  onChange={(e) => setQuoteService(e.target.value)}
                  className="w-full bg-[#080B12] border border-[#00E5FF]/25 rounded-xl px-3.5 py-2.5 text-sm text-[#F5F7FA] focus:outline-none focus:ring-2 focus:ring-[#00E5FF]"
                >
                  {resolvedServices.map((s) => (
                    <option key={s.id} value={s.name}>
                      {s.name}
                    </option>
                  ))}
                  {!resolvedServices.some((s) => s.name === quoteService) && (
                    <option value={quoteService}>{quoteService}</option>
                  )}
                </select>
              </div>

              <div>
                <label
                  htmlFor="quote-size"
                  className="block text-xs font-semibold text-[#E2E8F0] mb-1.5"
                >
                  Print Size / Format
                </label>
                <select
                  id="quote-size"
                  value={quoteSize}
                  onChange={(e) => setQuoteSize(e.target.value)}
                  className="w-full bg-[#080B12] border border-[#00E5FF]/25 rounded-xl px-3.5 py-2.5 text-sm text-[#F5F7FA] focus:outline-none focus:ring-2 focus:ring-[#00E5FF]"
                >
                  <option value="Standard (Customisable)">
                    Standard Size (e.g. 3.5 × 2 in Card / A4 / 4×6)
                  </option>
                  <option value="A4 (210 × 297 mm)">A4 (210 × 297 mm)</option>
                  <option value="A3 (297 × 420 mm)">A3 (297 × 420 mm)</option>
                  <option value="3 × 2 ft Banner">3 × 2 ft Banner</option>
                  <option value="6 × 3 ft Large Format">
                    6 × 3 ft Large Format
                  </option>
                  <option value="Custom Dimensions (Specify in Notes)">
                    Custom Dimensions (Specify in Notes)
                  </option>
                </select>
              </div>

              <div>
                <label
                  htmlFor="quote-material"
                  className="block text-xs font-semibold text-[#E2E8F0] mb-1.5"
                >
                  Material &amp; Finish
                </label>
                <select
                  id="quote-material"
                  value={quoteMaterial}
                  onChange={(e) => setQuoteMaterial(e.target.value)}
                  className="w-full bg-[#080B12] border border-[#00E5FF]/25 rounded-xl px-3.5 py-2.5 text-sm text-[#F5F7FA] focus:outline-none focus:ring-2 focus:ring-[#00E5FF]"
                >
                  <option value="350gsm Matte Velvet Cardstock">
                    350gsm Matte Velvet Cardstock
                  </option>
                  <option value="170gsm Gloss Art Paper">
                    170gsm Gloss Art Paper
                  </option>
                  <option value="Archival Photo Paper (300 PPI)">
                    Archival Photo Paper (300 PPI)
                  </option>
                  <option value="Star Flex / Backlit Media">
                    Star Flex / Backlit Media
                  </option>
                  <option value="Waterproof Die-Cut Vinyl">
                    Waterproof Die-Cut Vinyl
                  </option>
                  <option value="Combed Cotton Apparel (DTF)">
                    Combed Cotton Apparel (DTF)
                  </option>
                  <option value="CR80 PVC Card">CR80 PVC Card</option>
                </select>
              </div>

              <div>
                <label
                  htmlFor="quote-qty"
                  className="block text-xs font-semibold text-[#E2E8F0] mb-1.5"
                >
                  Quantity
                </label>
                <input
                  id="quote-qty"
                  type="number"
                  min={1}
                  value={quoteQuantity}
                  onChange={(e) => setQuoteQuantity(e.target.value)}
                  className="w-full font-mono-nums bg-[#080B12] border border-[#00E5FF]/25 rounded-xl px-3.5 py-2.5 text-sm text-[#F5F7FA] focus:outline-none focus:ring-2 focus:ring-[#00E5FF]"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <span className="block text-xs font-semibold text-[#E2E8F0] mb-1.5">
                  Print Color Mode
                </span>
                <div className="grid grid-cols-2 gap-2 p-1 bg-[#080B12] border border-[#00E5FF]/20 rounded-xl">
                  <button
                    type="button"
                    onClick={() => setQuoteColorMode("color")}
                    className={`py-2 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                      quoteColorMode === "color"
                        ? "bg-gradient-to-r from-[#00E5FF] to-[#8B5CF6] text-[#080B12]"
                        : "text-[#94A3B8] hover:text-[#F5F7FA]"
                    }`}
                  >
                    Full Color (CMYK)
                  </button>
                  <button
                    type="button"
                    onClick={() => setQuoteColorMode("bw")}
                    className={`py-2 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                      quoteColorMode === "bw"
                        ? "bg-gradient-to-r from-[#00E5FF] to-[#8B5CF6] text-[#080B12]"
                        : "text-[#94A3B8] hover:text-[#F5F7FA]"
                    }`}
                  >
                    Black &amp; White
                  </button>
                </div>
              </div>

              <div>
                <span className="block text-xs font-semibold text-[#E2E8F0] mb-1.5">
                  Artwork / Data File (
                  {cmsSettings?.allowAnyUpload !== false
                    ? "PDF, XML, Images, SVG, Docs"
                    : (cmsSettings?.allowedUploadExtensions || ["pdf", "png", "jpg"])
                        .slice(0, 6)
                        .map((e) => e.toUpperCase())
                        .join(", ")}
                  )
                </span>
                <label className="flex items-center justify-between gap-2 px-3.5 py-2.5 bg-[#080B12] border border-dashed border-[#00E5FF]/35 hover:border-[#00E5FF] rounded-xl cursor-pointer transition-colors">
                  <span className="text-xs text-[#94A3B8] truncate">
                    {quoteFile
                      ? `${quoteFile.name} (${quoteFile.sizeKB} KB)`
                      : "Click to attach artwork or document..."}
                  </span>
                  <Upload className="w-4 h-4 text-[#00E5FF] shrink-0" />
                  <input
                    type="file"
                    accept={
                      cmsSettings?.allowAnyUpload !== false
                        ? undefined
                        : cmsSettings?.allowedUploadExtensions?.length
                        ? cmsSettings.allowedUploadExtensions.map((ext) => `.${ext}`).join(",")
                        : "image/*,.pdf,.svg,.xml"
                    }
                    onChange={handleQuoteArtworkChange}
                    className="hidden"
                  />
                </label>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label
                  htmlFor="quote-name"
                  className="block text-xs font-semibold text-[#E2E8F0] mb-1.5"
                >
                  Your Name
                </label>
                <input
                  id="quote-name"
                  type="text"
                  required
                  value={quoteName}
                  onChange={(e) => setQuoteName(e.target.value)}
                  placeholder="Enter your full name"
                  className="w-full bg-[#080B12] border border-[#00E5FF]/25 rounded-xl px-3.5 py-2.5 text-sm text-[#F5F7FA] placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-[#00E5FF]"
                />
              </div>

              <div>
                <label
                  htmlFor="quote-email"
                  className="block text-xs font-semibold text-[#E2E8F0] mb-1.5"
                >
                  Reply Email
                </label>
                <input
                  id="quote-email"
                  type="email"
                  required
                  value={quoteEmail}
                  onChange={(e) => setQuoteEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="w-full bg-[#080B12] border border-[#00E5FF]/25 rounded-xl px-3.5 py-2.5 text-sm text-[#F5F7FA] placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-[#00E5FF]"
                />
              </div>

              <div>
                <label
                  htmlFor="quote-phone"
                  className="block text-xs font-semibold text-[#E2E8F0] mb-1.5"
                >
                  Phone / WhatsApp (Optional)
                </label>
                <input
                  id="quote-phone"
                  type="tel"
                  value={quotePhone}
                  onChange={(e) => setQuotePhone(e.target.value)}
                  placeholder="Optional contact number"
                  className="w-full bg-[#080B12] border border-[#00E5FF]/25 rounded-xl px-3.5 py-2.5 text-sm text-[#F5F7FA] placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-[#00E5FF]"
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="quote-notes"
                className="block text-xs font-semibold text-[#E2E8F0] mb-1.5"
              >
                Custom Requirements &amp; Finishing Notes
              </label>
              <textarea
                id="quote-notes"
                rows={3}
                value={quoteNotes}
                onChange={(e) => setQuoteNotes(e.target.value)}
                placeholder="Mention custom dimensions, lamination, rounded corners, double-sided printing, or deadline..."
                className="w-full bg-[#080B12] border border-[#00E5FF]/25 rounded-xl px-3.5 py-2.5 text-sm text-[#F5F7FA] placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-[#00E5FF]"
              />
            </div>

            {quoteStatus && (
              <div
                role="status"
                className={`text-xs rounded-xl px-4 py-3 border ${
                  quoteStatus.type === "success"
                    ? "bg-emerald-950/60 border-emerald-500/40 text-emerald-200"
                    : "bg-rose-950/60 border-rose-500/40 text-rose-200"
                }`}
              >
                {quoteStatus.text}
              </div>
            )}

            <div className="flex flex-wrap items-center gap-3">
              <button
                type="submit"
                disabled={isSubmittingQuote}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-gradient-to-r from-[#00E5FF] to-[#8B5CF6] text-[#080B12] font-bold text-sm px-7 py-3 rounded-xl shadow-[0_0_24px_rgba(0,229,255,0.28)] hover:brightness-110 disabled:opacity-50 transition-all cursor-pointer"
              >
                <Send className="w-4 h-4" />
                <span>
                  {isSubmittingQuote ? "Submitting Quote..." : "Submit Quote Request"}
                </span>
              </button>

              <button
                type="button"
                onClick={() =>
                  onOpenMailModal(
                    `Quote Request: ${quoteService} (${quoteQuantity})`,
                    buildQuoteDraftBody()
                  )
                }
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-[#080B12] border border-[#00E5FF]/25 hover:border-[#00E5FF]/60 text-[#E2E8F0] font-semibold text-xs px-4 py-3 rounded-xl transition-colors cursor-pointer"
              >
                <Mail className="w-3.5 h-3.5 text-[#00E5FF]" />
                <span>Also Send via Mail Desk</span>
              </button>
            </div>
          </form>

          {/* Quotation Summary Panel */}
          <aside className="lg:col-span-4 glass-card p-6 sm:p-7 space-y-5">
            <div className="flex items-center justify-between pb-4 border-b border-[#00E5FF]/15">
              <h3 className="text-base font-bold text-[#F5F7FA]">
                Quotation Summary
              </h3>
              <span className="text-xs font-mono-nums text-[#00E5FF]">
                Request a Quote
              </span>
            </div>

            <dl className="space-y-3 text-xs">
              <div className="flex justify-between gap-3">
                <dt className="text-[#94A3B8]">Service</dt>
                <dd className="text-[#F5F7FA] font-semibold text-right">
                  {quoteService}
                </dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-[#94A3B8]">Size</dt>
                <dd className="text-[#F5F7FA] font-mono-nums text-right">
                  {quoteSize}
                </dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-[#94A3B8]">Material</dt>
                <dd className="text-[#F5F7FA] text-right">{quoteMaterial}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-[#94A3B8]">Quantity</dt>
                <dd className="text-[#F5F7FA] font-mono-nums text-right">
                  {quoteQuantity || "1"} units
                </dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-[#94A3B8]">Color Mode</dt>
                <dd className="text-[#F5F7FA] text-right">
                  {quoteColorMode === "color" ? "Full Color (CMYK)" : "Black & White"}
                </dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-[#94A3B8]">Artwork File</dt>
                <dd className="text-[#00E5FF] font-mono-nums text-right truncate max-w-[170px]">
                  {quoteFile ? quoteFile.name : "Optional / Via Email"}
                </dd>
              </div>
            </dl>

            <div className="pt-4 border-t border-[#00E5FF]/15 flex items-center justify-between">
              <span className="text-xs text-[#94A3B8]">Estimated Price</span>
              <span className="text-sm font-bold text-[#00E5FF]">
                Request a Quote
              </span>
            </div>

            <p className="text-[11px] text-[#94A3B8] leading-relaxed">
              Every print run is reviewed for bleed, margins, and stock
              availability before confirming turnaround and pricing via{" "}
              <span className="text-[#F5F7FA] font-mono-nums break-all">
                {supportEmail}
              </span>{" "}
              or{" "}
              <span className="text-[#00E5FF] font-mono-nums break-all">
                {OFFICIAL_SUPPORT_EMAIL}
              </span>
              .
            </p>
          </aside>
        </div>
      </section>

      {/* 9. ABOUT SUN-NOVA PRINT SERVICE */}
      <section id="about" className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="glass-card overflow-hidden grid grid-cols-1 lg:grid-cols-12 items-stretch">
          <div className="lg:col-span-6 relative min-h-[320px] bg-[#080B12]">
            <img
              src={cmsSettings?.aboutImageUrl?.trim() || aboutAtelierImg}
              alt="SUN-NOVA PRINT SERVICE color-calibrated graphic design and print studio"
              loading="lazy"
              referrerPolicy="no-referrer"
              className="w-full h-full object-cover opacity-90"
            />
            <div
              aria-hidden="true"
              className="absolute inset-0 bg-gradient-to-tr from-[#080B12]/70 via-transparent to-transparent"
            />
          </div>

          <div className="lg:col-span-6 p-7 sm:p-10 flex flex-col justify-center space-y-6">
            <div>
              <p className="text-xs font-mono-nums uppercase tracking-[0.2em] text-[#00E5FF] mb-2">
                {cmsSettings?.aboutEyebrow?.trim() || `05 · About ${BRAND_NAME}`}
              </p>
              <h2
                className="text-2xl sm:text-4xl font-extrabold tracking-tight text-[#F5F7FA]"
                style={{ textWrap: "balance" }}
              >
                {cmsSettings?.aboutHeadline?.trim() || "Precision Meets Creativity."}
              </h2>
            </div>

            <p className="text-sm sm:text-base text-[#94A3B8] leading-relaxed">
              {cmsSettings?.aboutDescription?.trim() ||
                `At ${BRAND_NAME}, we transform creative ideas into high-quality printed experiences. From professional business materials to vibrant large-format prints, we combine creativity, precision, and modern printing technology to bring every vision to life.`}
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
              <div className="p-4 rounded-xl bg-[#080B12]/75 border border-[#00E5FF]/15">
                <Award className="w-4 h-4 text-[#00E5FF] mb-2" />
                <h3 className="text-xs font-bold text-[#F5F7FA]">
                  300 PPI Print Calibration
                </h3>
                <p className="text-[11px] text-[#94A3B8] mt-1">
                  Exact millimeter geometry with embedded JFIF print resolution.
                </p>
              </div>
              <div className="p-4 rounded-xl bg-[#080B12]/75 border border-[#8B5CF6]/20">
                <ShieldCheck className="w-4 h-4 text-[#8B5CF6] mb-2" />
                <h3 className="text-xs font-bold text-[#F5F7FA]">
                  Zero-Leakage Privacy
                </h3>
                <p className="text-[11px] text-[#94A3B8] mt-1">
                  Browser-local cropping, PDF assembly, and ID card layout tools.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 10. CLIENT ASSURANCE & FEEDBACK CAROUSEL (NO FABRICATED RATINGS) */}
      <section id="testimonials" className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-8">
          <div>
            <p className="text-xs font-mono-nums uppercase tracking-[0.2em] text-[#00E5FF] mb-2">
              06 · Quality Assurance &amp; Client Voice
            </p>
            <h2
              className="text-2xl sm:text-4xl font-extrabold tracking-tight text-[#F5F7FA]"
              style={{ textWrap: "balance" }}
            >
              Built for Consistent Studio Excellence
            </h2>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() =>
                setBenchmarkIdx(
                  (i) => (i - 1 + STUDIO_BENCHMARKS.length) % STUDIO_BENCHMARKS.length
                )
              }
              aria-label="Previous highlight"
              className="p-2.5 rounded-xl bg-[#161D2B] border border-[#00E5FF]/20 text-[#F5F7FA] hover:border-[#00E5FF]/60 cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() =>
                setBenchmarkIdx((i) => (i + 1) % STUDIO_BENCHMARKS.length)
              }
              aria-label="Next highlight"
              className="p-2.5 rounded-xl bg-[#161D2B] border border-[#00E5FF]/20 text-[#F5F7FA] hover:border-[#00E5FF]/60 cursor-pointer"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="glass-card p-7 sm:p-10 relative overflow-hidden">
          <Quote
            aria-hidden="true"
            className="w-10 h-10 text-[#00E5FF]/25 mb-4"
          />
          <AnimatePresence mode="wait">
            <motion.div
              key={benchmarkIdx}
              initial={prefersReducedMotion ? false : { opacity: 0, x: 14 }}
              animate={{ opacity: 1, x: 0 }}
              exit={prefersReducedMotion ? undefined : { opacity: 0, x: -14 }}
              transition={{ duration: 0.25 }}
              className="space-y-4"
            >
              <h3 className="text-lg sm:text-2xl font-bold text-[#F5F7FA]">
                {STUDIO_BENCHMARKS[benchmarkIdx].title}
              </h3>
              <p className="text-sm sm:text-base text-[#94A3B8] max-w-3xl leading-relaxed">
                {STUDIO_BENCHMARKS[benchmarkIdx].detail}
              </p>
              <div className="pt-2 flex flex-wrap items-center justify-between gap-4">
                <span className="text-xs font-mono-nums text-[#00E5FF]">
                  {STUDIO_BENCHMARKS[benchmarkIdx].tag}
                </span>
                <button
                  type="button"
                  onClick={() =>
                    onOpenMailModal(
                      `Client Feedback for ${BRAND_NAME}`,
                      `Review / Print Feedback:\n`
                    )
                  }
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#F5F7FA] hover:text-[#00E5FF] underline underline-offset-4 cursor-pointer"
                >
                  <CheckCircle2 className="w-3.5 h-3.5 text-[#00E5FF]" />
                  <span>Share Verified Client Feedback</span>
                </button>
              </div>
            </motion.div>
          </AnimatePresence>
        </div>
      </section>

      {/* 11. CONTACT AND QUOTATION SECTION */}
      <section id="contact" className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="glass-card p-7 sm:p-12 relative overflow-hidden">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -top-24 -right-24 w-72 h-72 rounded-full bg-[#00E5FF]/12 blur-[100px]"
          />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -bottom-24 -left-24 w-72 h-72 rounded-full bg-[#8B5CF6]/15 blur-[100px]"
          />

          <div className="relative grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            <div className="lg:col-span-6 space-y-5">
              <p className="text-xs font-mono-nums uppercase tracking-[0.2em] text-[#00E5FF]">
                07 · Direct Print Desk
              </p>
              <h2
                className="text-3xl sm:text-5xl font-extrabold tracking-tight text-[#F5F7FA] leading-tight"
                style={{ textWrap: "balance" }}
              >
                LET&apos;S CREATE SOMETHING{" "}
                <span className="bg-gradient-to-r from-[#00E5FF] to-[#8B5CF6] bg-clip-text text-transparent">
                  EXTRAORDINARY.
                </span>
              </h2>
              <p className="text-sm sm:text-base text-[#94A3B8] max-w-lg leading-relaxed">
                Have a project in mind? Let&apos;s turn your vision into a
                stunning printed reality.
              </p>

              <div className="p-4 rounded-xl bg-[#080B12]/75 border border-[#00E5FF]/20 space-y-2.5 text-xs">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-[#94A3B8]">Print Desk Email:</span>
                  <a
                    href={`mailto:${supportEmail}`}
                    className="font-mono-nums font-semibold text-[#00E5FF] hover:underline break-all"
                  >
                    {supportEmail}
                  </a>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-white/10">
                  <span className="text-[#94A3B8]">Support Mail:</span>
                  <a
                    href={`mailto:${OFFICIAL_SUPPORT_EMAIL}`}
                    className="font-mono-nums font-semibold text-[#00E5FF] hover:underline break-all"
                  >
                    {OFFICIAL_SUPPORT_EMAIL}
                  </a>
                </div>
                {cmsSettings?.contactPhone?.trim() && (
                  <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-white/10">
                    <span className="text-[#94A3B8]">Studio Phone:</span>
                    <span className="font-mono-nums font-semibold text-[#F5F7FA]">
                      {cmsSettings.contactPhone}
                    </span>
                  </div>
                )}
                {cmsSettings?.contactAddress?.trim() && (
                  <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-white/10">
                    <span className="text-[#94A3B8]">Studio Address:</span>
                    <span className="text-right text-[#F5F7FA]">
                      {cmsSettings.contactAddress}
                    </span>
                  </div>
                )}
                {cmsSettings?.socialLinks && cmsSettings.socialLinks.length > 0 && (
                  <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-white/10">
                    {cmsSettings.socialLinks.map((s) => (
                      <a
                        key={`${s.label}-${s.url}`}
                        href={s.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-2.5 py-1 rounded-md bg-[#161D2B] border border-[#00E5FF]/20 text-[11px] font-semibold text-[#00E5FF] hover:border-[#00E5FF]"
                      >
                        {s.label}
                      </a>
                    ))}
                  </div>
                )}
                <p className="text-[#94A3B8] pt-1">
                  All project specifications, artwork files, and quotations are
                  coordinated strictly via official studio Email or Print Desk.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-3 pt-1">
                <a
                  href="#quote"
                  className="inline-flex items-center gap-2 bg-gradient-to-r from-[#00E5FF] to-[#8B5CF6] text-[#080B12] font-bold text-sm px-6 py-3 rounded-xl shadow-[0_0_24px_rgba(0,229,255,0.26)] hover:brightness-110 transition-all"
                >
                  <Sparkles className="w-4 h-4" />
                  <span>Start Your Print Project</span>
                </a>
                <button
                  type="button"
                  onClick={() => onOpenMailModal()}
                  className="inline-flex items-center gap-2 bg-[#161D2B] border border-[#00E5FF]/25 hover:border-[#00E5FF]/60 text-[#F5F7FA] text-sm font-semibold px-5 py-3 rounded-xl transition-colors cursor-pointer"
                >
                  <Mail className="w-4 h-4 text-[#00E5FF]" />
                  <span>Email Print Desk</span>
                </button>
              </div>
            </div>

            <form
              onSubmit={handleContactSubmit}
              className="lg:col-span-6 bg-[#080B12]/75 border border-[#00E5FF]/20 rounded-2xl p-6 space-y-4"
            >
              <h3 className="text-base font-bold text-[#F5F7FA]">
                Send Direct Message
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label
                    htmlFor="contact-name"
                    className="block text-xs font-semibold text-[#94A3B8] mb-1"
                  >
                    Name
                  </label>
                  <input
                    id="contact-name"
                    type="text"
                    required
                    value={contactName}
                    onChange={(e) => setContactName(e.target.value)}
                    placeholder="Your name"
                    className="w-full bg-[#111827] border border-[#00E5FF]/20 rounded-xl px-3.5 py-2.5 text-sm text-[#F5F7FA] placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-[#00E5FF]"
                  />
                </div>
                <div>
                  <label
                    htmlFor="contact-email"
                    className="block text-xs font-semibold text-[#94A3B8] mb-1"
                  >
                    Email
                  </label>
                  <input
                    id="contact-email"
                    type="email"
                    required
                    value={contactEmail}
                    onChange={(e) => setContactEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="w-full bg-[#111827] border border-[#00E5FF]/20 rounded-xl px-3.5 py-2.5 text-sm text-[#F5F7FA] placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-[#00E5FF]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label
                    htmlFor="contact-phone"
                    className="block text-xs font-semibold text-[#94A3B8] mb-1"
                  >
                    Phone (Optional)
                  </label>
                  <input
                    id="contact-phone"
                    type="tel"
                    value={contactPhone}
                    onChange={(e) => setContactPhone(e.target.value)}
                    placeholder="Optional contact number"
                    className="w-full bg-[#111827] border border-[#00E5FF]/20 rounded-xl px-3.5 py-2.5 text-sm text-[#F5F7FA] placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-[#00E5FF]"
                  />
                </div>
                <div>
                  <label
                    htmlFor="contact-subject"
                    className="block text-xs font-semibold text-[#94A3B8] mb-1"
                  >
                    Subject
                  </label>
                  <input
                    id="contact-subject"
                    type="text"
                    value={contactSubject}
                    onChange={(e) => setContactSubject(e.target.value)}
                    placeholder="Print Project Inquiry"
                    className="w-full bg-[#111827] border border-[#00E5FF]/20 rounded-xl px-3.5 py-2.5 text-sm text-[#F5F7FA] placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-[#00E5FF]"
                  />
                </div>
              </div>

              <div>
                <label
                  htmlFor="contact-project"
                  className="block text-xs font-semibold text-[#94A3B8] mb-1"
                >
                  Project Brief
                </label>
                <textarea
                  id="contact-project"
                  rows={4}
                  required
                  value={contactProject}
                  onChange={(e) => setContactProject(e.target.value)}
                  placeholder="Tell us about your print run, custom graphic needs, or timeline..."
                  className="w-full bg-[#111827] border border-[#00E5FF]/20 rounded-xl px-3.5 py-2.5 text-sm text-[#F5F7FA] placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-[#00E5FF]"
                />
              </div>

              {contactStatus && (
                <p
                  role="status"
                  className={`text-xs rounded-xl px-3.5 py-2.5 border ${
                    contactStatus.type === "success"
                      ? "bg-emerald-950/60 border-emerald-500/40 text-emerald-200"
                      : "bg-rose-950/60 border-rose-500/40 text-rose-200"
                  }`}
                >
                  {contactStatus.text}
                </p>
              )}

              <button
                type="submit"
                disabled={isSubmittingContact}
                className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-[#00E5FF] to-[#8B5CF6] text-[#080B12] font-bold text-sm py-3 rounded-xl hover:brightness-110 disabled:opacity-50 transition-all cursor-pointer"
              >
                <Send className="w-4 h-4" />
                <span>
                  {isSubmittingContact
                    ? "Sending to Print Desk..."
                    : "Send Direct Message"}
                </span>
              </button>
            </form>
          </div>
        </div>
      </section>
    </div>
  );
}
