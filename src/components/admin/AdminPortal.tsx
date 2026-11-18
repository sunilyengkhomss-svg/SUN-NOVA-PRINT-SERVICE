import { useCallback, useEffect, useState } from "react";
import {
  ArrowLeft,
  FileImage,
  FolderKanban,
  LayoutDashboard,
  LayoutTemplate,
  LogOut,
  Mail,
  Menu,
  Palette,
  RefreshCw,
  ShieldCheck,
  Shirt,
  Users,
  UserCheck,
  X,
} from "lucide-react";
import {
  ActivityLogRecord,
  AdminOverviewPayload,
  AdminUser,
  BackgroundPresetRecord,
  ContactMessageRecord,
  MediaFileRecord,
  OutfitTemplateRecord,
  PortfolioItemRecord,
  QuoteRequestRecord,
  SamplePortraitRecord,
  ServiceRecord,
  StorageStatusInfo,
  WebsiteSettings,
} from "../../types/cms";
import { BRAND_NAME } from "../../types/photo";
import {
  fetchAdminActivity,
  fetchAdminBackgrounds,
  fetchAdminMedia,
  fetchAdminMessages,
  fetchAdminOutfits,
  fetchAdminOverview,
  fetchAdminPortfolio,
  fetchAdminPortraits,
  fetchAdminQuotes,
  fetchAdminServices,
  fetchAdminSettings,
  fetchAdminUsers,
  fetchBootstrapStatus,
  logoutAdmin,
} from "../../utils/adminApi";
import { DEFAULT_WEBSITE_SETTINGS } from "../../backend/seed";
import { AdminAuthGate } from "./AdminAuthGate";
import { AdminCmsTab } from "./AdminCmsTab";
import { AdminInboxTab } from "./AdminInboxTab";
import { AdminMediaTab } from "./AdminMediaTab";
import { AdminOverviewTab, AdminSectionKey } from "./AdminOverviewTab";
import { AdminStudioAssetsTab } from "./AdminStudioAssetsTab";
import { AdminUsersTab } from "./AdminUsersTab";

interface AdminPortalProps {
  onExitAdmin: () => void;
  onPublicDataChanged: () => Promise<void>;
}

const NAV_ITEMS: {
  id: AdminSectionKey;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}[] = [
  { id: "overview", label: "Dashboard Overview", icon: LayoutDashboard },
  { id: "media", label: "Media & File Manager", icon: FileImage },
  { id: "outfits", label: "Student & Officer Outfits", icon: Shirt },
  { id: "backgrounds", label: "Background Presets", icon: Palette },
  { id: "portraits", label: "Sample Portraits", icon: UserCheck },
  { id: "cms", label: "Website CMS & Services", icon: LayoutTemplate },
  { id: "quotes", label: "Quote Requests", icon: FolderKanban },
  { id: "messages", label: "Contact Mail Desk", icon: Mail },
  { id: "users", label: "Admins & Audit Logs", icon: Users },
];

