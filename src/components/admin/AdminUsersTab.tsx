import React, { useMemo, useState } from "react";
import { KeyRound, Plus, Search, Shield, Trash2 } from "lucide-react";
import { ActivityLogRecord, AdminRole, AdminUser } from "../../types/cms";
import {
  createAdminUser,
  deleteAdminUser,
  updateAdminUser,
} from "../../utils/adminApi";

interface AdminUsersTabProps {
  currentAdmin: AdminUser;
  users: AdminUser[];
  logs: ActivityLogRecord[];
  onRefresh: () => Promise<void>;
}

export function AdminUsersTab({
  currentAdmin,
  users,
  logs,
  onRefresh,
}: AdminUsersTabProps) {
  const [search, setSearch] = useState("");
  const [newName, setNewName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newRole, setNewRole] = useState<AdminRole>("content_manager");

  const [currPw, setCurrPw] = useState("");
  const [nextPw, setNextPw] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const isSuperAdmin = currentAdmin.role === "super_admin";

  const filteredUsers = useMemo(() => {
    const q = search.trim().toLowerCase();
    return users.filter(
      (u) =>
        !q ||
        u.name.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        u.role.toLowerCase().includes(q)
    );
  }, [users, search]);

  const handleCreateAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setStatus(null);
    setBusy(true);
    try {
      await createAdminUser({
        name: newName,
        email: newEmail,
        password: newPassword,
        role: newRole,
      });
      setNewName("");
      setNewEmail("");
      setNewPassword("");
      setStatus("Administrator account created.");
      await onRefresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create admin.");
    } finally {
      setBusy(false);
    }
  };

  const handleChangeOwnPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setStatus(null);
    setBusy(true);
    try {
      await updateAdminUser(currentAdmin.id, {
        currentPassword: currPw,
        newPassword: nextPw,
      });
      setCurrPw("");
      setNextPw("");
      setStatus("Your password has been updated securely.");
      await onRefresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Password change failed.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
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

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* Change Password */}
        <form
          onSubmit={handleChangeOwnPassword}
          className="lg:col-span-5 bg-[#111827]/85 border border-[#00E5FF]/20 rounded-2xl p-5 space-y-3.5"
        >
          <h2 className="text-sm font-bold text-[#F5F7FA] inline-flex items-center gap-2">
            <KeyRound className="w-4 h-4 text-[#00E5FF]" />
            <span>Change Your Password</span>
          </h2>
          <input
            type="password"
            required
            placeholder="Current Password"
            value={currPw}
            onChange={(e) => setCurrPw(e.target.value)}
            className="w-full bg-[#080B12] border border-[#00E5FF]/25 rounded-xl px-3 py-2 text-xs text-[#F5F7FA]"
          />
          <input
            type="password"
            required
            minLength={8}
            placeholder="New Password (min 8 chars)"
            value={nextPw}
            onChange={(e) => setNextPw(e.target.value)}
            className="w-full bg-[#080B12] border border-[#00E5FF]/25 rounded-xl px-3 py-2 text-xs text-[#F5F7FA]"
          />
          <button
            type="submit"
            disabled={busy}
            className="bg-gradient-to-r from-[#00E5FF] to-[#8B5CF6] text-[#080B12] font-bold text-xs px-5 py-2.5 rounded-xl cursor-pointer"
          >
            Update Password
          </button>
        </form>

        {/* Create Admin (Super Admin Only) */}
        <form
          onSubmit={handleCreateAdmin}
          className="lg:col-span-7 bg-[#111827]/85 border border-[#00E5FF]/20 rounded-2xl p-5 space-y-3.5"
        >
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-sm font-bold text-[#F5F7FA] inline-flex items-center gap-2">
              <Shield className="w-4 h-4 text-[#8B5CF6]" />
              <span>Create Administrator Account</span>
            </h2>
            <span className="text-[10px] font-mono-nums text-[#00E5FF]">
              Super Admin Only
            </span>
          </div>

          {!isSuperAdmin ? (
            <p className="text-xs text-[#94A3B8]">
              Only Super Admin accounts can create or delete other administrators. Your active role is{" "}
              <strong className="text-[#F5F7FA]">{currentAdmin.role}</strong>.
            </p>
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <input
                  type="text"
                  required
                  placeholder="Full Name"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="bg-[#080B12] border border-[#00E5FF]/25 rounded-xl px-3 py-2 text-xs text-[#F5F7FA]"
                />
                <input
                  type="email"
                  required
                  placeholder="Email Address"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  className="bg-[#080B12] border border-[#00E5FF]/25 rounded-xl px-3 py-2 text-xs text-[#F5F7FA]"
                />
                <input
                  type="password"
                  required
                  minLength={8}
                  placeholder="Initial Password (8+ chars)"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="bg-[#080B12] border border-[#00E5FF]/25 rounded-xl px-3 py-2 text-xs text-[#F5F7FA]"
                />
                <select
                  value={newRole}
                  onChange={(e) => setNewRole(e.target.value as AdminRole)}
                  className="bg-[#080B12] border border-[#00E5FF]/25 rounded-xl px-3 py-2 text-xs text-[#F5F7FA]"
                >
                  <option value="super_admin">Super Admin</option>
                  <option value="admin">Admin</option>
                  <option value="content_manager">Content Manager</option>
                </select>
              </div>
              <button
                type="submit"
                disabled={busy}
                className="inline-flex items-center gap-1.5 bg-gradient-to-r from-[#00E5FF] to-[#8B5CF6] text-[#080B12] font-bold text-xs px-5 py-2.5 rounded-xl cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Create Admin</span>
              </button>
            </>
          )}
        </form>
      </div>

      {/* Admin List */}
      <div className="bg-[#111827]/85 border border-[#00E5FF]/20 rounded-2xl p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <h3 className="text-sm font-bold text-[#F5F7FA]">
            Administrators ({filteredUsers.length})
          </h3>
          <div className="relative w-full sm:w-64">
            <Search className="w-3.5 h-3.5 text-[#94A3B8] absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search administrators..."
              className="w-full bg-[#080B12] border border-[#00E5FF]/20 rounded-xl pl-8 pr-3 py-1.5 text-xs text-[#F5F7FA]"
            />
          </div>
        </div>

        <div className="space-y-2.5">
          {filteredUsers.map((u) => (
            <div
              key={u.id}
              className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-xl bg-[#080B12]/75 border border-white/10"
            >
              <div>
                <p className="text-xs font-bold text-[#F5F7FA]">
                  {u.name}{" "}
                  {u.id === currentAdmin.id && (
                    <span className="text-[10px] font-mono-nums text-[#00E5FF]">
                      (You)
                    </span>
                  )}
                </p>
                <p className="text-[11px] font-mono-nums text-[#94A3B8]">{u.email}</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {isSuperAdmin && u.id !== currentAdmin.id ? (
                  <>
                    <select
                      value={u.role}
                      onChange={async (e) => {
                        await updateAdminUser(u.id, {
                          role: e.target.value as AdminRole,
                        });
                        await onRefresh();
                      }}
                      className="bg-[#111827] border border-[#00E5FF]/25 rounded-lg px-2 py-1 text-xs text-[#F5F7FA]"
                    >
                      <option value="super_admin">Super Admin</option>
                      <option value="admin">Admin</option>
                      <option value="content_manager">Content Manager</option>
                    </select>
                    <button
                      type="button"
                      onClick={async () => {
                        await deleteAdminUser(u.id);
                        await onRefresh();
                      }}
                      className="p-1.5 rounded-lg bg-rose-950/60 text-rose-300 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </>
                ) : (
                  <span className="text-[11px] font-mono-nums px-2 py-1 rounded bg-[#161D2B] text-[#00E5FF]">
                    {u.role}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Activity Audit Logs */}
      <div className="bg-[#111827]/85 border border-[#00E5FF]/20 rounded-2xl p-5 space-y-3">
        <h3 className="text-sm font-bold text-[#F5F7FA]">Security Audit Logs</h3>
        <div className="space-y-1.5 max-h-72 overflow-y-auto pr-1">
          {logs.map((l) => (
            <div
              key={l.id}
              className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 px-3 py-2 rounded-lg bg-[#080B12]/70 border border-white/5 text-xs"
            >
              <span className="text-[#F5F7FA]">
                <strong>{l.action}</strong>{" "}
                <span className="text-[#94A3B8]">
                  ({l.entity_type}) {l.details ? `— ${l.details}` : ""}
                </span>
              </span>
              <span className="text-[10px] font-mono-nums text-[#94A3B8] shrink-0">
                {l.admin_email} · {new Date(l.created_at).toLocaleString()}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
