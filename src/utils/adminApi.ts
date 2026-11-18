import {
  ActivityLogRecord,
  AdminOverviewPayload,
  AdminRole,
  AdminUser,
  BackgroundPresetRecord,
  ContactMessageRecord,
  MediaFileRecord,
  MediaVisibility,
  OutfitCategory,
  OutfitTemplateRecord,
  PortfolioItemRecord,
  PublicBootstrapPayload,
  QuoteRequestRecord,
  QuoteStatus,
  SamplePortraitRecord,
  ServiceRecord,
  StorageStatusInfo,
  WebsiteSettings,
} from "../types/cms";

async function apiRequest<T>(
  url: string,
  options: RequestInit & { isAdminMutation?: boolean } = {}
): Promise<T> {
  const { isAdminMutation, headers, ...rest } = options;
  const reqHeaders = new Headers(headers || {});
  if (isAdminMutation) {
    reqHeaders.set("X-Requested-With", "SunNovaAdmin");
  }
  if (
    rest.body &&
    typeof rest.body === "string" &&
    !reqHeaders.has("Content-Type")
  ) {
    reqHeaders.set("Content-Type", "application/json");
  }

  const res = await fetch(url, {
    ...rest,
    headers: reqHeaders,
    credentials: "include",
  });

  const data = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) {
    throw new Error(data?.error || `Request failed (${res.status})`);
  }
  return data;
}

export async function fetchPublicBootstrap(): Promise<PublicBootstrapPayload> {
  return apiRequest<PublicBootstrapPayload>("/api/public/bootstrap");
}

export async function submitPublicQuote(payload: FormData): Promise<{ ok: boolean; quoteId: string }> {
  return apiRequest<{ ok: boolean; quoteId: string }>("/api/public/quotes", {
    method: "POST",
    body: payload,
  });
}

