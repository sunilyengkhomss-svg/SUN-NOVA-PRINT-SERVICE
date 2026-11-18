import React, { useEffect, useState } from "react";
import { Eye, EyeOff, Plus, Save, Trash2, Upload } from "lucide-react";
import {
  PortfolioItemRecord,
  ServiceRecord,
  WebsiteSettings,
} from "../../types/cms";
import {
  createPortfolioItem,
  createService,
  deletePortfolioItem,
  deleteService,
  updateAdminSettings,
  updatePortfolioItem,
  updateService,
  uploadMediaFiles,
} from "../../utils/adminApi";

interface AdminCmsTabProps {
  settings: WebsiteSettings;
  services: ServiceRecord[];
  portfolio: PortfolioItemRecord[];
  onRefresh: () => Promise<void>;
}

type CmsSubTab = "homepage" | "services" | "portfolio" | "about_contact";

export function AdminCmsTab({
  settings,
  services,
  portfolio,
  onRefresh,
}: AdminCmsTabProps) {
  const [subTab, setSubTab] = useState<CmsSubTab>("homepage");
  const [form, setForm] = useState<WebsiteSettings>(settings);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // New Service
  const [srvName, setSrvName] = useState("");
  const [srvDesc, setSrvDesc] = useState("");
  const [srvCat, setSrvCat] = useState("Commercial Printing");
  const [srvFile, setSrvFile] = useState<File | null>(null);

  // New Portfolio
  const [pfTitle, setPfTitle] = useState("");
  const [pfSubtitle, setPfSubtitle] = useState("");
  const [pfCat, setPfCat] = useState("Branding");
  const [pfFile, setPfFile] = useState<File | null>(null);

  useEffect(() => {
    setForm(settings);
  }, [settings]);

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setStatus(null);
    try {
      await updateAdminSettings(form);
      setStatus("Website settings saved & published to live site.");
      await onRefresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save settings.");
    } finally {
      setSaving(false);
    }
  };

  const handleUploadSettingImg = async (
    field: "heroBgImageUrl" | "aboutImageUrl" | "logoImageUrl",
    file: File | undefined
  ) => {
    if (!file) return;
    setError(null);
    try {
      const up = await uploadMediaFiles([file], "cms", "public");
      const url = up.files[0]?.public_url || "";
      if (url) {
        const next = { ...form, [field]: url };
        setForm(next);
        await updateAdminSettings(next);
        setStatus("Uploaded image to R2 & updated live website.");
        await onRefresh();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Image upload failed.");
    }
  };

  const handleAddService = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!srvName.trim() || !srvDesc.trim()) return;
    setSaving(true);
    setError(null);
    try {
      let mediaId: string | null = null;
      let imageUrl: string | null = null;
      if (srvFile) {
        const up = await uploadMediaFiles([srvFile], "service", "public");
        mediaId = up.files[0]?.id || null;
        imageUrl = up.files[0]?.public_url || null;
      }
      await createService({
        name: srvName.trim(),
        description: srvDesc.trim(),
        category: srvCat.trim(),
        mediaId,
        imageUrl,
        displayOrder: services.length + 1,
        isPublished: true,
      });
      setSrvName("");
      setSrvDesc("");
      setSrvFile(null);
      setStatus("Service created & published.");
      await onRefresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create service.");
    } finally {
      setSaving(false);
    }
  };

  const handleAddPortfolio = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pfTitle.trim()) return;
    setSaving(true);
    setError(null);
    try {
      let mediaId: string | null = null;
      let imageUrl: string | null = null;
      if (pfFile) {
        const up = await uploadMediaFiles([pfFile], "portfolio", "public");
        mediaId = up.files[0]?.id || null;
        imageUrl = up.files[0]?.public_url || null;
      }
      await createPortfolioItem({
        title: pfTitle.trim(),
        subtitle: pfSubtitle.trim(),
        category: pfCat,
        mediaId,
        imageUrl,
        displayOrder: portfolio.length + 1,
        isPublished: true,
      });
      setPfTitle("");
      setPfSubtitle("");
      setPfFile(null);
      setStatus("Portfolio item published.");
      await onRefresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create portfolio item.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 p-1.5 bg-[#111827]/90 border border-[#00E5FF]/20 rounded-xl">
        {(
          [
            ["homepage", "Hero & Navigation"],
            ["services", "Services"],
            ["portfolio", "Portfolio Gallery"],
            ["about_contact", "About & Contact"],
          ] as [CmsSubTab, string][]
        ).map(([k, label]) => (
          <button
            key={k}
            type="button"
            onClick={() => setSubTab(k)}
            className={`px-3 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              subTab === k
                ? "bg-gradient-to-r from-[#00E5FF] to-[#8B5CF6] text-[#080B12]"
                : "text-[#94A3B8] hover:text-[#F5F7FA]"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {error && (
        <div className="text-xs text-rose-200 bg-rose-950/60 border border-rose-500/40 rounded-xl px-4 py-2.5">
          {error}
        </div>
      )}
      {status && (
        <div className="text-xs text-emerald-200 bg-emerald-950/60 border border-emerald-500/40 rounded-xl px-4 py-2.5">
          {status}
        </div>
      )}

      {subTab === "homepage" && (
        <form
          onSubmit={handleSaveSettings}
          className="bg-[#111827]/85 border border-[#00E5FF]/20 rounded-2xl p-4 sm:p-6 space-y-5"
        >
          <h2 className="text-base font-bold text-[#F5F7FA]">
            Homepage Hero &amp; Navigation CMS
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-[#94A3B8] mb-1">
                Headline Line 1
              </label>
              <input
                type="text"
                value={form.heroHeadlineTop}
                onChange={(e) => setForm({ ...form, heroHeadlineTop: e.target.value })}
                className="w-full bg-[#080B12] border border-[#00E5FF]/25 rounded-xl px-3 py-2 text-xs text-[#F5F7FA]"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#94A3B8] mb-1">
                Highlighted Word
              </label>
              <input
                type="text"
                value={form.heroHeadlineHighlight}
                onChange={(e) =>
                  setForm({ ...form, heroHeadlineHighlight: e.target.value })
                }
                className="w-full bg-[#080B12] border border-[#00E5FF]/25 rounded-xl px-3 py-2 text-xs text-[#00E5FF] font-bold"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#94A3B8] mb-1">
                Headline Line 3
              </label>
              <input
                type="text"
                value={form.heroHeadlineBottom}
                onChange={(e) => setForm({ ...form, heroHeadlineBottom: e.target.value })}
                className="w-full bg-[#080B12] border border-[#00E5FF]/25 rounded-xl px-3 py-2 text-xs text-[#F5F7FA]"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#94A3B8] mb-1">
              Hero Subtitle
            </label>
            <textarea
              rows={2}
              value={form.heroSubtitle}
              onChange={(e) => setForm({ ...form, heroSubtitle: e.target.value })}
              className="w-full bg-[#080B12] border border-[#00E5FF]/25 rounded-xl px-3 py-2 text-xs text-[#F5F7FA]"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-[#94A3B8] mb-1">
                Primary CTA Label / Link
              </label>
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="text"
                  value={form.heroPrimaryCtaLabel}
                  onChange={(e) =>
                    setForm({ ...form, heroPrimaryCtaLabel: e.target.value })
                  }
                  className="bg-[#080B12] border border-[#00E5FF]/25 rounded-xl px-3 py-2 text-xs text-[#F5F7FA]"
                />
                <input
                  type="text"
                  value={form.heroPrimaryCtaHref}
                  onChange={(e) =>
                    setForm({ ...form, heroPrimaryCtaHref: e.target.value })
                  }
                  className="bg-[#080B12] border border-[#00E5FF]/25 rounded-xl px-3 py-2 text-xs font-mono-nums text-[#F5F7FA]"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#94A3B8] mb-1">
                Secondary CTA Label / Link
              </label>
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="text"
                  value={form.heroSecondaryCtaLabel}
                  onChange={(e) =>
                    setForm({ ...form, heroSecondaryCtaLabel: e.target.value })
                  }
                  className="bg-[#080B12] border border-[#00E5FF]/25 rounded-xl px-3 py-2 text-xs text-[#F5F7FA]"
                />
                <input
                  type="text"
                  value={form.heroSecondaryCtaHref}
                  onChange={(e) =>
                    setForm({ ...form, heroSecondaryCtaHref: e.target.value })
                  }
                  className="bg-[#080B12] border border-[#00E5FF]/25 rounded-xl px-3 py-2 text-xs font-mono-nums text-[#F5F7FA]"
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-white/10">
            <div>
              <label className="block text-xs font-semibold text-[#94A3B8] mb-1">
                Navbar Logo Text
              </label>
              <input
                type="text"
                value={form.logoText}
                onChange={(e) => setForm({ ...form, logoText: e.target.value })}
                className="w-full bg-[#080B12] border border-[#00E5FF]/25 rounded-xl px-3 py-2 text-xs text-[#F5F7FA]"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#94A3B8] mb-1">
                Hero Background Image (Optional Custom R2 Override)
              </label>
              <label className="flex items-center justify-between gap-2 bg-[#080B12] border border-dashed border-[#00E5FF]/35 rounded-xl px-3 py-2 text-xs text-[#94A3B8] cursor-pointer">
                <span className="truncate">
                  {form.heroBgImageUrl ? "Custom Hero Backdrop Active" : "Upload Hero Background..."}
                </span>
                <Upload className="w-3.5 h-3.5 text-[#00E5FF]" />
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={(e) => handleUploadSettingImg("heroBgImageUrl", e.target.files?.[0])}
                  className="hidden"
                />
              </label>
            </div>
          </div>

          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-2 bg-gradient-to-r from-[#00E5FF] to-[#8B5CF6] text-[#080B12] font-bold text-xs px-6 py-2.5 rounded-xl cursor-pointer disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            <span>{saving ? "Saving..." : "Save & Publish Homepage"}</span>
          </button>
        </form>
      )}

      {subTab === "services" && (
        <div className="space-y-6">
          <form
            onSubmit={handleAddService}
            className="bg-[#111827]/85 border border-[#00E5FF]/20 rounded-2xl p-4 sm:p-6 space-y-4"
          >
            <h2 className="text-base font-bold text-[#F5F7FA]">Add Website Service</h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <input
                type="text"
                required
                value={srvName}
                onChange={(e) => setSrvName(e.target.value)}
                placeholder="Service Name (e.g. Acrylic Signboard)"
                className="bg-[#080B12] border border-[#00E5FF]/25 rounded-xl px-3 py-2 text-xs text-[#F5F7FA]"
              />
              <input
                type="text"
                value={srvCat}
                onChange={(e) => setSrvCat(e.target.value)}
                placeholder="Category"
                className="bg-[#080B12] border border-[#00E5FF]/25 rounded-xl px-3 py-2 text-xs text-[#F5F7FA]"
              />
              <label className="flex items-center justify-between gap-2 bg-[#080B12] border border-dashed border-[#00E5FF]/35 rounded-xl px-3 py-2 text-xs text-[#94A3B8] cursor-pointer">
                <span className="truncate">{srvFile ? srvFile.name : "Upload Image..."}</span>
                <Upload className="w-3.5 h-3.5 text-[#00E5FF]" />
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={(e) => setSrvFile(e.target.files?.[0] || null)}
                  className="hidden"
                />
              </label>
            </div>
            <textarea
              rows={2}
              required
              value={srvDesc}
              onChange={(e) => setSrvDesc(e.target.value)}
              placeholder="Service description..."
              className="w-full bg-[#080B12] border border-[#00E5FF]/25 rounded-xl px-3 py-2 text-xs text-[#F5F7FA]"
            />
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-2 bg-gradient-to-r from-[#00E5FF] to-[#8B5CF6] text-[#080B12] font-bold text-xs px-5 py-2.5 rounded-xl cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Add Service</span>
            </button>
          </form>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {services.map((s) => (
              <div
                key={s.id}
                className="bg-[#111827]/90 border border-[#00E5FF]/20 rounded-2xl p-4 space-y-2.5"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <span className="text-[10px] font-mono-nums text-[#00E5FF]">
                      {s.category} · Order #{s.display_order}
                    </span>
                    <h3 className="text-sm font-bold text-[#F5F7FA]">{s.name}</h3>
                  </div>
                  <button
                    type="button"
                    onClick={async () => {
                      await updateService(s.id, { isPublished: !s.is_published });
                      await onRefresh();
                    }}
                    className="p-1.5 rounded-lg bg-[#161D2B] text-xs cursor-pointer"
                    title={s.is_published ? "Unpublish service" : "Publish service"}
                  >
                    {s.is_published ? (
                      <Eye className="w-3.5 h-3.5 text-emerald-400" />
                    ) : (
                      <EyeOff className="w-3.5 h-3.5 text-slate-400" />
                    )}
                  </button>
                </div>
                <p className="text-xs text-[#94A3B8] line-clamp-2">{s.description}</p>
                <div className="flex items-center justify-between pt-2 border-t border-white/10">
                  <span className="text-[11px] font-mono-nums text-[#94A3B8]">
                    {s.is_published ? "Visible" : "Hidden"}
                  </span>
                  <button
                    type="button"
                    onClick={async () => {
                      await deleteService(s.id);
                      await onRefresh();
                    }}
                    className="p-1.5 rounded-lg bg-rose-950/60 text-rose-300 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {subTab === "portfolio" && (
        <div className="space-y-6">
          <form
            onSubmit={handleAddPortfolio}
            className="bg-[#111827]/85 border border-[#00E5FF]/20 rounded-2xl p-4 sm:p-6 space-y-4"
          >
            <h2 className="text-base font-bold text-[#F5F7FA]">
              Add Portfolio Project
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <input
                type="text"
                required
                value={pfTitle}
                onChange={(e) => setPfTitle(e.target.value)}
                placeholder="Project Title"
                className="bg-[#080B12] border border-[#00E5FF]/25 rounded-xl px-3 py-2 text-xs text-[#F5F7FA]"
              />
              <select
                value={pfCat}
                onChange={(e) => setPfCat(e.target.value)}
                className="bg-[#080B12] border border-[#00E5FF]/25 rounded-xl px-3 py-2 text-xs text-[#F5F7FA]"
              >
                <option value="Branding">Branding</option>
                <option value="Business Cards">Business Cards</option>
                <option value="Banners">Banners</option>
                <option value="Posters">Posters</option>
                <option value="Packaging">Packaging</option>
                <option value="Graphic Design">Graphic Design</option>
                <option value="Custom Printing">Custom Printing</option>
              </select>
              <label className="flex items-center justify-between gap-2 bg-[#080B12] border border-dashed border-[#00E5FF]/35 rounded-xl px-3 py-2 text-xs text-[#94A3B8] cursor-pointer">
                <span className="truncate">{pfFile ? pfFile.name : "Upload Project Image..."}</span>
                <Upload className="w-3.5 h-3.5 text-[#00E5FF]" />
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={(e) => setPfFile(e.target.files?.[0] || null)}
                  className="hidden"
                />
              </label>
            </div>
            <input
              type="text"
              value={pfSubtitle}
              onChange={(e) => setPfSubtitle(e.target.value)}
              placeholder="Short project specs / description"
              className="w-full bg-[#080B12] border border-[#00E5FF]/25 rounded-xl px-3 py-2 text-xs text-[#F5F7FA]"
            />
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-2 bg-gradient-to-r from-[#00E5FF] to-[#8B5CF6] text-[#080B12] font-bold text-xs px-5 py-2.5 rounded-xl cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Publish Project</span>
            </button>
          </form>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {portfolio.map((item) => (
              <div
                key={item.id}
                className="bg-[#111827]/90 border border-[#00E5FF]/20 rounded-2xl p-4 space-y-2.5"
              >
                {item.image_url && (
                  <img
                    src={item.image_url}
                    alt={item.title}
                    className="h-32 w-full object-cover rounded-xl bg-[#080B12]"
                  />
                )}
                <div>
                  <span className="text-[10px] font-mono-nums text-[#00E5FF]">
                    {item.category}
                  </span>
                  <h3 className="text-sm font-bold text-[#F5F7FA]">{item.title}</h3>
                  <p className="text-xs text-[#94A3B8] line-clamp-2">{item.subtitle}</p>
                </div>
                <div className="flex items-center justify-between pt-2 border-t border-white/10">
                  <button
                    type="button"
                    onClick={async () => {
                      await updatePortfolioItem(item.id, {
                        isPublished: !item.is_published,
                      });
                      await onRefresh();
                    }}
                    className="px-2.5 py-1 rounded-lg bg-[#161D2B] text-xs font-semibold text-[#F5F7FA] cursor-pointer"
                  >
                    {item.is_published ? "Unpublish" : "Publish"}
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      await deletePortfolioItem(item.id);
                      await onRefresh();
                    }}
                    className="p-1.5 rounded-lg bg-rose-950/60 text-rose-300 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {subTab === "about_contact" && (
        <form
          onSubmit={handleSaveSettings}
          className="bg-[#111827]/85 border border-[#00E5FF]/20 rounded-2xl p-4 sm:p-6 space-y-4"
        >
          <h2 className="text-base font-bold text-[#F5F7FA]">
            About Us, Contact Desk &amp; Upload Limits
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-[#94A3B8] mb-1">
                About Headline
              </label>
              <input
                type="text"
                value={form.aboutHeadline}
                onChange={(e) => setForm({ ...form, aboutHeadline: e.target.value })}
                className="w-full bg-[#080B12] border border-[#00E5FF]/25 rounded-xl px-3 py-2 text-xs text-[#F5F7FA]"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#94A3B8] mb-1">
                Contact Desk Email
              </label>
              <input
                type="email"
                value={form.contactEmail}
                onChange={(e) => setForm({ ...form, contactEmail: e.target.value })}
                className="w-full bg-[#080B12] border border-[#00E5FF]/25 rounded-xl px-3 py-2 text-xs text-[#F5F7FA]"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#94A3B8] mb-1">
              Business Description
            </label>
            <textarea
              rows={3}
              value={form.aboutDescription}
              onChange={(e) => setForm({ ...form, aboutDescription: e.target.value })}
              className="w-full bg-[#080B12] border border-[#00E5FF]/25 rounded-xl px-3 py-2 text-xs text-[#F5F7FA]"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-[#94A3B8] mb-1">
                Studio Address
              </label>
              <input
                type="text"
                value={form.contactAddress}
                onChange={(e) => setForm({ ...form, contactAddress: e.target.value })}
                className="w-full bg-[#080B12] border border-[#00E5FF]/25 rounded-xl px-3 py-2 text-xs text-[#F5F7FA]"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs font-semibold text-[#94A3B8] mb-1">
                  Max Image (MB)
                </label>
                <input
                  type="number"
                  min={1}
                  max={50}
                  value={form.maxImageUploadMb}
                  onChange={(e) =>
                    setForm({ ...form, maxImageUploadMb: Number(e.target.value) || 10 })
                  }
                  className="w-full bg-[#080B12] border border-[#00E5FF]/25 rounded-xl px-3 py-2 text-xs font-mono-nums text-[#F5F7FA]"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#94A3B8] mb-1">
                  Max PDF (MB)
                </label>
                <input
                  type="number"
                  min={1}
                  max={100}
                  value={form.maxPdfUploadMb}
                  onChange={(e) =>
                    setForm({ ...form, maxPdfUploadMb: Number(e.target.value) || 20 })
                  }
                  className="w-full bg-[#080B12] border border-[#00E5FF]/25 rounded-xl px-3 py-2 text-xs font-mono-nums text-[#F5F7FA]"
                />
              </div>
            </div>
          </div>

          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-2 bg-gradient-to-r from-[#00E5FF] to-[#8B5CF6] text-[#080B12] font-bold text-xs px-6 py-2.5 rounded-xl cursor-pointer"
          >
            <Save className="w-4 h-4" />
            <span>{saving ? "Saving..." : "Save Contact & CMS Settings"}</span>
          </button>
        </form>
      )}
    </div>
  );
}
