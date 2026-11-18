import React, { useState } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  Check,
  Copy,
  Database,
  Eye,
  EyeOff,
  HardDrive,
  KeyRound,
  Lock,
  RefreshCw,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { AdminUser, StorageStatusInfo } from "../../types/cms";
import { BRAND_NAME, OFFICIAL_SUPPORT_EMAIL } from "../../types/photo";
import {
  loginAdmin,
  requestPasswordReset,
  resetAdminPassword,
  setupInitialSuperAdmin,
} from "../../utils/adminApi";

interface AdminAuthGateProps {
  needsSetup: boolean;
  setupTokenRequired: boolean;
  storageStatus?: StorageStatusInfo;
  onRefreshStatus?: () => void;
  onAuthenticated: (admin: AdminUser) => void;
  onExitAdmin: () => void;
}

type AuthScreenMode = "login" | "forgot" | "reset";

export function AdminAuthGate({
  needsSetup,
  setupTokenRequired,
  storageStatus,
  onRefreshStatus,
  onAuthenticated,
  onExitAdmin,
}: AdminAuthGateProps) {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const copyText = (key: string, text: string) => {
    navigator.clipboard?.writeText(text).catch(() => undefined);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 1600);
  };
  const [mode, setMode] = useState<AuthScreenMode>("login");
  const [name, setName] = useState("SUN-NOVA Administrator");
  const [email, setEmail] = useState(OFFICIAL_SUPPORT_EMAIL);
  const [password, setPassword] = useState("");
  const [setupToken, setSetupToken] = useState("");
  const [remember, setRemember] = useState(true);
  const [showPassword, setShowPassword] = useState(false);

  const [resetEmail, setResetEmail] = useState(OFFICIAL_SUPPORT_EMAIL);
  const [resetToken, setResetToken] = useState("");
  const [newPassword, setNewPassword] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const handleInitialSetup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await setupInitialSuperAdmin({
        name,
        email,
        password,
        setupToken: setupToken || undefined,
      });
      onAuthenticated(res.admin);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to initialize admin.");
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await loginAdmin({ email, password, remember });
      onAuthenticated(res.admin);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed.");
    } finally {
      setLoading(false);
    }
  };

  const handleForgot = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setNotice(null);
    setLoading(true);
    try {
      const res = await requestPasswordReset(resetEmail);
      setNotice(res.message);
      setMode("reset");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to request reset.");
    } finally {
      setLoading(false);
    }
  };

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setNotice(null);
    setLoading(true);
    try {
      const res = await resetAdminPassword({
        email: resetEmail,
        token: resetToken,
        newPassword,
      });
      setNotice(res.message);
      setEmail(resetEmail);
      setPassword("");
      setMode("login");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to reset password.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#080B12] text-[#F5F7FA] relative overflow-hidden flex items-center justify-center p-4 sm:p-6">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-32 -left-32 w-96 h-96 rounded-full bg-[#00E5FF]/12 blur-[140px]"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-32 -right-32 w-96 h-96 rounded-full bg-[#8B5CF6]/15 blur-[140px]"
      />

      <div className="relative z-10 w-full max-w-md space-y-4">
        <button
          type="button"
          onClick={onExitAdmin}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#94A3B8] hover:text-[#00E5FF] transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Return to Public Studio</span>
        </button>

        <div className="bg-[#111827]/90 backdrop-blur-xl border border-[#00E5FF]/25 rounded-2xl p-6 sm:p-8 shadow-[0_24px_64px_rgba(0,0,0,0.65)] space-y-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 text-[11px] font-mono-nums uppercase tracking-[0.18em] text-[#00E5FF]">
              <ShieldCheck className="w-4 h-4" />
              <span>{BRAND_NAME} · Admin Portal</span>
            </div>
            <h1 className="text-2xl font-extrabold tracking-tight text-[#F5F7FA]">
              {needsSetup
                ? "Initialize Super Admin"
                : mode === "login"
                ? "Administrator Sign In"
                : mode === "forgot"
                ? "Recover Admin Password"
                : "Set New Admin Password"}
            </h1>
            <p className="text-xs text-[#94A3B8] leading-relaxed">
              {needsSetup
                ? "No administrator exists yet. Create your initial Super Admin account to manage outfits, backgrounds, media, CMS content, quotes, and mail."
                : mode === "login"
                ? "Sign in with your encrypted administrator credentials to manage website media and studio assets."
                : mode === "forgot"
                ? "Request a password reset code or enter your server recovery token."
                : "Enter your recovery code (or server ADMIN_SETUP_TOKEN) and choose a new password."}
            </p>
          </div>

          {storageStatus && (!storageStatus.d1Bound || !storageStatus.r2Bound) && (
            <div className="rounded-xl bg-[#080B12]/80 border border-amber-400/35 p-3.5 space-y-2.5 text-xs">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-amber-200 font-semibold">
                  <AlertTriangle className="w-4 h-4 text-amber-300 shrink-0" />
                  <span>Cloudflare Bindings Required for Persistence</span>
                </div>
                {onRefreshStatus && (
                  <button
                    type="button"
                    onClick={onRefreshStatus}
                    className="inline-flex items-center gap-1 text-[11px] font-mono-nums text-[#00E5FF] hover:underline cursor-pointer shrink-0"
                  >
                    <RefreshCw className="w-3 h-3" />
                    <span>Recheck</span>
                  </button>
                )}
              </div>

              <div className="grid grid-cols-2 gap-2 text-[11px]">
                <div className="flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-[#111827] border border-white/10">
                  <span className="inline-flex items-center gap-1.5 text-[#CBD5E1]">
                    <Database className="w-3.5 h-3.5 text-[#00E5FF]" />
                    <span className="font-mono-nums">DB</span>
                  </span>
                  <span
                    className={`font-mono-nums font-semibold ${
                      storageStatus.d1Bound ? "text-emerald-400" : "text-amber-300"
                    }`}
                  >
                    {storageStatus.d1Bound ? "Bound" : "Fallback"}
                  </span>
                </div>
                <div className="flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-[#111827] border border-white/10">
                  <span className="inline-flex items-center gap-1.5 text-[#CBD5E1]">
                    <HardDrive className="w-3.5 h-3.5 text-[#8B5CF6]" />
                    <span className="font-mono-nums">MEDIA_BUCKET</span>
                  </span>
                  <span
                    className={`font-mono-nums font-semibold ${
                      storageStatus.r2Bound ? "text-emerald-400" : "text-amber-300"
                    }`}
                  >
                    {storageStatus.r2Bound ? "Bound" : "Fallback"}
                  </span>
                </div>
              </div>

              <p className="text-[11px] text-[#94A3B8] leading-relaxed">
                With <code className="text-[#E2E8F0]">npx wrangler deploy</code>, add{" "}
                <code className="text-[#00E5FF]">D1_DATABASE_ID</code> in Cloudflare Workers Build Variables or run{" "}
                <code className="text-[#E2E8F0]">npm run cf:setup</code> so deployments keep <code className="text-[#E2E8F0]">DB</code> &amp; <code className="text-[#E2E8F0]">MEDIA_BUCKET</code> bound.
              </p>

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => copyText("cmd", "npm run cf:setup")}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#161D2B] border border-white/15 text-[11px] font-mono-nums text-[#E2E8F0] hover:border-[#00E5FF]/50 cursor-pointer"
                >
                  {copiedKey === "cmd" ? (
                    <Check className="w-3 h-3 text-emerald-400" />
                  ) : (
                    <Copy className="w-3 h-3 text-[#00E5FF]" />
                  )}
                  <span>{copiedKey === "cmd" ? "Copied" : "Copy npm run cf:setup"}</span>
                </button>
                <button
                  type="button"
                  onClick={() => copyText("var", "D1_DATABASE_ID")}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#161D2B] border border-white/15 text-[11px] font-mono-nums text-[#E2E8F0] hover:border-[#00E5FF]/50 cursor-pointer"
                >
                  {copiedKey === "var" ? (
                    <Check className="w-3 h-3 text-emerald-400" />
                  ) : (
                    <Copy className="w-3 h-3 text-[#00E5FF]" />
                  )}
                  <span>{copiedKey === "var" ? "Copied" : "Copy D1_DATABASE_ID"}</span>
                </button>
              </div>
            </div>
          )}

          {error && (
            <div
              role="alert"
              className="text-xs text-rose-200 bg-rose-950/60 border border-rose-500/40 rounded-xl px-3.5 py-2.5"
            >
              {error}
            </div>
          )}

          {notice && (
            <div
              role="status"
              className="text-xs text-cyan-100 bg-cyan-950/50 border border-[#00E5FF]/35 rounded-xl px-3.5 py-2.5 leading-relaxed"
            >
              {notice}
            </div>
          )}

          {needsSetup ? (
            <form onSubmit={handleInitialSetup} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-[#E2E8F0] mb-1">
                  Administrator Name
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-[#080B12] border border-[#00E5FF]/25 rounded-xl px-3.5 py-2.5 text-sm text-[#F5F7FA] focus:outline-none focus:ring-2 focus:ring-[#00E5FF]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#E2E8F0] mb-1">
                  Super Admin Email
                </label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-[#080B12] border border-[#00E5FF]/25 rounded-xl px-3.5 py-2.5 text-sm text-[#F5F7FA] focus:outline-none focus:ring-2 focus:ring-[#00E5FF]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#E2E8F0] mb-1">
                  Strong Password (min 8 characters)
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    required
                    minLength={8}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Create a secure password"
                    className="w-full bg-[#080B12] border border-[#00E5FF]/25 rounded-xl pl-3.5 pr-10 py-2.5 text-sm text-[#F5F7FA] focus:outline-none focus:ring-2 focus:ring-[#00E5FF]"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-[#94A3B8] hover:text-[#00E5FF] cursor-pointer"
                  >
                    {showPassword ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>

              {setupTokenRequired && (
                <div>
                  <label className="block text-xs font-semibold text-[#E2E8F0] mb-1">
                    Server ADMIN_SETUP_TOKEN
                  </label>
                  <input
                    type="password"
                    required
                    value={setupToken}
                    onChange={(e) => setSetupToken(e.target.value)}
                    placeholder="Required secret token"
                    className="w-full bg-[#080B12] border border-[#00E5FF]/25 rounded-xl px-3.5 py-2.5 text-sm text-[#F5F7FA] focus:outline-none focus:ring-2 focus:ring-[#00E5FF]"
                  />
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-[#00E5FF] to-[#8B5CF6] text-[#080B12] font-bold text-sm py-3 rounded-xl hover:brightness-110 disabled:opacity-50 transition-all cursor-pointer"
              >
                <Sparkles className="w-4 h-4" />
                <span>
                  {loading ? "Initializing D1 Admin..." : "Create Super Admin & Enter"}
                </span>
              </button>
            </form>
          ) : mode === "login" ? (
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-[#E2E8F0] mb-1">
                  Email Address
                </label>
                <input
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-[#080B12] border border-[#00E5FF]/25 rounded-xl px-3.5 py-2.5 text-sm text-[#F5F7FA] focus:outline-none focus:ring-2 focus:ring-[#00E5FF]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#E2E8F0] mb-1">
                  Password
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    required
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full bg-[#080B12] border border-[#00E5FF]/25 rounded-xl pl-3.5 pr-10 py-2.5 text-sm text-[#F5F7FA] focus:outline-none focus:ring-2 focus:ring-[#00E5FF]"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-[#94A3B8] hover:text-[#00E5FF] cursor-pointer"
                  >
                    {showPassword ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between gap-2 text-xs">
                <label className="inline-flex items-center gap-2 text-[#94A3B8] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={remember}
                    onChange={(e) => setRemember(e.target.checked)}
                    className="rounded border-[#00E5FF]/30 accent-studio"
                  />
                  <span>Remember Session (30 days)</span>
                </label>

                <button
                  type="button"
                  onClick={() => {
                    setError(null);
                    setNotice(null);
                    setResetEmail(email);
                    setMode("forgot");
                  }}
                  className="text-[#00E5FF] hover:underline font-semibold cursor-pointer"
                >
                  Forgot Password?
                </button>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-[#00E5FF] to-[#8B5CF6] text-[#080B12] font-bold text-sm py-3 rounded-xl hover:brightness-110 disabled:opacity-50 transition-all cursor-pointer"
              >
                <Lock className="w-4 h-4" />
                <span>{loading ? "Authenticating..." : "Sign In to Dashboard"}</span>
              </button>
            </form>
          ) : mode === "forgot" ? (
            <form onSubmit={handleForgot} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-[#E2E8F0] mb-1">
                  Administrator Email
                </label>
                <input
                  type="email"
                  required
                  value={resetEmail}
                  onChange={(e) => setResetEmail(e.target.value)}
                  className="w-full bg-[#080B12] border border-[#00E5FF]/25 rounded-xl px-3.5 py-2.5 text-sm text-[#F5F7FA] focus:outline-none focus:ring-2 focus:ring-[#00E5FF]"
                />
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 bg-gradient-to-r from-[#00E5FF] to-[#8B5CF6] text-[#080B12] font-bold text-xs py-2.5 px-4 rounded-xl cursor-pointer"
                >
                  {loading ? "Processing..." : "Request Reset Code"}
                </button>
                <button
                  type="button"
                  onClick={() => setMode("reset")}
                  className="bg-[#161D2B] border border-[#00E5FF]/25 text-[#F5F7FA] text-xs font-semibold py-2.5 px-4 rounded-xl cursor-pointer"
                >
                  Enter Token
                </button>
              </div>
              <button
                type="button"
                onClick={() => setMode("login")}
                className="text-xs text-[#94A3B8] hover:text-[#00E5FF] cursor-pointer"
              >
                Back to Sign In
              </button>
            </form>
          ) : (
            <form onSubmit={handleReset} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-[#E2E8F0] mb-1">
                  Administrator Email
                </label>
                <input
                  type="email"
                  required
                  value={resetEmail}
                  onChange={(e) => setResetEmail(e.target.value)}
                  className="w-full bg-[#080B12] border border-[#00E5FF]/25 rounded-xl px-3.5 py-2.5 text-sm text-[#F5F7FA] focus:outline-none focus:ring-2 focus:ring-[#00E5FF]"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#E2E8F0] mb-1">
                  Recovery Token or ADMIN_SETUP_TOKEN
                </label>
                <input
                  type="text"
                  required
                  value={resetToken}
                  onChange={(e) => setResetToken(e.target.value)}
                  className="w-full bg-[#080B12] border border-[#00E5FF]/25 rounded-xl px-3.5 py-2.5 text-sm text-[#F5F7FA] focus:outline-none focus:ring-2 focus:ring-[#00E5FF]"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#E2E8F0] mb-1">
                  New Password (min 8 chars)
                </label>
                <input
                  type="password"
                  required
                  minLength={8}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full bg-[#080B12] border border-[#00E5FF]/25 rounded-xl px-3.5 py-2.5 text-sm text-[#F5F7FA] focus:outline-none focus:ring-2 focus:ring-[#00E5FF]"
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-[#00E5FF] to-[#8B5CF6] text-[#080B12] font-bold text-sm py-2.5 rounded-xl cursor-pointer"
              >
                <KeyRound className="w-4 h-4" />
                <span>{loading ? "Updating..." : "Reset Password"}</span>
              </button>
              <button
                type="button"
                onClick={() => setMode("login")}
                className="text-xs text-[#94A3B8] hover:text-[#00E5FF] cursor-pointer"
              >
                Back to Sign In
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
