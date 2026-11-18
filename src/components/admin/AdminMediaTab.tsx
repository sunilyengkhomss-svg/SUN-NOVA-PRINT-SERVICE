import React, { useEffect, useMemo, useState } from "react";
import {
  Check,
  Copy,
  Download,
  FileCode2,
  FileSpreadsheet,
  FileText,
  Lock,
  Pencil,
  Plus,
  RefreshCw,
  Save,
  Search,
  SlidersHorizontal,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { MediaFileRecord, MediaVisibility, WebsiteSettings } from "../../types/cms";
import {
  bulkDeleteMediaFiles,
  deleteMediaFile,
  replaceMediaFile,
  updateAdminSettings,
  updateMediaMetadata,
  uploadMediaFiles,
} from "../../utils/adminApi";

interface AdminMediaTabProps {
  files: MediaFileRecord[];
  settings: WebsiteSettings;
  onRefresh: () => Promise<void>;
}

function formatBytesLabel(bytes: number): string {
  if (bytes >= 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  }
  return `${Math.max(0.1, bytes / 1024).toFixed(1)} KB`;
}

function isTextPreviewable(mime: string, filename: string): boolean {
  const lower = filename.toLowerCase();
  return (
    mime.includes("xml") ||
    mime.includes("json") ||
    mime.includes("csv") ||
    mime.startsWith("text/") ||
    lower.endsWith(".xml") ||
    lower.endsWith(".json") ||
    lower.endsWith(".csv") ||
    lower.endsWith(".txt") ||
    lower.endsWith(".md") ||
    lower.endsWith(".svg")
  );
}

function getFileExtensionLabel(file: MediaFileRecord): string {
  const clean = file.filename.split(".").pop()?.trim().toUpperCase();
  if (clean && clean.length <= 6 && clean !== file.filename.toUpperCase()) {
    return clean;
  }
  if (file.mime_type === "application/pdf") return "PDF";
  if (file.mime_type.includes("xml")) return "XML";
  if (file.mime_type.includes("json")) return "JSON";
  if (file.mime_type.includes("csv")) return "CSV";
  return "FILE";
}

export function AdminMediaTab({
  files,
  settings,
  onRefresh,
}: AdminMediaTabProps) {
  const [uploadCategory, setUploadCategory] = useState(
    settings.uploadCategories?.[0] || "general"
  );
  const [uploadVisibility, setUploadVisibility] = useState<MediaVisibility>("public");
  const [customFilename, setCustomFilename] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  // Customizable Upload Policy panel state
  const [showPolicyPanel, setShowPolicyPanel] = useState(false);
  const [policyAllowAny, setPolicyAllowAny] = useState(settings.allowAnyUpload);
  const [policyExtensions, setPolicyExtensions] = useState<string[]>(
    settings.allowedUploadExtensions || []
  );
  const [newExtension, setNewExtension] = useState("");
  const [policyCategories, setPolicyCategories] = useState<string[]>(
    settings.uploadCategories || []
  );
  const [newCategory, setNewCategory] = useState("");
  const [policyMaxCustomMb, setPolicyMaxCustomMb] = useState<number>(
    settings.maxCustomUploadMb || 25
  );
  const [savingPolicy, setSavingPolicy] = useState(false);

  // Search, Filter, Sort & Multi-Select Removal
  const [search, setSearch] = useState("");
  const [filterCategory, setFilterCategory] = useState("all");
  const [sortBy, setSortBy] = useState<"newest" | "oldest" | "name">("newest");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkDeleting, setBulkDeleting] = useState(false);

  // Inline Edit & Preview
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [editingCategory, setEditingCategory] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [previewFile, setPreviewFile] = useState<MediaFileRecord | null>(null);
  const [previewTextContent, setPreviewTextContent] = useState<string | null>(null);

  useEffect(() => {
    setPolicyAllowAny(settings.allowAnyUpload);
    setPolicyExtensions(settings.allowedUploadExtensions || []);
    setPolicyCategories(settings.uploadCategories || []);
    setPolicyMaxCustomMb(settings.maxCustomUploadMb || 25);
  }, [settings]);

  useEffect(() => {
    if (!previewFile) {
      setPreviewTextContent(null);
      return;
    }
    if (!isTextPreviewable(previewFile.mime_type, previewFile.filename)) {
      setPreviewTextContent(null);
      return;
    }
    let cancelled = false;
    fetch(`/api/admin/media/${encodeURIComponent(previewFile.id)}/file`, {
      credentials: "include",
    })
      .then((res) => (res.ok ? res.text() : Promise.reject(new Error("Preview failed"))))
      .then((txt) => {
        if (!cancelled) {
          setPreviewTextContent(txt.slice(0, 40000));
        }
      })
      .catch(() => {
        if (!cancelled) setPreviewTextContent("Unable to load text preview.");
      });
    return () => {
      cancelled = true;
    };
  }, [previewFile]);

  const availableCategories = useMemo(() => {
    const base = new Set<string>([
      ...(settings.uploadCategories || []),
      ...files.map((f) => f.category).filter(Boolean),
    ]);
    return Array.from(base);
  }, [files, settings.uploadCategories]);

  const dynamicAcceptAttr = useMemo(() => {
    if (settings.allowAnyUpload) return undefined;
    if (!settings.allowedUploadExtensions?.length) {
      return "image/jpeg,image/png,image/webp,application/pdf";
    }
    return settings.allowedUploadExtensions.map((ext) => `.${ext}`).join(",");
  }, [settings.allowAnyUpload, settings.allowedUploadExtensions]);

  const filteredFiles = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = files.filter((f) => {
      if (filterCategory === "pdf" && f.mime_type !== "application/pdf") return false;
      if (filterCategory === "xml" && !f.mime_type.includes("xml") && !f.filename.toLowerCase().endsWith(".xml") && f.category !== "xml") {
        return false;
      }
      if (
        filterCategory !== "all" &&
        filterCategory !== "pdf" &&
        filterCategory !== "xml" &&
        f.category !== filterCategory
      ) {
        return false;
      }
      if (
        q &&
        !f.filename.toLowerCase().includes(q) &&
        !f.category.toLowerCase().includes(q) &&
        !f.mime_type.toLowerCase().includes(q)
      ) {
        return false;
      }
      return true;
    });

    list.sort((a, b) => {
      if (sortBy === "name") return a.filename.localeCompare(b.filename);
      if (sortBy === "oldest") return a.created_at.localeCompare(b.created_at);
      return b.created_at.localeCompare(a.created_at);
    });
    return list;
  }, [files, filterCategory, search, sortBy]);

  const handleUploadList = async (selected: FileList | File[] | null) => {
    if (!selected || selected.length === 0) return;
    setError(null);
    setStatus(null);
    setUploading(true);
    try {
      const arr = Array.from(selected);
      const res = await uploadMediaFiles(
        arr,
        uploadCategory,
        uploadVisibility,
        arr.length === 1 ? customFilename : undefined
      );
      setCustomFilename("");
      setStatus(`Uploaded ${res.files.length} file(s) to storage cleanly.`);
      await onRefresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setUploading(false);
    }
  };

  const handleSaveUploadPolicy = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setStatus(null);
    setSavingPolicy(true);
    try {
      await updateAdminSettings({
        allowAnyUpload: policyAllowAny,
        allowedUploadExtensions: policyExtensions,
        uploadCategories: policyCategories,
        maxCustomUploadMb: policyMaxCustomMb,
      });
      setStatus("Saved customizable upload formats, size limit, and categories.");
      await onRefresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save upload policy.");
    } finally {
      setSavingPolicy(false);
    }
  };

  const handleAddExtension = () => {
    const cleaned = newExtension
      .trim()
      .toLowerCase()
      .replace(/^\.+/, "")
      .replace(/[^a-z0-9]/g, "");
    if (!cleaned) return;
    if (!policyExtensions.includes(cleaned)) {
      setPolicyExtensions((prev) => [...prev, cleaned]);
    }
    setNewExtension("");
  };

  const handleAddCategory = () => {
    const cleaned = newCategory
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9_-]/g, "_")
      .slice(0, 40);
    if (!cleaned) return;
    if (!policyCategories.includes(cleaned)) {
      setPolicyCategories((prev) => [...prev, cleaned]);
    }
    setUploadCategory(cleaned);
    setNewCategory("");
  };

  const handleRename = async (id: string) => {
    if (!editingName.trim()) return;
    setError(null);
    try {
      await updateMediaMetadata(id, {
        filename: editingName.trim(),
        category: editingCategory.trim() || undefined,
      });
      setEditingId(null);
      await onRefresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Update failed.");
    }
  };

  const handleReplace = async (id: string, file: File | undefined) => {
    if (!file) return;
    setError(null);
    setStatus(null);
    try {
      await replaceMediaFile(id, file);
      setStatus("Replaced file in storage and refreshed connected references.");
      await onRefresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Replace failed.");
    }
  };

  const handleDelete = async (file: MediaFileRecord) => {
    setError(null);
    setStatus(null);
    try {
      await deleteMediaFile(file.id, false);
      setSelectedIds((prev) => {
        const next = new Set(prev);
        next.delete(file.id);
        return next;
      });
      setStatus(`Removed "${file.filename}" from D1 & R2 storage.`);
      await onRefresh();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Delete failed.";
      if (msg.includes("referenced by")) {
        try {
          await deleteMediaFile(file.id, true);
          setSelectedIds((prev) => {
            const next = new Set(prev);
            next.delete(file.id);
            return next;
          });
          setStatus(`Detached active references and removed "${file.filename}".`);
          await onRefresh();
          return;
        } catch (forceErr) {
          setError(forceErr instanceof Error ? forceErr.message : msg);
          return;
        }
      }
      setError(msg);
    }
  };

  const handleBulkDelete = async () => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    setError(null);
    setStatus(null);
    setBulkDeleting(true);
    try {
      const res = await bulkDeleteMediaFiles(ids, true);
      setSelectedIds(new Set());
      setStatus(`Removed ${res.deletedCount} selected file(s) from D1 & R2 storage.`);
      await onRefresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Bulk removal failed.");
    } finally {
      setBulkDeleting(false);
    }
  };

  const toggleSelection = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAllFiltered = () => {
    const filteredIds = filteredFiles.map((f) => f.id);
    const allSelected =
      filteredIds.length > 0 && filteredIds.every((id) => selectedIds.has(id));
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredIds));
    }
  };

  const handleCopyUrl = async (file: MediaFileRecord) => {
    if (!file.public_url) return;
    const fullUrl = `${window.location.origin}${file.public_url}`;
    try {
      await navigator.clipboard.writeText(fullUrl);
      setCopiedId(file.id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      // ignore clipboard errors
    }
  };

  return (
    <div className="space-y-6">
      {/* Upload Dropzone & Customizable Policy Trigger */}
      <div className="bg-[#111827]/85 border border-[#00E5FF]/20 rounded-2xl p-4 sm:p-6 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-[#F5F7FA]">
              Customizable Any-File Upload &amp; Remove Manager
            </h2>
            <p className="text-xs text-[#94A3B8] mt-0.5">
              {settings.allowAnyUpload
                ? `Any safe file enabled (XML, JSON, CSV, Docs, ZIP, PDF, Images · up to ${settings.maxCustomUploadMb} MB)`
                : `Restricted whitelist: ${settings.allowedUploadExtensions.map((e) => `.${e}`).join(", ")} · Images ${settings.maxImageUploadMb} MB / PDF ${settings.maxPdfUploadMb} MB / Custom ${settings.maxCustomUploadMb} MB`}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <select
              aria-label="Upload category"
              value={uploadCategory}
              onChange={(e) => setUploadCategory(e.target.value)}
              className="bg-[#080B12] border border-[#00E5FF]/25 rounded-lg px-2.5 py-1.5 text-xs text-[#F5F7FA]"
            >
              {availableCategories.map((cat) => (
                <option key={cat} value={cat}>
                  Category: {cat}
                </option>
              ))}
            </select>

            <select
              aria-label="Storage visibility"
              value={uploadVisibility}
              onChange={(e) => setUploadVisibility(e.target.value as MediaVisibility)}
              className="bg-[#080B12] border border-[#00E5FF]/25 rounded-lg px-2.5 py-1.5 text-xs text-[#F5F7FA]"
            >
              <option value="public">Public Asset</option>
              <option value="private">Private Storage</option>
            </select>

            <button
              type="button"
              onClick={() => setShowPolicyPanel((prev) => !prev)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors cursor-pointer ${
                showPolicyPanel
                  ? "bg-[#00E5FF] text-[#080B12] border-[#00E5FF]"
                  : "bg-[#080B12] text-[#00E5FF] border-[#00E5FF]/30 hover:border-[#00E5FF]"
              }`}
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              <span>Customize Upload Rules</span>
            </button>
          </div>
        </div>

        {/* Collapsible Customizable Upload Rules Form */}
        {showPolicyPanel && (
          <form
            onSubmit={handleSaveUploadPolicy}
            className="bg-[#080B12]/90 border border-[#00E5FF]/25 rounded-xl p-4 space-y-4"
          >
            <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-white/10">
              <div>
                <h3 className="text-xs font-bold text-[#F5F7FA]">
                  Customizable Backend Upload Rules
                </h3>
                <p className="text-[11px] text-[#94A3B8]">
                  Control whether any safe file type can be uploaded, customize accepted extensions, size limits, and upload folders.
                </p>
              </div>
              <label className="inline-flex items-center gap-2 text-xs font-semibold text-[#F5F7FA] cursor-pointer">
                <input
                  type="checkbox"
                  checked={policyAllowAny}
                  onChange={(e) => setPolicyAllowAny(e.target.checked)}
                  className="accent-[#00E5FF] w-4 h-4 rounded cursor-pointer"
                />
                <span>Allow Any Safe File Upload</span>
              </label>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
              <div className="lg:col-span-5 space-y-2">
                <label className="block text-[11px] font-semibold text-[#94A3B8]">
                  Allowed Extensions ({policyAllowAny ? "Whitelist bypassed except executables" : "Active whitelist"})
                </label>
                <div className="flex gap-1.5">
                  <input
                    type="text"
                    value={newExtension}
                    onChange={(e) => setNewExtension(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        handleAddExtension();
                      }
                    }}
                    placeholder="Add ext (e.g. xml, docx, csv)"
                    className="flex-1 bg-[#111827] border border-[#00E5FF]/25 rounded-lg px-2.5 py-1.5 text-xs text-[#F5F7FA]"
                  />
                  <button
                    type="button"
                    onClick={handleAddExtension}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[#161D2B] border border-[#00E5FF]/30 text-xs font-semibold text-[#00E5FF] cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add</span>
                  </button>
                </div>
                <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto pt-1">
                  {policyExtensions.map((ext) => (
                    <button
                      key={ext}
                      type="button"
                      onClick={() =>
                        setPolicyExtensions((prev) => prev.filter((item) => item !== ext))
                      }
                      title={`Remove .${ext}`}
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-[#161D2B] border border-white/10 text-[11px] font-mono-nums text-[#E2E8F0] hover:border-rose-400/50 cursor-pointer"
                    >
                      <span>.{ext}</span>
                      <X className="w-2.5 h-2.5 text-slate-400" />
                    </button>
                  ))}
                </div>
              </div>

              <div className="lg:col-span-5 space-y-2">
                <label className="block text-[11px] font-semibold text-[#94A3B8]">
                  Custom Upload Categories / Folders
                </label>
                <div className="flex gap-1.5">
                  <input
                    type="text"
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        handleAddCategory();
                      }
                    }}
                    placeholder="Add category (e.g. xml_feeds, invoices)"
                    className="flex-1 bg-[#111827] border border-[#00E5FF]/25 rounded-lg px-2.5 py-1.5 text-xs text-[#F5F7FA]"
                  />
                  <button
                    type="button"
                    onClick={handleAddCategory}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[#161D2B] border border-[#00E5FF]/30 text-xs font-semibold text-[#00E5FF] cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add</span>
                  </button>
                </div>
                <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto pt-1">
                  {policyCategories.map((cat) => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() =>
                        setPolicyCategories((prev) =>
                          prev.length > 1 ? prev.filter((item) => item !== cat) : prev
                        )
                      }
                      title={`Remove category ${cat}`}
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-[#161D2B] border border-white/10 text-[11px] text-[#E2E8F0] hover:border-rose-400/50 cursor-pointer"
                    >
                      <span>{cat}</span>
                      <X className="w-2.5 h-2.5 text-slate-400" />
                    </button>
                  ))}
                </div>
              </div>

              <div className="lg:col-span-2 flex flex-col justify-between gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-[#94A3B8] mb-1">
                    Custom Max MB
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={100}
                    value={policyMaxCustomMb}
                    onChange={(e) =>
                      setPolicyMaxCustomMb(Math.min(100, Math.max(1, Number(e.target.value) || 25)))
                    }
                    className="w-full bg-[#111827] border border-[#00E5FF]/25 rounded-lg px-2.5 py-1.5 text-xs font-mono-nums text-[#F5F7FA]"
                  />
                </div>
                <button
                  type="submit"
                  disabled={savingPolicy}
                  className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-gradient-to-r from-[#00E5FF] to-[#8B5CF6] text-[#080B12] text-xs font-bold cursor-pointer"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>{savingPolicy ? "Saving..." : "Save Rules"}</span>
                </button>
              </div>
            </div>
          </form>
        )}

        {/* Optional Custom Filename for single-file upload */}
        <div className="flex flex-col sm:flex-row gap-2.5 items-stretch sm:items-center">
          <input
            type="text"
            value={customFilename}
            onChange={(e) => setCustomFilename(e.target.value)}
            placeholder="Optional custom display filename for single-file upload (e.g. client-order.xml)"
            className="flex-1 bg-[#080B12] border border-[#00E5FF]/20 rounded-xl px-3 py-2 text-xs text-[#F5F7FA] placeholder:text-slate-500"
          />
        </div>

        <label
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setIsDragging(false);
            handleUploadList(e.dataTransfer.files);
          }}
          className={`flex flex-col items-center justify-center border-2 border-dashed rounded-xl p-6 sm:p-8 cursor-pointer transition-colors ${
            isDragging
              ? "border-[#00E5FF] bg-[#00E5FF]/10"
              : "border-[#00E5FF]/25 hover:border-[#00E5FF]/60 bg-[#080B12]/70"
          }`}
        >
          <Upload className="w-7 h-7 text-[#00E5FF] mb-2" />
          <p className="text-sm font-semibold text-[#F5F7FA] text-center">
            {uploading
              ? "Uploading & validating files in backend storage..."
              : "Drag & drop any allowed files here or click to browse"}
          </p>
          <p className="text-[11px] text-[#94A3B8] mt-1 text-center">
            Supports XML, JSON, CSV, PDF, Images, SVG, Office Docs &amp; Archives · Executable binaries auto-blocked
          </p>
          <input
            type="file"
            multiple
            accept={dynamicAcceptAttr}
            onChange={(e) => {
              handleUploadList(e.target.files);
              e.target.value = "";
            }}
            className="hidden"
          />
        </label>

        {error && (
          <div className="text-xs text-rose-200 bg-rose-950/60 border border-rose-500/40 rounded-xl px-3.5 py-2">
            {error}
          </div>
        )}
        {status && (
          <div className="text-xs text-emerald-200 bg-emerald-950/60 border border-emerald-500/40 rounded-xl px-3.5 py-2">
            {status}
          </div>
        )}
      </div>

      {/* Filters, Search & Bulk Removal Action Bar */}
      <div className="flex flex-col gap-3 bg-[#111827]/85 border border-[#00E5FF]/15 rounded-2xl p-3.5">
        <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-[#94A3B8] absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search filename, MIME type, or category..."
              className="w-full bg-[#080B12] border border-[#00E5FF]/20 rounded-xl pl-9 pr-3 py-2 text-xs text-[#F5F7FA] focus:outline-none focus:ring-2 focus:ring-[#00E5FF]"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <select
              aria-label="Filter category"
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              className="bg-[#080B12] border border-[#00E5FF]/20 rounded-xl px-3 py-2 text-xs text-[#F5F7FA]"
            >
              <option value="all">Category: all</option>
              {availableCategories.map((c) => (
                <option key={c} value={c}>
                  Category: {c}
                </option>
              ))}
              <option value="quote_attachment">Category: quote_attachment</option>
            </select>

            <select
              aria-label="Sort files"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as "newest" | "oldest" | "name")}
              className="bg-[#080B12] border border-[#00E5FF]/20 rounded-xl px-3 py-2 text-xs text-[#F5F7FA]"
            >
              <option value="newest">Sort: Newest First</option>
              <option value="oldest">Sort: Oldest First</option>
              <option value="name">Sort: Filename A–Z</option>
            </select>
          </div>
        </div>

        {filteredFiles.length > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-white/10">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={toggleSelectAllFiltered}
                className="px-2.5 py-1 rounded-lg bg-[#080B12] border border-[#00E5FF]/25 text-[11px] font-semibold text-[#E2E8F0] hover:border-[#00E5FF] cursor-pointer"
              >
                {filteredFiles.every((f) => selectedIds.has(f.id))
                  ? "Unselect All"
                  : `Select All (${filteredFiles.length})`}
              </button>
              <span className="text-[11px] font-mono-nums text-[#94A3B8]">
                {selectedIds.size} selected
              </span>
            </div>

            {selectedIds.size > 0 && (
              <button
                type="button"
                disabled={bulkDeleting}
                onClick={handleBulkDelete}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-950/80 hover:bg-rose-900 text-rose-200 border border-rose-500/40 text-xs font-semibold cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>
                  {bulkDeleting
                    ? "Removing..."
                    : `Remove Selected (${selectedIds.size})`}
                </span>
              </button>
            )}
          </div>
        )}
      </div>

      {/* File Grid */}
      {filteredFiles.length === 0 ? (
        <div className="bg-[#111827]/75 border border-[#00E5FF]/15 rounded-2xl p-10 text-center text-xs text-[#94A3B8]">
          No files match the selected filter.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredFiles.map((file) => {
            const isImg = file.mime_type.startsWith("image/");
            const isXml =
              file.mime_type.includes("xml") ||
              file.filename.toLowerCase().endsWith(".xml");
            const isCsvOrSheet =
              file.mime_type.includes("csv") ||
              file.mime_type.includes("sheet") ||
              file.filename.toLowerCase().endsWith(".csv") ||
              file.filename.toLowerCase().endsWith(".xlsx");
            const previewSrc =
              file.visibility === "public" && file.public_url
                ? file.public_url
                : `/api/admin/media/${encodeURIComponent(file.id)}/file`;
            const downloadUrl = `/api/admin/media/${encodeURIComponent(file.id)}/file?download=1`;
            const isChecked = selectedIds.has(file.id);

            return (
              <div
                key={file.id}
                className={`bg-[#111827]/90 border rounded-2xl overflow-hidden flex flex-col transition-colors ${
                  isChecked ? "border-[#00E5FF] ring-1 ring-[#00E5FF]/40" : "border-[#00E5FF]/20"
                }`}
              >
                <div className="relative h-40 w-full bg-[#080B12] flex items-center justify-center overflow-hidden">
                  <label
                    className="absolute top-2.5 left-2.5 z-10 inline-flex items-center justify-center w-6 h-6 rounded-md bg-[#080B12]/85 border border-[#00E5FF]/40 cursor-pointer"
                    title="Select file for bulk remove"
                  >
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => toggleSelection(file.id)}
                      className="accent-[#00E5FF] w-3.5 h-3.5 cursor-pointer"
                    />
                  </label>

                  <button
                    type="button"
                    onClick={() => setPreviewFile(file)}
                    className="w-full h-full flex items-center justify-center cursor-pointer group"
                  >
                    {isImg ? (
                      <img
                        src={previewSrc}
                        alt={file.filename}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                      />
                    ) : isXml ? (
                      <div className="flex flex-col items-center gap-2 text-[#00E5FF]">
                        <FileCode2 className="w-10 h-10" />
                        <span className="text-[11px] font-mono-nums uppercase">XML File</span>
                      </div>
                    ) : isCsvOrSheet ? (
                      <div className="flex flex-col items-center gap-2 text-emerald-400">
                        <FileSpreadsheet className="w-10 h-10" />
                        <span className="text-[11px] font-mono-nums uppercase">
                          {getFileExtensionLabel(file)} Sheet
                        </span>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center gap-2 text-[#00E5FF]">
                        <FileText className="w-10 h-10" />
                        <span className="text-[11px] font-mono-nums uppercase">
                          {getFileExtensionLabel(file)} Document
                        </span>
                      </div>
                    )}
                  </button>

                  <span
                    className={`absolute top-2.5 right-2.5 inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-mono-nums border ${
                      file.visibility === "private"
                        ? "bg-amber-950/90 border-amber-400/40 text-amber-200"
                        : "bg-[#080B12]/80 border-[#00E5FF]/35 text-[#00E5FF]"
                    }`}
                  >
                    {file.visibility === "private" && <Lock className="w-2.5 h-2.5" />}
                    {file.visibility}
                  </span>
                </div>

                <div className="p-3.5 flex-1 flex flex-col gap-2.5">
                  {editingId === file.id ? (
                    <div className="space-y-1.5">
                      <input
                        type="text"
                        value={editingName}
                        onChange={(e) => setEditingName(e.target.value)}
                        className="w-full bg-[#080B12] border border-[#00E5FF]/40 rounded-lg px-2 py-1 text-xs text-[#F5F7FA]"
                        placeholder="Filename"
                      />
                      <div className="flex items-center gap-1.5">
                        <input
                          type="text"
                          value={editingCategory}
                          onChange={(e) => setEditingCategory(e.target.value)}
                          className="flex-1 min-w-0 bg-[#080B12] border border-[#00E5FF]/40 rounded-lg px-2 py-1 text-xs text-[#F5F7FA]"
                          placeholder="Category"
                        />
                        <button
                          type="button"
                          onClick={() => handleRename(file.id)}
                          className="px-2.5 py-1 rounded-lg bg-[#00E5FF] text-[#080B12] text-xs font-bold cursor-pointer"
                        >
                          Save
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingId(null)}
                          className="px-2 py-1 rounded-lg bg-[#161D2B] text-xs text-slate-300 cursor-pointer"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div>
                      <p className="text-xs font-bold text-[#F5F7FA] truncate" title={file.filename}>
                        {file.filename}
                      </p>
                      <p className="text-[11px] text-[#94A3B8] font-mono-nums mt-0.5 truncate">
                        {file.category} · {formatBytesLabel(file.file_size)}
                      </p>
                      <p className="text-[10px] text-slate-500 font-mono-nums">
                        {new Date(file.created_at).toLocaleDateString()}
                      </p>
                    </div>
                  )}

                  <div className="mt-auto pt-2 border-t border-white/10 flex flex-wrap items-center gap-1.5">
                    {file.visibility === "public" && file.public_url && (
                      <button
                        type="button"
                        onClick={() => handleCopyUrl(file)}
                        className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-[#161D2B] hover:bg-[#1E273B] border border-[#00E5FF]/20 text-[11px] text-[#00E5FF] cursor-pointer"
                      >
                        {copiedId === file.id ? (
                          <Check className="w-3 h-3 text-emerald-400" />
                        ) : (
                          <Copy className="w-3 h-3" />
                        )}
                        <span>{copiedId === file.id ? "Copied" : "URL"}</span>
                      </button>
                    )}

                    <a
                      href={downloadUrl}
                      download={file.filename}
                      title="Download file"
                      className="p-1.5 rounded-lg bg-[#161D2B] hover:bg-[#1E273B] text-[#E2E8F0]"
                    >
                      <Download className="w-3.5 h-3.5" />
                    </a>

                    <button
                      type="button"
                      onClick={() => {
                        setEditingId(file.id);
                        setEditingName(file.filename);
                        setEditingCategory(file.category);
                      }}
                      title="Edit filename or category"
                      className="p-1.5 rounded-lg bg-[#161D2B] hover:bg-[#1E273B] text-[#E2E8F0] cursor-pointer"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>

                    <label
                      title="Replace file in storage"
                      className="p-1.5 rounded-lg bg-[#161D2B] hover:bg-[#1E273B] text-[#00E5FF] cursor-pointer"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      <input
                        type="file"
                        accept={dynamicAcceptAttr}
                        onChange={(e) => {
                          handleReplace(file.id, e.target.files?.[0]);
                          e.target.value = "";
                        }}
                        className="hidden"
                      />
                    </label>

                    <button
                      type="button"
                      onClick={() => handleDelete(file)}
                      title="Remove file"
                      className="ml-auto p-1.5 rounded-lg bg-rose-950/60 hover:bg-rose-900/70 text-rose-300 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Lightbox Preview */}
      {previewFile && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 bg-[#080B12]/90 backdrop-blur-md flex items-center justify-center p-4"
        >
          <div className="bg-[#111827] border border-[#00E5FF]/35 rounded-2xl max-w-3xl w-full overflow-hidden">
            <div className="px-4 py-3 border-b border-white/10 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <h3 className="text-sm font-bold text-[#F5F7FA] truncate">
                  {previewFile.filename}
                </h3>
                <p className="text-[11px] font-mono-nums text-[#94A3B8]">
                  {previewFile.mime_type} · {formatBytesLabel(previewFile.file_size)}
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <a
                  href={`/api/admin/media/${encodeURIComponent(previewFile.id)}/file?download=1`}
                  download={previewFile.filename}
                  className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-[#00E5FF] text-[#080B12] text-xs font-bold"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download</span>
                </a>
                <button
                  type="button"
                  onClick={() => setPreviewFile(null)}
                  className="px-3 py-1 rounded-lg bg-[#161D2B] text-xs font-semibold text-[#F5F7FA] cursor-pointer"
                >
                  Close
                </button>
              </div>
            </div>
            <div className="p-4 bg-[#080B12] flex items-center justify-center max-h-[70vh] overflow-auto">
              {previewFile.mime_type.startsWith("image/") ? (
                <img
                  src={
                    previewFile.visibility === "public" && previewFile.public_url
                      ? previewFile.public_url
                      : `/api/admin/media/${encodeURIComponent(previewFile.id)}/file`
                  }
                  alt={previewFile.filename}
                  className="max-h-[62vh] object-contain rounded-lg"
                />
              ) : isTextPreviewable(previewFile.mime_type, previewFile.filename) ? (
                <pre className="w-full max-h-[60vh] overflow-auto rounded-lg border border-white/10 bg-[#0B0F19] p-4 text-xs font-mono-nums text-[#E2E8F0] whitespace-pre-wrap break-words">
                  {previewTextContent ?? "Loading text content..."}
                </pre>
              ) : previewFile.mime_type === "application/pdf" ? (
                <iframe
                  title={previewFile.filename}
                  src={`/api/admin/media/${encodeURIComponent(previewFile.id)}/file`}
                  className="w-full h-[60vh] rounded-lg border border-white/10"
                />
              ) : (
                <div className="py-12 px-6 text-center space-y-3">
                  <FileText className="w-12 h-12 text-[#00E5FF] mx-auto" />
                  <p className="text-sm font-semibold text-[#F5F7FA]">
                    Binary / Archive Document ({previewFile.mime_type})
                  </p>
                  <p className="text-xs text-[#94A3B8]">
                    Use the Download button above to inspect this file locally.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
