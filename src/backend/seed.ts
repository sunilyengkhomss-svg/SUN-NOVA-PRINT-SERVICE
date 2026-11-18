import { D1Database } from "./d1Types";
import { ensureSchemaTables } from "./cloudflareStorage";
import { BG_COLORS, BRAND_NAME, DRESS_PRESETS, OFFICIAL_SUPPORT_EMAIL } from "../types/photo";
import { WebsiteSettings } from "../types/cms";

export const DEFAULT_WEBSITE_SETTINGS: WebsiteSettings = {
  brandName: BRAND_NAME,
  logoText: BRAND_NAME,
  logoImageUrl: "",
  heroEyebrow: `${BRAND_NAME} · Precision Digital Print Studio`,
  heroHeadlineTop: "BRING YOUR",
  heroHeadlineHighlight: "CREATIVITY",
  heroHeadlineBottom: "TO LIFE.",
  heroSubtitle: `Premium printing. Exceptional design. Unlimited creativity. Transform your ideas into stunning visual experiences with ${BRAND_NAME}.`,
  heroBgImageUrl: "",
  heroPrimaryCtaLabel: "Explore Our Services",
  heroPrimaryCtaHref: "#services",
  heroSecondaryCtaLabel: "Get a Free Quote",
  heroSecondaryCtaHref: "#quote",
  navLinks: [
    { label: "Home", href: "#home" },
    { label: "Services", href: "#services" },
    { label: "Studio", href: "#studio-workbench" },
    { label: "Portfolio", href: "#portfolio" },
    { label: "About Us", href: "#about" },
    { label: "Contact", href: "#contact" },
  ],
  aboutEyebrow: `05 · About ${BRAND_NAME}`,
  aboutHeadline: "Precision Meets Creativity.",
  aboutDescription: `At ${BRAND_NAME}, we transform creative ideas into high-quality printed experiences. From professional business materials to vibrant large-format prints, we combine creativity, precision, and modern printing technology to bring every vision to life.`,
  aboutImageUrl: "",
  contactEmail: OFFICIAL_SUPPORT_EMAIL,
  contactPhone: "",
  contactAddress: "Digital Pre-Press & Commercial Print Studio",
  socialLinks: [],
  maxImageUploadMb: 10,
  maxPdfUploadMb: 20,
  maxCustomUploadMb: 25,
  allowAnyUpload: true,
  allowedUploadExtensions: [
    "jpg",
    "jpeg",
    "png",
    "webp",
    "gif",
    "svg",
    "pdf",
    "xml",
    "json",
    "csv",
    "txt",
    "md",
    "doc",
    "docx",
    "xls",
    "xlsx",
    "zip",
  ],
  uploadCategories: [
    "image",
    "pdf",
    "xml",
    "document",
    "outfit",
    "background",
    "portrait",
    "service",
    "portfolio",
    "general",
  ],
};

