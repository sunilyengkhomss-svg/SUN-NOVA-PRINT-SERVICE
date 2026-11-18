export type AdminRole = "super_admin" | "admin" | "content_manager";

export interface AdminUser {
  id: string;
  name: string;
  email: string;
  role: AdminRole;
  status: "active" | "disabled";
  last_login_at: string | null;
  created_at: string;
  updated_at: string;
}

export type MediaVisibility = "public" | "private";

export interface MediaFileRecord {
  id: string;
  r2_key: string;
  filename: string;
  original_name: string;
  mime_type: string;
  file_size: number;
  category: string;
  visibility: MediaVisibility;
  public_url: string | null;
  uploaded_by: string | null;
  created_at: string;
  updated_at: string;
}

export type OutfitCategory =
  | "Student"
  | "Officer"
  | "Men"
  | "Women"
  | "Formal"
  | "Custom";

export interface OutfitTemplateRecord {
  id: string;
  slug: string;
  name: string;
  category: OutfitCategory;
  builtin_style_id: string | null;
  media_id: string | null;
  image_url: string | null;
  display_order: number;
  is_published: number;
  created_at: string;
  updated_at: string;
}

export interface BackgroundPresetRecord {
  id: string;
  name: string;
  preset_type: "color" | "image";
  hex_color: string | null;
  media_id: string | null;
  image_url: string | null;
  display_order: number;
  is_published: number;
  created_at: string;
  updated_at: string;
}

export interface SamplePortraitRecord {
  id: string;
  title: string;
  media_id: string | null;
  image_url: string;
  display_order: number;
  is_published: number;
  created_at: string;
  updated_at: string;
}

export interface ServiceRecord {
  id: string;
  name: string;
  description: string;
  category: string;
  studio_mode: "passport" | "xerox" | "converters" | "resume" | null;
  media_id: string | null;
  image_url: string | null;
  display_order: number;
  is_published: number;
  created_at: string;
  updated_at: string;
}

export interface PortfolioItemRecord {
  id: string;
  title: string;
  subtitle: string;
  category: string;
  media_id: string | null;
  image_url: string | null;
  display_order: number;
  is_published: number;
  created_at: string;
  updated_at: string;
}

export type QuoteStatus =
  | "New"
  | "Pending"
  | "Contacted"
  | "Quoted"
  | "Completed"
  | "Cancelled";

export interface QuoteRequestRecord {
  id: string;
  customer_name: string;
  customer_email: string;
  phone_number: string | null;
  service_type: string;
  quantity: string;
  paper_size: string;
  material: string | null;
  color_mode: string | null;
  description: string | null;
  attachment_media_id: string | null;
  attachment_name: string | null;
  status: QuoteStatus;
  internal_notes: string;
  created_at: string;
  updated_at: string;
}

export interface ContactMessageRecord {
  id: string;
  customer_name: string;
  customer_email: string;
  phone_number: string | null;
  subject: string;
  message: string;
  is_read: number;
  reply_note: string;
  replied_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ActivityLogRecord {
  id: string;
  admin_id: string | null;
  admin_email: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  details: string | null;
  created_at: string;
}

export interface NavLinkItem {
  label: string;
  href: string;
}

export interface WebsiteSettings {
  brandName: string;
  logoText: string;
  logoImageUrl: string;
  heroEyebrow: string;
  heroHeadlineTop: string;
  heroHeadlineHighlight: string;
  heroHeadlineBottom: string;
  heroSubtitle: string;
  heroBgImageUrl: string;
  heroPrimaryCtaLabel: string;
  heroPrimaryCtaHref: string;
  heroSecondaryCtaLabel: string;
  heroSecondaryCtaHref: string;
  navLinks: NavLinkItem[];
  aboutEyebrow: string;
  aboutHeadline: string;
  aboutDescription: string;
  aboutImageUrl: string;
  contactEmail: string;
  contactPhone: string;
  contactAddress: string;
  socialLinks: { label: string; url: string }[];
  maxImageUploadMb: number;
  maxPdfUploadMb: number;
  maxCustomUploadMb: number;
  allowAnyUpload: boolean;
  allowedUploadExtensions: string[];
  uploadCategories: string[];
}

export interface PublicBootstrapPayload {
  settings: WebsiteSettings;
  outfits: OutfitTemplateRecord[];
  backgrounds: BackgroundPresetRecord[];
  portraits: SamplePortraitRecord[];
  services: ServiceRecord[];
  portfolio: PortfolioItemRecord[];
}

export interface StorageStatusInfo {
  d1Bound: boolean;
  r2Bound: boolean;
  geminiConfigured: boolean;
  setupTokenConfigured?: boolean;
  emailProviderConfigured?: boolean;
  mode: "d1+r2" | "d1+d1blob" | "memory-fallback";
  summary: string;
}

export interface AdminOverviewPayload {
  counts: {
    totalImages: number;
    totalFiles: number;
    totalOutfits: number;
    totalBackgrounds: number;
    totalPortraits: number;
    totalPortfolio: number;
    totalServices: number;
    totalQuotes: number;
    unreadMessages: number;
    totalMessages: number;
  };
  quotesByStatus: { status: string; count: number }[];
  recentUploads: MediaFileRecord[];
  recentActivity: ActivityLogRecord[];
  storageStatus?: StorageStatusInfo;
}