export function AdminPortal({
  onExitAdmin,
  onPublicDataChanged,
}: AdminPortalProps) {
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [needsSetup, setNeedsSetup] = useState(false);
  const [setupTokenRequired, setSetupTokenRequired] = useState(false);
  const [storageStatus, setStorageStatus] = useState<StorageStatusInfo | undefined>(undefined);
  const [admin, setAdmin] = useState<AdminUser | null>(null);

  const [activeTab, setActiveTab] = useState<AdminSectionKey>("overview");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [loadingData, setLoadingData] = useState(false);

  const [overview, setOverview] = useState<AdminOverviewPayload | null>(null);
  const [mediaFiles, setMediaFiles] = useState<MediaFileRecord[]>([]);
  const [outfits, setOutfits] = useState<OutfitTemplateRecord[]>([]);
  const [backgrounds, setBackgrounds] = useState<BackgroundPresetRecord[]>([]);
  const [portraits, setPortraits] = useState<SamplePortraitRecord[]>([]);
  const [settings, setSettings] = useState<WebsiteSettings>(DEFAULT_WEBSITE_SETTINGS);
  const [services, setServices] = useState<ServiceRecord[]>([]);
  const [portfolio, setPortfolio] = useState<PortfolioItemRecord[]>([]);
  const [quotes, setQuotes] = useState<QuoteRequestRecord[]>([]);
  const [messages, setMessages] = useState<ContactMessageRecord[]>([]);
  const [emailProviderConfigured, setEmailProviderConfigured] = useState(false);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [logs, setLogs] = useState<ActivityLogRecord[]>([]);

  const checkAuth = useCallback(async () => {
    setCheckingAuth(true);
    try {
      const boot = await fetchBootstrapStatus();
      setNeedsSetup(boot.needsSetup);
      setSetupTokenRequired(boot.setupTokenRequired);
      setStorageStatus(boot.storageStatus);
      setAdmin(boot.admin ?? null);
    } catch {
      setAdmin(null);
    } finally {
      setCheckingAuth(false);
    }
  }, []);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  const loadAllAdminData = useCallback(async () => {
    setLoadingData(true);
    try {
      const [
        ovRes,
        mediaRes,
        outfitRes,
        bgRes,
        portraitRes,
        settingRes,
        srvRes,
        pfRes,
        quoteRes,
        msgRes,
        userRes,
        actRes,
      ] = await Promise.all([
        fetchAdminOverview(),
        fetchAdminMedia(),
        fetchAdminOutfits(),
        fetchAdminBackgrounds(),
        fetchAdminPortraits(),
        fetchAdminSettings(),
        fetchAdminServices(),
        fetchAdminPortfolio(),
        fetchAdminQuotes(),
        fetchAdminMessages(),
        fetchAdminUsers(),
        fetchAdminActivity(),
      ]);
      setOverview(ovRes);
      setMediaFiles(mediaRes.files);
      setOutfits(outfitRes.outfits);
      setBackgrounds(bgRes.backgrounds);
      setPortraits(portraitRes.portraits);
      setSettings(settingRes.settings);
      setServices(srvRes.services);
      setPortfolio(pfRes.portfolio);
      setQuotes(quoteRes.quotes);
      setMessages(msgRes.messages);
      setEmailProviderConfigured(msgRes.emailProviderConfigured);
      setUsers(userRes.users);
      setLogs(actRes.logs);
    } finally {
      setLoadingData(false);
    }
  }, []);

  useEffect(() => {
    if (admin) {
      loadAllAdminData();
    }
  }, [admin, loadAllAdminData]);

  const handleRefreshAndSyncPublic = async () => {
    await loadAllAdminData();
    await onPublicDataChanged();
  };

  const handleLogout = async () => {
    await logoutAdmin().catch(() => undefined);
    setAdmin(null);
  };

  if (checkingAuth) {
    return (
      <div className="min-h-screen bg-[#080B12] text-[#F5F7FA] flex items-center justify-center p-6">
        <div className="text-xs font-mono-nums text-[#00E5FF]">
          Verifying SUN-NOVA Admin Session...
        </div>
      </div>
    );
  }

  if (!admin) {
    return (
      <AdminAuthGate
        needsSetup={needsSetup}
        setupTokenRequired={setupTokenRequired}
        storageStatus={storageStatus}
        onRefreshStatus={checkAuth}
        onAuthenticated={(loggedIn) => {
          setNeedsSetup(false);
          setAdmin(loggedIn);
        }}
        onExitAdmin={onExitAdmin}
      />
    );
  }

  return (
    <div className="min-h-screen bg-[#080B12] text-[#F5F7FA] flex">
      {/* Desktop / Tablet Sidebar */}
      <aside className="hidden lg:flex lg:w-64 xl:w-72 flex-col bg-[#0B0F19] border-r border-[#00E5FF]/20 shrink-0 sticky top-0 h-screen">
        <div className="p-5 border-b border-[#00E5FF]/15 space-y-1">
          <div className="inline-flex items-center gap-2 text-xs font-mono-nums text-[#00E5FF] uppercase tracking-wider">
            <ShieldCheck className="w-4 h-4" />
            <span>Admin Studio</span>
          </div>
          <div className="text-sm font-extrabold text-[#F5F7FA] truncate">
            {BRAND_NAME}
          </div>
        </div>

        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const active = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveTab(item.id)}
                className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer text-left ${
                  active
                    ? "bg-gradient-to-r from-[#00E5FF] to-[#8B5CF6] text-[#080B12] shadow-sm"
                    : "text-[#94A3B8] hover:text-[#F5F7FA] hover:bg-white/5"
                }`}
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span className="truncate">{item.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="p-3 border-t border-[#00E5FF]/15 space-y-2">
          <div className="px-3 py-2 rounded-xl bg-[#111827] border border-white/10">
            <p className="text-xs font-bold text-[#F5F7FA] truncate">{admin.name}</p>
            <p className="text-[10px] font-mono-nums text-[#00E5FF] uppercase">
              {admin.role.replace("_", " ")}
            </p>
          </div>
          <button
            type="button"
            onClick={onExitAdmin}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-xl bg-[#161D2B] text-xs font-semibold text-[#F5F7FA] hover:border-[#00E5FF]/40 border border-transparent cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5 text-[#00E5FF]" />
            <span>Back to Public Site</span>
          </button>
          <button
            type="button"
            onClick={handleLogout}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-xl bg-rose-950/60 hover:bg-rose-900/70 text-xs font-semibold text-rose-200 cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Secure Logout</span>
          </button>
        </div>
      </aside>

      {/* Mobile / Tablet Drawer */}
      {sidebarOpen && (
        <div className="lg:hidden fixed inset-0 z-50 bg-[#080B12]/80 backdrop-blur-md flex">
          <aside className="w-72 max-w-[85vw] bg-[#0B0F19] border-r border-[#00E5FF]/25 flex flex-col h-full">
            <div className="p-4 border-b border-white/10 flex items-center justify-between">
              <span className="text-xs font-extrabold text-[#00E5FF]">
                {BRAND_NAME} ADMIN
              </span>
              <button
                type="button"
                onClick={() => setSidebarOpen(false)}
                aria-label="Close admin menu"
                className="p-1.5 rounded-lg bg-[#161D2B] text-[#F5F7FA]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
              {NAV_ITEMS.map((item) => {
                const Icon = item.icon;
                const active = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      setActiveTab(item.id);
                      setSidebarOpen(false);
                    }}
                    className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-semibold text-left ${
                      active
                        ? "bg-gradient-to-r from-[#00E5FF] to-[#8B5CF6] text-[#080B12]"
                        : "text-[#94A3B8] hover:text-[#F5F7FA]"
                    }`}
                  >
                    <Icon className="w-4 h-4 shrink-0" />
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </nav>
            <div className="p-3 border-t border-white/10 space-y-2">
              <button
                type="button"
                onClick={onExitAdmin}
                className="w-full flex items-center gap-2 px-3 py-2 rounded-xl bg-[#161D2B] text-xs font-semibold text-[#F5F7FA]"
              >
                <ArrowLeft className="w-3.5 h-3.5 text-[#00E5FF]" />
                <span>Back to Public Site</span>
              </button>
              <button
                type="button"
                onClick={handleLogout}
                className="w-full flex items-center gap-2 px-3 py-2 rounded-xl bg-rose-950/60 text-xs font-semibold text-rose-200"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Secure Logout</span>
              </button>
            </div>
          </aside>
          <div className="flex-1" onClick={() => setSidebarOpen(false)} />
        </div>
      )}

      {/* Main Content */}
      <div className="flex-1 min-w-0 flex flex-col">
        <header className="sticky top-0 z-30 bg-[#080B12]/90 backdrop-blur-xl border-b border-[#00E5FF]/20 px-4 sm:px-6 h-14 sm:h-16 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setSidebarOpen(true)}
              aria-label="Open admin navigation"
              className="lg:hidden p-2 rounded-lg bg-[#161D2B] border border-[#00E5FF]/25 text-[#F5F7FA] cursor-pointer"
            >
              <Menu className="w-4 h-4" />
            </button>
            <h1 className="text-sm sm:text-base font-extrabold text-[#F5F7FA] truncate">
              {NAV_ITEMS.find((n) => n.id === activeTab)?.label}
            </h1>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handleRefreshAndSyncPublic}
              disabled={loadingData}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#161D2B] border border-[#00E5FF]/25 text-xs font-semibold text-[#00E5FF] cursor-pointer"
            >
              <RefreshCw
                className={`w-3.5 h-3.5 ${loadingData ? "animate-spin" : ""}`}
              />
              <span className="hidden sm:inline">Refresh Data</span>
            </button>

            <button
              type="button"
              onClick={onExitAdmin}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#161D2B] border border-white/15 text-xs font-semibold text-[#F5F7FA] cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">View Site</span>
            </button>
          </div>
        </header>

        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto">
          {activeTab === "overview" && (
            <AdminOverviewTab
              overview={overview}
              loading={loadingData}
              onNavigate={setActiveTab}
            />
          )}
          {activeTab === "media" && (
            <AdminMediaTab
              files={mediaFiles}
              settings={settings}
              onRefresh={handleRefreshAndSyncPublic}
            />
          )}
          {(activeTab === "outfits" ||
            activeTab === "backgrounds" ||
            activeTab === "portraits") && (
            <AdminStudioAssetsTab
              mode={activeTab}
              outfits={outfits}
              backgrounds={backgrounds}
              portraits={portraits}
              mediaFiles={mediaFiles}
              onRefresh={handleRefreshAndSyncPublic}
            />
          )}
          {activeTab === "cms" && (
            <AdminCmsTab
              settings={settings}
              services={services}
              portfolio={portfolio}
              onRefresh={handleRefreshAndSyncPublic}
            />
          )}
          {(activeTab === "quotes" || activeTab === "messages") && (
            <AdminInboxTab
              mode={activeTab}
              quotes={quotes}
              messages={messages}
              emailProviderConfigured={emailProviderConfigured}
              onRefresh={handleRefreshAndSyncPublic}
            />
          )}
          {activeTab === "users" && (
            <AdminUsersTab
              currentAdmin={admin}
              users={users}
              logs={logs}
              onRefresh={loadAllAdminData}
            />
          )}
        </main>
      </div>
    </div>
  );
}