const DEFAULT_SERVICES_SEED = [
  {
    id: "business-cards",
    name: "Business Card Printing",
    description:
      "Heavy matte, textured cotton, and metallic foil-accented cards built for executive first impressions.",
    category: "Stationery",
    studio_mode: null,
  },
  {
    id: "banner-printing",
    name: "Banner Printing",
    description:
      "High-opacity weather-resistant event, storefront, and stage banners with razor-sharp typography.",
    category: "Large Format",
    studio_mode: null,
  },
  {
    id: "flex-printing",
    name: "Flex Printing",
    description:
      "Durable outdoor frontlit and backlit flex signage engineered for long-range outdoor visibility.",
    category: "Large Format",
    studio_mode: null,
  },
  {
    id: "poster-printing",
    name: "Poster Printing",
    description:
      "Gallery-grade satin and gloss promotional posters with rich saturated blacks and vivid highlights.",
    category: "Commercial Printing",
    studio_mode: null,
  },
  {
    id: "flyer-printing",
    name: "Flyer Printing",
    description:
      "Crisp promotional handbills and campaign mailers on calibrated coated paper stocks.",
    category: "Marketing",
    studio_mode: null,
  },
  {
    id: "brochure-printing",
    name: "Brochure Printing",
    description:
      "Bi-fold and tri-fold corporate brochures with clean scoring and color-consistent photography.",
    category: "Marketing",
    studio_mode: null,
  },
  {
    id: "sticker-printing",
    name: "Sticker Printing",
    description:
      "Custom die-cut waterproof vinyl and holographic brand stickers for packaging and gear.",
    category: "Packaging",
    studio_mode: null,
  },
  {
    id: "vinyl-printing",
    name: "Vinyl Printing",
    description:
      "Self-adhesive matte and clear architectural vinyl graphics for glass, walls, and vehicle wraps.",
    category: "Large Format",
    studio_mode: null,
  },
  {
    id: "photo-printing",
    name: "Photo Printing",
    description:
      "True 300 PPI archival passport photos, studio portraits, and uniform-gap photo sheets.",
    category: "Photo Studio",
    studio_mode: "passport",
  },
  {
    id: "tshirt-printing",
    name: "T-Shirt Printing",
    description:
      "High-definition DTF and heat-transfer custom apparel printing built to withstand repeated washes.",
    category: "Apparel",
    studio_mode: null,
  },
  {
    id: "invitation-cards",
    name: "Invitation Card Printing",
    description:
      "Bespoke ceremonial, corporate gala, and wedding invitations on heavyweight specialty stock.",
    category: "Stationery",
    studio_mode: null,
  },
  {
    id: "custom-graphic-design",
    name: "Custom Graphic Design",
    description:
      "Print-ready artwork layout, pre-press color separation, and campaign visual composition.",
    category: "Creative Design",
    studio_mode: null,
  },
  {
    id: "logo-design",
    name: "Logo Design",
    description:
      "Scalable vector brand identities engineered to stay crisp from micro business cards to billboards.",
    category: "Creative Design",
    studio_mode: null,
  },
  {
    id: "id-card-printing",
    name: "ID Card Printing",
    description:
      "CR80 laminated employee badges, visitor passes, and Aadhaar/PAN smart sheet layouts.",
    category: "ID & Xerox",
    studio_mode: "xerox",
  },
  {
    id: "large-format-printing",
    name: "Large Format Printing",
    description:
      "Architectural boards, trade-show backdrops, and exhibition displays up to wide-format rolls.",
    category: "Large Format",
    studio_mode: null,
  },
];

const DEFAULT_PORTFOLIO_SEED = [
  {
    id: "pf-1",
    title: "Monolith Foil Stationery Suite",
    category: "Business Cards",
    subtitle: "Cyan metallic edge foil on 400gsm obsidian cotton stock",
  },
  {
    id: "pf-2",
    title: "Futurism Wide-Format Exhibition",
    category: "Posters",
    subtitle: "Wide-gamut UV pigment output on matte exhibition film",
  },
  {
    id: "pf-3",
    title: "Aurora Structural Packaging & Apparel",
    category: "Packaging",
    subtitle: "Rigid matte gift box, die-cut decals, and DTF jersey print",
  },
  {
    id: "pf-4",
    title: "Spectra Industrial Vinyl Roll",
    category: "Banners",
    subtitle: "High-contrast storefront and backdrop flex installation",
  },
  {
    id: "pf-5",
    title: "Atelier Brand System & Swatch Calibration",
    category: "Branding",
    subtitle: "Vector identity system with full CMYK press specifications",
  },
  {
    id: "pf-6",
    title: "Cybernetic Die-Cut Sticker & Badge Kit",
    category: "Custom Printing",
    subtitle: "Holographic laminated vinyl decals & CR80 staff access badges",
  },
  {
    id: "pf-7",
    title: "Editorial Tri-Fold & Gala Invite System",
    category: "Graphic Design",
    subtitle: "Precision layout architecture & dark-ink spot varnishing",
  },
];

const seededDbs = new WeakSet<D1Database>();

