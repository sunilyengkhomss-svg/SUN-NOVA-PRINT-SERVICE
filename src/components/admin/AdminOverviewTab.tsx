import { useState } from "react";
import {
  Activity,
  AlertTriangle,
  Briefcase,
  Check,
  CheckCircle2,
  Copy,
  Database,
  FileText,
  FolderOpen,
  HardDrive,
  Image as ImageIcon,
  LayoutGrid,
  Mail,
  Palette,
  Plus,
  Shirt,
  Sparkles,
  Upload,
  UserCheck,
} from "lucide-react";
import { AdminOverviewPayload } from "../../types/cms";

export type AdminSectionKey =
  | "overview"
  | "media"
  | "outfits"
  | "backgrounds"
  | "portraits"
  | "cms"
  | "quotes"
  | "messages"
  | "users";

interface AdminOverviewTabProps {
  overview: AdminOverviewPayload | null;
  loading: boolean;
  onNavigate: (tab: AdminSectionKey) => void;
}

export function AdminOverviewTab({
  overview,
  loading,
  onNavigate,
}: AdminOverviewTabProps) {
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const copyValue = (id: string, text: string) => {
    navigator.clipboard?.writeText(text).catch(() => undefined);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1600);
  };
  const counts = overview?.counts ?? {
    totalImages: 0,
    totalFiles: 0,
    totalOutfits: 0,
    totalBackgrounds: 0,
    totalPortraits: 0,
    totalPortfolio: 0,
    totalServices: 0,
    totalQuotes: 0,
    unreadMessages: 0,
    totalMessages: 0,
  };
  const storageStatus = overview?.storageStatus;

  const statCards = [
    {
      label: "Uploaded Images",
      value: counts.totalImages,
      icon: ImageIcon,
      accent: "text-[#00E5FF]",
      tab: "media" as AdminSectionKey,
    },
    {
      label: "Uploaded Files",
      value: counts.totalFiles,
      icon: FileText,
      accent: "text-[#8B5CF6]",
      tab: "media" as AdminSectionKey,
    },
    {
      label: "Outfit Templates",
      value: counts.totalOutfits,
      icon: Shirt,
      accent: "text-[#00E5FF]",
      tab: "outfits" as AdminSectionKey,
    },
    {
      label: "Background Presets",
      value: counts.totalBackgrounds,
      icon: Palette,
      accent: "text-[#8B5CF6]",
      tab: "backgrounds" as AdminSectionKey,
    },
    {
      label: "Sample Portraits",
      value: counts.totalPortraits,
      icon: UserCheck,
      accent: "text-[#00E5FF]",
      tab: "portraits" as AdminSectionKey,
    },
    {
      label: "Portfolio Items",
      value: counts.totalPortfolio,
      icon: LayoutGrid,
      accent: "text-[#8B5CF6]",
      tab: "cms" as AdminSectionKey,
    },
    {
      label: "Website Services",
      value: counts.totalServices,
      icon: Briefcase,
      accent: "text-[#00E5FF]",
      tab: "cms" as AdminSectionKey,
    },
    {
      label: "Quote Requests",
      value: counts.totalQuotes,
      icon: FolderOpen,
      accent: "text-emerald-400",
      tab: "quotes" as AdminSectionKey,
    },
    {
      label: "Contact Messages",
      value: counts.totalMessages,
      sub: counts.unreadMessages > 0 ? `${counts.unreadMessages} unread` : "All read",
      icon: Mail,
      accent: "text-amber-300",
      tab: "messages" as AdminSectionKey,
    },
  ];

  const chartBars = [
    { label: "Images", count: counts.totalImages, color: "#00E5FF" },
    { label: "Outfits", count: counts.totalOutfits, color: "#8B5CF6" },
    { label: "Services", count: counts.totalServices, color: "#38BDF8" },
    { label: "Portfolio", count: counts.totalPortfolio, color: "#A78BFA" },
    { label: "Quotes", count: counts.totalQuotes, color: "#34D399" },
    { label: "Messages", count: counts.totalMessages, color: "#FBBF24" },
  ];
  const maxBar = Math.max(1, ...chartBars.map((b) => b.count));

  const storageModeLabel =
    storageStatus?.mode === "d1+r2"
      ? "D1 + R2 Bound"
      : storageStatus?.mode === "d1+d1blob"
      ? "D1 + Blob Adapter"
      : storageStatus?.mode === "memory-fallback"
      ? "Temporary Fallback Mode"
      : "Live Storage";

  return (
    <div className="space-y-6">
      {/* Quick Actions */}
      <div className="bg-[#111827]/85 border border-[#00E5FF]/20 rounded-2xl p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
          <h2 className="text-sm font-bold text-[#F5F7FA]">Quick Studio Actions</h2>
          <span className="text-[11px] font-mono-nums text-[#94A3B8]">
            {storageModeLabel}
          </span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-2.5">
          <button
            type="button"
            onClick={() => onNavigate("media")}
            className="flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl bg-gradient-to-r from-[#00E5FF] to-[#8B5CF6] text-[#080B12] text-xs font-bold cursor-pointer hover:brightness-110 transition-all"
          >
            <Upload className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">Upload Image</span>
          </button>
          <button
            type="button"
            onClick={() => onNavigate("media")}
            className="flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl bg-[#161D2B] border border-[#00E5FF]/25 hover:border-[#00E5FF] text-[#F5F7FA] text-xs font-semibold cursor-pointer"
          >
            <FileText className="w-3.5 h-3.5 text-[#8B5CF6] shrink-0" />
            <span className="truncate">Upload PDF</span>
          </button>
          <button
            type="button"
            onClick={() => onNavigate("outfits")}
            className="flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl bg-[#161D2B] border border-[#00E5FF]/25 hover:border-[#00E5FF] text-[#F5F7FA] text-xs font-semibold cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5 text-[#00E5FF] shrink-0" />
            <span className="truncate">Add Outfit</span>
          </button>
          <button
            type="button"
            onClick={() => onNavigate("backgrounds")}
            className="flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl bg-[#161D2B] border border-[#00E5FF]/25 hover:border-[#00E5FF] text-[#F5F7FA] text-xs font-semibold cursor-pointer"
          >
            <Palette className="w-3.5 h-3.5 text-[#00E5FF] shrink-0" />
            <span className="truncate">Add Background</span>
          </button>
          <button
            type="button"
            onClick={() => onNavigate("cms")}
            className="flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl bg-[#161D2B] border border-[#00E5FF]/25 hover:border-[#00E5FF] text-[#F5F7FA] text-xs font-semibold cursor-pointer"
          >
            <LayoutGrid className="w-3.5 h-3.5 text-[#8B5CF6] shrink-0" />
            <span className="truncate">Manage Content</span>
          </button>
          <button
            type="button"
            onClick={() => onNavigate("messages")}
            className="flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl bg-[#161D2B] border border-[#00E5FF]/25 hover:border-[#00E5FF] text-[#F5F7FA] text-xs font-semibold cursor-pointer"
          >
            <Mail className="w-3.5 h-3.5 text-amber-300 shrink-0" />
            <span className="truncate">View Messages</span>
          </button>
        </div>
      </div>

      {/* Cloudflare Bindings & Storage Diagnostics */}
      {storageStatus && (
        <div
          className={`rounded-2xl p-4 sm:p-5 border ${
            storageStatus.d1Bound && storageStatus.r2Bound
              ? "bg-[#111827]/85 border-emerald-500/25"
              : "bg-[#111827]/90 border-amber-400/35"
          }`}
        >
          <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
            <div className="flex items-center gap-2">
              {storageStatus.d1Bound && storageStatus.r2Bound ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              ) : (
                <AlertTriangle className="w-4 h-4 text-amber-300 shrink-0" />
              )}
              <h2 className="text-sm font-bold text-[#F5F7FA]">
                Cloudflare Bindings &amp; Worker Runtime Readiness
              </h2>
            </div>
            <span className="text-[11px] font-mono-nums text-[#94A3B8]">
              Mode: {storageStatus.mode}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="flex items-center justify-between gap-3 px-3.5 py-2.5 rounded-xl bg-[#080B12]/75 border border-white/10">
              <div className="flex items-center gap-2.5 min-w-0">
                <Database
                  className={`w-4 h-4 shrink-0 ${
                    storageStatus.d1Bound ? "text-emerald-400" : "text-amber-300"
                  }`}
                />
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-[#F5F7FA] truncate">
                    D1 Database (<span className="font-mono-nums">DB</span>)
                  </p>
                  <p className="text-[11px] text-[#94A3B8] truncate">
                    {storageStatus.d1Bound ? "Persistent SQLite bound" : "Isolate fallback active"}
                  </p>
                </div>
              </div>
              <span
                className={`text-[11px] font-mono-nums font-semibold shrink-0 ${
                  storageStatus.d1Bound ? "text-emerald-400" : "text-amber-300"
                }`}
              >
                {storageStatus.d1Bound ? "Bound" : "Fallback"}
              </span>
            </div>

            <div className="flex items-center justify-between gap-3 px-3.5 py-2.5 rounded-xl bg-[#080B12]/75 border border-white/10">
              <div className="flex items-center gap-2.5 min-w-0">
                <HardDrive
                  className={`w-4 h-4 shrink-0 ${
                    storageStatus.r2Bound ? "text-emerald-400" : "text-amber-300"
                  }`}
                />
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-[#F5F7FA] truncate">
                    R2 Bucket (<span className="font-mono-nums">MEDIA_BUCKET</span>)
                  </p>
                  <p className="text-[11px] text-[#94A3B8] truncate">
                    {storageStatus.r2Bound
                      ? "Object storage bound"
                      : storageStatus.d1Bound
                      ? "D1 blob adapter (1.5 MB)"
                      : "Memory adapter active"}
                  </p>
                </div>
              </div>
              <span
                className={`text-[11px] font-mono-nums font-semibold shrink-0 ${
                  storageStatus.r2Bound ? "text-emerald-400" : "text-amber-300"
                }`}
              >
                {storageStatus.r2Bound ? "Bound" : "Fallback"}
              </span>
            </div>

            <div className="flex items-center justify-between gap-3 px-3.5 py-2.5 rounded-xl bg-[#080B12]/75 border border-white/10">
              <div className="flex items-center gap-2.5 min-w-0">
                <Sparkles
                  className={`w-4 h-4 shrink-0 ${
                    storageStatus.geminiConfigured ? "text-emerald-400" : "text-[#94A3B8]"
                  }`}
                />
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-[#F5F7FA] truncate">
                    Gemini AI (<span className="font-mono-nums">GEMINI_API_KEY</span>)
                  </p>
                  <p className="text-[11px] text-[#94A3B8] truncate">
                    {storageStatus.geminiConfigured
                      ? "Chat, OCR & Resume AI active"
                      : "Optional runtime secret"}
                  </p>
                </div>
              </div>
              <span
                className={`text-[11px] font-mono-nums font-semibold shrink-0 ${
                  storageStatus.geminiConfigured ? "text-emerald-400" : "text-[#94A3B8]"
                }`}
              >
                {storageStatus.geminiConfigured ? "Configured" : "Not Set"}
              </span>
            </div>
          </div>

          <div className="mt-3 pt-3 border-t border-white/10 flex flex-wrap items-center justify-between gap-3 text-[11px]">
            <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 text-[#CBD5E1]">
              <span>
                <span className="text-[#94A3B8]">Setup Guard (</span>
                <span className="font-mono-nums">ADMIN_SETUP_TOKEN</span>
                <span className="text-[#94A3B8]">): </span>
                <span
                  className={`font-mono-nums font-semibold ${
                    storageStatus.setupTokenConfigured ? "text-emerald-400" : "text-[#94A3B8]"
                  }`}
                >
                  {storageStatus.setupTokenConfigured ? "Configured" : "Not Set"}
                </span>
              </span>
              <span aria-hidden="true" className="text-white/20">
                ·
              </span>
              <span>
                <span className="text-[#94A3B8]">Mail Delivery (</span>
                <span className="font-mono-nums">RESEND_API_KEY</span>
                <span className="text-[#94A3B8]">): </span>
                <span
                  className={`font-mono-nums font-semibold ${
                    storageStatus.emailProviderConfigured ? "text-emerald-400" : "text-[#94A3B8]"
                  }`}
                >
                  {storageStatus.emailProviderConfigured ? "Configured" : "Not Set"}
                </span>
              </span>
            </div>

            {(!storageStatus.setupTokenConfigured ||
              !storageStatus.emailProviderConfigured ||
              !storageStatus.geminiConfigured) && (
              <button
                type="button"
                onClick={() => copyValue("sync-secrets", "npm run cf:sync-secrets")}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#080B12] border border-white/15 text-[11px] font-mono-nums text-[#E2E8F0] hover:border-[#00E5FF]/50 cursor-pointer"
              >
                {copiedId === "sync-secrets" ? (
                  <Check className="w-3 h-3 text-emerald-400" />
                ) : (
                  <Copy className="w-3 h-3 text-[#00E5FF]" />
                )}
                <span>
                  {copiedId === "sync-secrets" ? "Copied" : "Copy: npm run cf:sync-secrets"}
                </span>
              </button>
            )}
          </div>

          {(!storageStatus.d1Bound || !storageStatus.r2Bound) && (
            <div className="mt-3 pt-3 border-t border-white/10 text-xs text-[#CBD5E1] space-y-2">
              <p className="font-semibold text-amber-200">
                {storageStatus.summary}
              </p>
              <ul className="list-disc pl-4 space-y-1.5 text-[11px] text-[#94A3B8]">
                <li>
                  <span className="text-[#E2E8F0] font-semibold">
                    Fix Cloudflare Dashboard Deploy Command (Step-by-Step):
                  </span>{" "}
                  Open <span className="text-[#E2E8F0]">Workers &amp; Pages → sun-nova-print-service → Settings → Build → Edit</span>, keep{" "}
                  <code className="text-[#00E5FF]">npm run build</code> as Build command, change{" "}
                  <span className="text-[#E2E8F0]">Deploy command</span> from <code className="text-amber-300">dist</code> to{" "}
                  <code className="text-[#00E5FF]">npx wrangler deploy</code>, click <span className="text-[#E2E8F0]">Save</span>, and trigger <span className="text-[#E2E8F0]">Retry deployment</span>.
                </li>
                <li>
                  <span className="text-[#E2E8F0] font-semibold">
                    Auto-Bind D1 &amp; R2 (GitHub Actions or Build Variables):
                  </span>{" "}
                  Add <code className="text-[#00E5FF]">CLOUDFLARE_API_TOKEN</code> + <code className="text-[#00E5FF]">CLOUDFLARE_ACCOUNT_ID</code> to GitHub Repository Secrets for automated D1/R2 creation &amp; migrations, OR set{" "}
                  <code className="text-[#00E5FF]">D1_DATABASE_ID</code> in Cloudflare Build Variables (or run <code className="text-[#00E5FF]">npm run cf:setup</code>). Move <code className="text-[#E2E8F0]">RESEND_API_KEY</code> &amp; <code className="text-[#E2E8F0]">ADMIN_SETUP_TOKEN</code> to{" "}
                  <span className="text-[#E2E8F0]">Workers → Settings → Variables and Secrets</span>.
                </li>
              </ul>
              <div className="flex flex-wrap gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => copyValue("cf-setup", "npm run cf:setup")}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[#080B12] border border-white/15 text-[11px] font-mono-nums text-[#E2E8F0] hover:border-[#00E5FF]/50 cursor-pointer"
                >
                  {copiedId === "cf-setup" ? (
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                  ) : (
                    <Copy className="w-3.5 h-3.5 text-[#00E5FF]" />
                  )}
                  <span>{copiedId === "cf-setup" ? "Copied" : "Copy: npm run cf:setup"}</span>
                </button>
                <button
                  type="button"
                  onClick={() => copyValue("d1-var", "D1_DATABASE_ID")}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[#080B12] border border-white/15 text-[11px] font-mono-nums text-[#E2E8F0] hover:border-[#00E5FF]/50 cursor-pointer"
                >
                  {copiedId === "d1-var" ? (
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                  ) : (
                    <Copy className="w-3.5 h-3.5 text-[#00E5FF]" />
                  )}
                  <span>{copiedId === "d1-var" ? "Copied" : "Copy: D1_DATABASE_ID"}</span>
                </button>
                <button
                  type="button"
                  onClick={() => copyValue("cf-deploy", "npx wrangler deploy")}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[#080B12] border border-white/15 text-[11px] font-mono-nums text-[#E2E8F0] hover:border-[#00E5FF]/50 cursor-pointer"
                >
                  {copiedId === "cf-deploy" ? (
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                  ) : (
                    <Copy className="w-3.5 h-3.5 text-[#00E5FF]" />
                  )}
                  <span>{copiedId === "cf-deploy" ? "Copied" : "Copy: npx wrangler deploy"}</span>
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {statCards.map((card) => {
          const Icon = card.icon;
          return (
            <button
              key={card.label}
              type="button"
              onClick={() => onNavigate(card.tab)}
              className="text-left bg-[#111827]/85 hover:bg-[#161D2B] border border-[#00E5FF]/15 hover:border-[#00E5FF]/45 rounded-2xl p-4 sm:p-5 transition-all cursor-pointer group"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-medium text-[#94A3B8]">
                  {card.label}
                </span>
                <Icon className={`w-4 h-4 ${card.accent}`} />
              </div>
              <div className="mt-2 flex items-baseline justify-between gap-2">
                <span className="text-2xl sm:text-3xl font-extrabold font-mono-nums text-[#F5F7FA]">
                  {loading && !overview ? "…" : card.value}
                </span>
                {card.sub && (
                  <span className="text-[11px] font-mono-nums text-[#00E5FF]">
                    {card.sub}
                  </span>
                )}
              </div>
            </button>
          );
        })}
      </div>

      {/* Analytics Bar Visualization & Quotes Status Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        <div className="lg:col-span-7 bg-[#111827]/85 border border-[#00E5FF]/20 rounded-2xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-[#F5F7FA]">
              Database Asset Distribution
            </h3>
            <span className="text-[11px] font-mono-nums text-[#94A3B8]">
              Real D1 Record Counts
            </span>
          </div>
          <div className="space-y-3">
            {chartBars.map((bar) => (
              <div key={bar.label} className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-[#E2E8F0] font-medium">{bar.label}</span>
                  <span className="font-mono-nums text-[#00E5FF] font-semibold">
                    {bar.count}
                  </span>
                </div>
                <div className="h-2 rounded-full bg-[#080B12] overflow-hidden border border-white/5">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${Math.max(4, (bar.count / maxBar) * 100)}%`,
                      backgroundColor: bar.color,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="lg:col-span-5 bg-[#111827]/85 border border-[#00E5FF]/20 rounded-2xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-[#F5F7FA]">Quote Pipeline</h3>
            <button
              type="button"
              onClick={() => onNavigate("quotes")}
              className="text-xs text-[#00E5FF] hover:underline cursor-pointer"
            >
              Open Quotes
            </button>
          </div>
          {overview && overview.quotesByStatus.length > 0 ? (
            <div className="space-y-2.5">
              {overview.quotesByStatus.map((row) => (
                <div
                  key={row.status}
                  className="flex items-center justify-between px-3 py-2 rounded-xl bg-[#080B12]/70 border border-white/5 text-xs"
                >
                  <span className="font-semibold text-[#F5F7FA]">{row.status}</span>
                  <span className="font-mono-nums text-[#00E5FF] font-bold">
                    {row.count}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-[#94A3B8]">
              No customer quotation submissions recorded yet.
            </p>
          )}
        </div>
      </div>

      {/* Recent Uploads & Recent Audit Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        <div className="lg:col-span-6 bg-[#111827]/85 border border-[#00E5FF]/20 rounded-2xl p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-[#F5F7FA]">Recent Uploads</h3>
            <button
              type="button"
              onClick={() => onNavigate("media")}
              className="text-xs text-[#00E5FF] hover:underline cursor-pointer"
            >
              Media Library
            </button>
          </div>
          {!overview || overview.recentUploads.length === 0 ? (
            <p className="text-xs text-[#94A3B8]">
              No media files uploaded yet. Drag &amp; drop images or PDFs in Media Manager.
            </p>
          ) : (
            <div className="space-y-2">
              {overview.recentUploads.map((file) => (
                <div
                  key={file.id}
                  className="flex items-center justify-between gap-3 p-2.5 rounded-xl bg-[#080B12]/75 border border-white/5"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    {file.mime_type.startsWith("image/") && file.public_url ? (
                      <img
                        src={file.public_url}
                        alt={file.filename}
                        className="w-9 h-9 rounded-lg object-cover border border-white/15 shrink-0"
                      />
                    ) : (
                      <div className="w-9 h-9 rounded-lg bg-[#161D2B] border border-[#00E5FF]/20 flex items-center justify-center text-[#00E5FF] shrink-0">
                        <FileText className="w-4 h-4" />
                      </div>
                    )}
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-[#F5F7FA] truncate">
                        {file.filename}
                      </p>
                      <p className="text-[11px] text-[#94A3B8] font-mono-nums">
                        {file.category} · {(file.file_size / 1024).toFixed(1)} KB
                      </p>
                    </div>
                  </div>
                  <span className="text-[10px] font-mono-nums text-[#00E5FF] shrink-0">
                    {file.visibility}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="lg:col-span-6 bg-[#111827]/85 border border-[#00E5FF]/20 rounded-2xl p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-[#F5F7FA] inline-flex items-center gap-2">
              <Activity className="w-4 h-4 text-[#00E5FF]" />
              <span>Recent Admin Activity</span>
            </h3>
            <button
              type="button"
              onClick={() => onNavigate("users")}
              className="text-xs text-[#00E5FF] hover:underline cursor-pointer"
            >
              Audit Logs
            </button>
          </div>
          {!overview || overview.recentActivity.length === 0 ? (
            <p className="text-xs text-[#94A3B8]">No administrative events recorded yet.</p>
          ) : (
            <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
              {overview.recentActivity.map((log) => (
                <div
                  key={log.id}
                  className="p-2.5 rounded-xl bg-[#080B12]/75 border border-white/5 text-xs space-y-0.5"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold text-[#F5F7FA]">{log.action}</span>
                    <span className="text-[10px] font-mono-nums text-[#94A3B8] shrink-0">
                      {new Date(log.created_at).toLocaleString()}
                    </span>
                  </div>
                  <p className="text-[11px] text-[#94A3B8] truncate">
                    {log.admin_email || "System"}
                    {log.details ? ` · ${log.details}` : ""}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