export async function submitPublicContact(payload: {
  customerName: string;
  customerEmail: string;
  phoneNumber?: string;
  subject: string;
  message: string;
}): Promise<{ ok: boolean; messageId: string }> {
  return apiRequest<{ ok: boolean; messageId: string }>("/api/public/contact", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function fetchBootstrapStatus(): Promise<{
  needsSetup: boolean;
  setupTokenRequired: boolean;
  admin?: AdminUser | null;
  storageStatus?: StorageStatusInfo;
}> {
  return apiRequest("/api/admin/bootstrap-status");
}

export async function setupInitialSuperAdmin(payload: {
  name: string;
  email: string;
  password: string;
  setupToken?: string;
}): Promise<{ admin: AdminUser }> {
  return apiRequest("/api/admin/setup", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function loginAdmin(payload: {
  email: string;
  password: string;
  remember: boolean;
}): Promise<{ admin: AdminUser }> {
  return apiRequest("/api/admin/login", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function logoutAdmin(): Promise<void> {
  await apiRequest("/api/admin/logout", { method: "POST", isAdminMutation: true });
}

export async function fetchCurrentAdmin(): Promise<{ admin: AdminUser }> {
  return apiRequest("/api/admin/me");
}

export async function requestPasswordReset(email: string): Promise<{
  ok: boolean;
  emailDispatched: boolean;
  message: string;
}> {
  return apiRequest("/api/admin/forgot-password", {
    method: "POST",
    body: JSON.stringify({ email }),
  });
}

export async function resetAdminPassword(payload: {
  email: string;
  token: string;
  newPassword: string;
}): Promise<{ ok: boolean; message: string }> {
  return apiRequest("/api/admin/reset-password", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function fetchAdminOverview(): Promise<AdminOverviewPayload> {
  return apiRequest("/api/admin/overview");
}

export async function fetchAdminMedia(): Promise<{ files: MediaFileRecord[] }> {
  return apiRequest("/api/admin/media");
}

export async function uploadMediaFiles(
  files: File[],
  category: string,
  visibility: MediaVisibility = "public",
  customFilename?: string
): Promise<{ files: MediaFileRecord[] }> {
  const fd = new FormData();
  fd.set("category", category);
  fd.set("visibility", visibility);
  if (customFilename?.trim()) {
    fd.set("customFilename", customFilename.trim());
  }
  for (const f of files) {
    fd.append("files", f);
  }
  return apiRequest("/api/admin/media/upload", {
    method: "POST",
    body: fd,
    isAdminMutation: true,
  });
}

export async function updateMediaMetadata(
  id: string,
  payload: { filename?: string; category?: string }
): Promise<{ file: MediaFileRecord }> {
  return apiRequest(`/api/admin/media/${encodeURIComponent(id)}`, {
    method: "PUT",
    body: JSON.stringify(payload),
    isAdminMutation: true,
  });
}

export async function replaceMediaFile(
  id: string,
  file: File
): Promise<{ file: MediaFileRecord }> {
  const fd = new FormData();
  fd.set("file", file);
  return apiRequest(`/api/admin/media/${encodeURIComponent(id)}/replace`, {
    method: "POST",
    body: fd,
    isAdminMutation: true,
  });
}

export async function deleteMediaFile(
  id: string,
  force = false
): Promise<{ ok: boolean }> {
  return apiRequest(
    `/api/admin/media/${encodeURIComponent(id)}${force ? "?force=true" : ""}`,
    {
      method: "DELETE",
      isAdminMutation: true,
    }
  );
}

export async function bulkDeleteMediaFiles(
  ids: string[],
  force = true
): Promise<{ ok: boolean; deletedCount: number }> {
  return apiRequest("/api/admin/media/bulk-delete", {
    method: "POST",
    body: JSON.stringify({ ids, force }),
    isAdminMutation: true,
  });
}

export async function fetchAdminOutfits(): Promise<{
  outfits: OutfitTemplateRecord[];
}> {
  return apiRequest("/api/admin/outfits");
}

export async function createOutfit(payload: {
  name: string;
  category: OutfitCategory;
  mediaId?: string | null;
  imageUrl?: string | null;
  displayOrder?: number;
  isPublished?: boolean;
}): Promise<{ outfit: OutfitTemplateRecord }> {
  return apiRequest("/api/admin/outfits", {
    method: "POST",
    body: JSON.stringify(payload),
    isAdminMutation: true,
  });
}

export async function updateOutfit(
  id: string,
  payload: {
    name?: string;
    category?: OutfitCategory;
    mediaId?: string | null;
    imageUrl?: string | null;
    displayOrder?: number;
    isPublished?: boolean;
  }
): Promise<{ outfit: OutfitTemplateRecord }> {
  return apiRequest(`/api/admin/outfits/${encodeURIComponent(id)}`, {
    method: "PUT",
    body: JSON.stringify(payload),
    isAdminMutation: true,
  });
}

export async function deleteOutfit(id: string): Promise<{ ok: boolean }> {
  return apiRequest(`/api/admin/outfits/${encodeURIComponent(id)}`, {
    method: "DELETE",
    isAdminMutation: true,
  });
}

export async function fetchAdminBackgrounds(): Promise<{
  backgrounds: BackgroundPresetRecord[];
}> {
  return apiRequest("/api/admin/backgrounds");
}

export async function createBackground(payload: {
  name: string;
  presetType: "color" | "image";
  hexColor?: string;
  mediaId?: string | null;
  imageUrl?: string | null;
  displayOrder?: number;
  isPublished?: boolean;
}): Promise<{ background: BackgroundPresetRecord }> {
  return apiRequest("/api/admin/backgrounds", {
    method: "POST",
    body: JSON.stringify(payload),
    isAdminMutation: true,
  });
}

export async function updateBackground(
  id: string,
  payload: {
    name?: string;
    presetType?: "color" | "image";
    hexColor?: string | null;
    mediaId?: string | null;
    imageUrl?: string | null;
    displayOrder?: number;
    isPublished?: boolean;
  }
): Promise<{ background: BackgroundPresetRecord }> {
  return apiRequest(`/api/admin/backgrounds/${encodeURIComponent(id)}`, {
    method: "PUT",
    body: JSON.stringify(payload),
    isAdminMutation: true,
  });
}

export async function deleteBackground(id: string): Promise<{ ok: boolean }> {
  return apiRequest(`/api/admin/backgrounds/${encodeURIComponent(id)}`, {
    method: "DELETE",
    isAdminMutation: true,
  });
}

export async function fetchAdminPortraits(): Promise<{
  portraits: SamplePortraitRecord[];
}> {
  return apiRequest("/api/admin/portraits");
}

export async function createPortrait(payload: {
  title: string;
  mediaId?: string | null;
  imageUrl?: string | null;
  displayOrder?: number;
  isPublished?: boolean;
}): Promise<{ portrait: SamplePortraitRecord }> {
  return apiRequest("/api/admin/portraits", {
    method: "POST",
    body: JSON.stringify(payload),
    isAdminMutation: true,
  });
}

export async function updatePortrait(
  id: string,
  payload: {
    title?: string;
    mediaId?: string | null;
    imageUrl?: string;
    displayOrder?: number;
    isPublished?: boolean;
  }
): Promise<{ portrait: SamplePortraitRecord }> {
  return apiRequest(`/api/admin/portraits/${encodeURIComponent(id)}`, {
    method: "PUT",
    body: JSON.stringify(payload),
    isAdminMutation: true,
  });
}

export async function deletePortrait(id: string): Promise<{ ok: boolean }> {
  return apiRequest(`/api/admin/portraits/${encodeURIComponent(id)}`, {
    method: "DELETE",
    isAdminMutation: true,
  });
}

export async function fetchAdminSettings(): Promise<{ settings: WebsiteSettings }> {
  return apiRequest("/api/admin/settings");
}

export async function updateAdminSettings(
  settings: Partial<WebsiteSettings>
): Promise<{ settings: WebsiteSettings }> {
  return apiRequest("/api/admin/settings", {
    method: "PUT",
    body: JSON.stringify(settings),
    isAdminMutation: true,
  });
}

export async function fetchAdminServices(): Promise<{ services: ServiceRecord[] }> {
  return apiRequest("/api/admin/services");
}

export async function createService(payload: {
  name: string;
  description: string;
  category: string;
  studioMode?: ServiceRecord["studio_mode"];
  mediaId?: string | null;
  imageUrl?: string | null;
  displayOrder?: number;
  isPublished?: boolean;
}): Promise<{ service: ServiceRecord }> {
  return apiRequest("/api/admin/services", {
    method: "POST",
    body: JSON.stringify(payload),
    isAdminMutation: true,
  });
}

export async function updateService(
  id: string,
  payload: {
    name?: string;
    description?: string;
    category?: string;
    studioMode?: ServiceRecord["studio_mode"];
    mediaId?: string | null;
    imageUrl?: string | null;
    displayOrder?: number;
    isPublished?: boolean;
  }
): Promise<{ service: ServiceRecord }> {
  return apiRequest(`/api/admin/services/${encodeURIComponent(id)}`, {
    method: "PUT",
    body: JSON.stringify(payload),
    isAdminMutation: true,
  });
}

export async function deleteService(id: string): Promise<{ ok: boolean }> {
  return apiRequest(`/api/admin/services/${encodeURIComponent(id)}`, {
    method: "DELETE",
    isAdminMutation: true,
  });
}

export async function fetchAdminPortfolio(): Promise<{
  portfolio: PortfolioItemRecord[];
}> {
  return apiRequest("/api/admin/portfolio");
}

export async function createPortfolioItem(payload: {
  title: string;
  subtitle: string;
  category: string;
  mediaId?: string | null;
  imageUrl?: string | null;
  displayOrder?: number;
  isPublished?: boolean;
}): Promise<{ item: PortfolioItemRecord }> {
  return apiRequest("/api/admin/portfolio", {
    method: "POST",
    body: JSON.stringify(payload),
    isAdminMutation: true,
  });
}

export async function updatePortfolioItem(
  id: string,
  payload: {
    title?: string;
    subtitle?: string;
    category?: string;
    mediaId?: string | null;
    imageUrl?: string | null;
    displayOrder?: number;
    isPublished?: boolean;
  }
): Promise<{ item: PortfolioItemRecord }> {
  return apiRequest(`/api/admin/portfolio/${encodeURIComponent(id)}`, {
    method: "PUT",
    body: JSON.stringify(payload),
    isAdminMutation: true,
  });
}

export async function deletePortfolioItem(id: string): Promise<{ ok: boolean }> {
  return apiRequest(`/api/admin/portfolio/${encodeURIComponent(id)}`, {
    method: "DELETE",
    isAdminMutation: true,
  });
}

export async function fetchAdminQuotes(): Promise<{ quotes: QuoteRequestRecord[] }> {
  return apiRequest("/api/admin/quotes");
}

export async function updateQuoteRequest(
  id: string,
  payload: { status?: QuoteStatus; internalNotes?: string }
): Promise<{ quote: QuoteRequestRecord }> {
  return apiRequest(`/api/admin/quotes/${encodeURIComponent(id)}`, {
    method: "PUT",
    body: JSON.stringify(payload),
    isAdminMutation: true,
  });
}

export async function deleteQuoteRequest(id: string): Promise<{ ok: boolean }> {
  return apiRequest(`/api/admin/quotes/${encodeURIComponent(id)}`, {
    method: "DELETE",
    isAdminMutation: true,
  });
}

export async function fetchAdminMessages(): Promise<{
  messages: ContactMessageRecord[];
  emailProviderConfigured: boolean;
}> {
  return apiRequest("/api/admin/messages");
}

export async function updateContactMessage(
  id: string,
  payload: { isRead: boolean }
): Promise<{ message: ContactMessageRecord }> {
  return apiRequest(`/api/admin/messages/${encodeURIComponent(id)}`, {
    method: "PUT",
    body: JSON.stringify(payload),
    isAdminMutation: true,
  });
}

export async function replyToContactMessage(
  id: string,
  payload: { subject: string; replyText: string }
): Promise<{ sent: boolean; configured: boolean; message: string }> {
  return apiRequest(`/api/admin/messages/${encodeURIComponent(id)}/reply`, {
    method: "POST",
    body: JSON.stringify(payload),
    isAdminMutation: true,
  });
}

export async function deleteContactMessage(id: string): Promise<{ ok: boolean }> {
  return apiRequest(`/api/admin/messages/${encodeURIComponent(id)}`, {
    method: "DELETE",
    isAdminMutation: true,
  });
}

export async function fetchAdminUsers(): Promise<{ users: AdminUser[] }> {
  return apiRequest("/api/admin/users");
}

export async function createAdminUser(payload: {
  name: string;
  email: string;
  password: string;
  role: AdminRole;
}): Promise<{ user: AdminUser }> {
  return apiRequest("/api/admin/users", {
    method: "POST",
    body: JSON.stringify(payload),
    isAdminMutation: true,
  });
}

export async function updateAdminUser(
  id: string,
  payload: {
    name?: string;
    role?: AdminRole;
    status?: "active" | "disabled";
    currentPassword?: string;
    newPassword?: string;
  }
): Promise<{ user: AdminUser }> {
  return apiRequest(`/api/admin/users/${encodeURIComponent(id)}`, {
    method: "PUT",
    body: JSON.stringify(payload),
    isAdminMutation: true,
  });
}

export async function deleteAdminUser(id: string): Promise<{ ok: boolean }> {
  return apiRequest(`/api/admin/users/${encodeURIComponent(id)}`, {
    method: "DELETE",
    isAdminMutation: true,
  });
}

export async function fetchAdminActivity(): Promise<{ logs: ActivityLogRecord[] }> {
  return apiRequest("/api/admin/activity");
}