export async function ensureSeeded(db: D1Database): Promise<void> {
  if (seededDbs.has(db)) return;
  await ensureSchemaTables(db);
  const now = new Date().toISOString();

  // Website settings
  const settingRow = await db
    .prepare("SELECT setting_key FROM website_settings WHERE setting_key = ?")
    .bind("site_cms")
    .first<{ setting_key: string }>();
  if (!settingRow) {
    await db
      .prepare(
        "INSERT OR IGNORE INTO website_settings (setting_key, setting_value, updated_at) VALUES (?, ?, ?)"
      )
      .bind("site_cms", JSON.stringify(DEFAULT_WEBSITE_SETTINGS), now)
      .run();
  }

  // Outfits
  const outfitCount = await db
    .prepare("SELECT COUNT(*) as cnt FROM outfit_templates")
    .first<{ cnt: number }>();
  if (!outfitCount || Number(outfitCount.cnt) === 0) {
    const builtIns = DRESS_PRESETS.filter((d) => d.id !== "none" && d.category !== "None");
    for (let i = 0; i < builtIns.length; i += 1) {
      const item = builtIns[i];
      await db
        .prepare(
          `INSERT OR IGNORE INTO outfit_templates
           (id, slug, name, category, builtin_style_id, media_id, image_url, display_order, is_published, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, NULL, NULL, ?, 1, ?, ?)`
        )
        .bind(
          `outfit-${item.id}`,
          item.id,
          item.label,
          item.category,
          item.id,
          i + 1,
          now,
          now
        )
        .run();
    }
  }

  // Background Presets
  const bgCount = await db
    .prepare("SELECT COUNT(*) as cnt FROM background_presets")
    .first<{ cnt: number }>();
  if (!bgCount || Number(bgCount.cnt) === 0) {
    for (let i = 0; i < BG_COLORS.length; i += 1) {
      const bg = BG_COLORS[i];
      await db
        .prepare(
          `INSERT OR IGNORE INTO background_presets
           (id, name, preset_type, hex_color, media_id, image_url, display_order, is_published, created_at, updated_at)
           VALUES (?, ?, 'color', ?, NULL, NULL, ?, 1, ?, ?)`
        )
        .bind(`bg-${i + 1}`, bg.name, bg.hex, i + 1, now, now)
        .run();
    }
  }

  // Services
  const srvCount = await db
    .prepare("SELECT COUNT(*) as cnt FROM services")
    .first<{ cnt: number }>();
  if (!srvCount || Number(srvCount.cnt) === 0) {
    for (let i = 0; i < DEFAULT_SERVICES_SEED.length; i += 1) {
      const s = DEFAULT_SERVICES_SEED[i];
      await db
        .prepare(
          `INSERT OR IGNORE INTO services
           (id, name, description, category, studio_mode, media_id, image_url, display_order, is_published, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, NULL, NULL, ?, 1, ?, ?)`
        )
        .bind(s.id, s.name, s.description, s.category, s.studio_mode, i + 1, now, now)
        .run();
    }
  }

  // Portfolio
  const pfCount = await db
    .prepare("SELECT COUNT(*) as cnt FROM portfolio_items")
    .first<{ cnt: number }>();
  if (!pfCount || Number(pfCount.cnt) === 0) {
    for (let i = 0; i < DEFAULT_PORTFOLIO_SEED.length; i += 1) {
      const p = DEFAULT_PORTFOLIO_SEED[i];
      await db
        .prepare(
          `INSERT OR IGNORE INTO portfolio_items
           (id, title, subtitle, category, media_id, image_url, display_order, is_published, created_at, updated_at)
           VALUES (?, ?, ?, ?, NULL, NULL, ?, 1, ?, ?)`
        )
        .bind(p.id, p.title, p.subtitle, p.category, i + 1, now, now)
        .run();
    }
  }

  seededDbs.add(db);
}

export async function readWebsiteSettings(db: D1Database): Promise<WebsiteSettings> {
  await ensureSeeded(db);
  const row = await db
    .prepare("SELECT setting_value FROM website_settings WHERE setting_key = ?")
    .bind("site_cms")
    .first<{ setting_value: string }>();
  if (!row?.setting_value) return DEFAULT_WEBSITE_SETTINGS;
  try {
    const parsed = JSON.parse(row.setting_value) as Partial<WebsiteSettings>;
    return {
      ...DEFAULT_WEBSITE_SETTINGS,
      ...parsed,
      navLinks:
        Array.isArray(parsed.navLinks) && parsed.navLinks.length > 0
          ? parsed.navLinks
          : DEFAULT_WEBSITE_SETTINGS.navLinks,
      socialLinks: Array.isArray(parsed.socialLinks) ? parsed.socialLinks : [],
      allowAnyUpload:
        typeof parsed.allowAnyUpload === "boolean"
          ? parsed.allowAnyUpload
          : DEFAULT_WEBSITE_SETTINGS.allowAnyUpload,
      allowedUploadExtensions:
        Array.isArray(parsed.allowedUploadExtensions) &&
        parsed.allowedUploadExtensions.length > 0
          ? parsed.allowedUploadExtensions
          : DEFAULT_WEBSITE_SETTINGS.allowedUploadExtensions,
      maxCustomUploadMb:
        typeof parsed.maxCustomUploadMb === "number" && parsed.maxCustomUploadMb > 0
          ? parsed.maxCustomUploadMb
          : DEFAULT_WEBSITE_SETTINGS.maxCustomUploadMb,
      uploadCategories:
        Array.isArray(parsed.uploadCategories) && parsed.uploadCategories.length > 0
          ? parsed.uploadCategories
          : DEFAULT_WEBSITE_SETTINGS.uploadCategories,
    };
  } catch {
    return DEFAULT_WEBSITE_SETTINGS;
  }
}
