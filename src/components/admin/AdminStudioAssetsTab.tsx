import React, { useState } from "react";
import { Eye, EyeOff, Plus, RefreshCw, Trash2, Upload } from "lucide-react";
import {
  BackgroundPresetRecord,
  MediaFileRecord,
  OutfitCategory,
  OutfitTemplateRecord,
  SamplePortraitRecord,
} from "../../types/cms";
import { DressStyleId } from "../../types/photo";
import {
  createBackground,
  createOutfit,
  createPortrait,
  deleteBackground,
  deleteOutfit,
  deletePortrait,
  updateBackground,
  updateOutfit,
  updatePortrait,
  uploadMediaFiles,
} from "../../utils/adminApi";
import { buildDressDataUrl } from "../../utils/dressTemplates";

interface AdminStudioAssetsTabProps {
  mode: "outfits" | "backgrounds" | "portraits";
  outfits: OutfitTemplateRecord[];
  backgrounds: BackgroundPresetRecord[];
  portraits: SamplePortraitRecord[];
  mediaFiles: MediaFileRecord[];
  onRefresh: () => Promise<void>;
}

const OUTFIT_CATS: OutfitCategory[] = [
  "Student",
  "Officer",
  "Men",
  "Women",
  "Formal",
  "Custom",
];

export function AdminStudioAssetsTab({
  mode,
  outfits,
  backgrounds,
  portraits,
  onRefresh,
}: AdminStudioAssetsTabProps) {
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // New Outfit form
  const [outfitName, setOutfitName] = useState("");
  const [outfitCategory, setOutfitCategory] = useState<OutfitCategory>("Student");
  const [outfitOrder, setOutfitOrder] = useState(20);
  const [outfitFile, setOutfitFile] = useState<File | null>(null);

  // New Background form
  const [bgName, setBgName] = useState("");
  const [bgType, setBgType] = useState<"color" | "image">("color");
  const [bgHex, setBgHex] = useState("#DCE9F5");
  const [bgFile, setBgFile] = useState<File | null>(null);

  // New Sample Portrait form
  const [portraitTitle, setPortraitTitle] = useState("");
  const [portraitFile, setPortraitFile] = useState<File | null>(null);

  const handleCreateOutfit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!outfitName.trim()) return;
    setError(null);
    setStatus(null);
    setBusy(true);
    try {
      let mediaId: string | null = null;
      let imageUrl: string | null = null;
      if (outfitFile) {
        const up = await uploadMediaFiles([outfitFile], "outfit", "public");
        mediaId = up.files[0]?.id || null;
        imageUrl = up.files[0]?.public_url || null;
      }
      await createOutfit({
        name: outfitName.trim(),
        category: outfitCategory,
        mediaId,
        imageUrl,
        displayOrder: outfitOrder,
        isPublished: true,
      });
      setOutfitName("");
      setOutfitFile(null);
      setStatus("Outfit template added & published to Passport Photo Studio.");
      await onRefresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add outfit.");
    } finally {
      setBusy(false);
    }
  };

  const handleReplaceOutfitImage = async (outfitId: string, file: File | undefined) => {
    if (!file) return;
    setError(null);
    setBusy(true);
    try {
      const up = await uploadMediaFiles([file], "outfit", "public");
      const mf = up.files[0];
      if (mf) {
        await updateOutfit(outfitId, {
          mediaId: mf.id,
          imageUrl: mf.public_url,
        });
        setStatus("Updated outfit artwork image.");
        await onRefresh();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update outfit image.");
    } finally {
      setBusy(false);
    }
  };

  const handleCreateBackground = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bgName.trim()) return;
    setError(null);
    setStatus(null);
    setBusy(true);
    try {
      let mediaId: string | null = null;
      let imageUrl: string | null = null;
      if (bgType === "image") {
        if (!bgFile) {
          setError("Please select a background image file.");
          setBusy(false);
          return;
        }
        const up = await uploadMediaFiles([bgFile], "background", "public");
        mediaId = up.files[0]?.id || null;
        imageUrl = up.files[0]?.public_url || null;
      }
      await createBackground({
        name: bgName.trim(),
        presetType: bgType,
        hexColor: bgType === "color" ? bgHex : undefined,
        mediaId,
        imageUrl,
        displayOrder: backgrounds.length + 1,
        isPublished: true,
      });
      setBgName("");
      setBgFile(null);
      setStatus("Background preset added & published to Passport Photo Studio.");
      await onRefresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add background.");
    } finally {
      setBusy(false);
    }
  };

  const handleCreatePortrait = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!portraitTitle.trim() || !portraitFile) {
      setError("Portrait title and image file are required.");
      return;
    }
    setError(null);
    setStatus(null);
    setBusy(true);
    try {
      const up = await uploadMediaFiles([portraitFile], "portrait", "public");
      const mf = up.files[0];
      await createPortrait({
        title: portraitTitle.trim(),
        mediaId: mf.id,
        imageUrl: mf.public_url,
        displayOrder: portraits.length + 1,
        isPublished: true,
      });
      setPortraitTitle("");
      setPortraitFile(null);
      setStatus("Sample portrait added to Load Sample Portrait feature.");
      await onRefresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to upload portrait.");
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

      {mode === "outfits" && (
        <>
          <form
            onSubmit={handleCreateOutfit}
            className="bg-[#111827]/85 border border-[#00E5FF]/20 rounded-2xl p-4 sm:p-6 space-y-4"
          >
            <h2 className="text-base font-bold text-[#F5F7FA]">
              Student &amp; Officer Outfit Manager
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <div>
                <label className="block text-xs font-semibold text-[#94A3B8] mb-1">
                  Outfit Name
                </label>
                <input
                  type="text"
                  required
                  value={outfitName}
                  onChange={(e) => setOutfitName(e.target.value)}
                  placeholder="e.g. NCC Cadet Khaki"
                  className="w-full bg-[#080B12] border border-[#00E5FF]/25 rounded-xl px-3 py-2 text-xs text-[#F5F7FA]"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#94A3B8] mb-1">
                  Category
                </label>
                <select
                  value={outfitCategory}
                  onChange={(e) => setOutfitCategory(e.target.value as OutfitCategory)}
                  className="w-full bg-[#080B12] border border-[#00E5FF]/25 rounded-xl px-3 py-2 text-xs text-[#F5F7FA]"
                >
                  {OUTFIT_CATS.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#94A3B8] mb-1">
                  Display Order
                </label>
                <input
                  type="number"
                  value={outfitOrder}
                  onChange={(e) => setOutfitOrder(Number(e.target.value) || 0)}
                  className="w-full bg-[#080B12] border border-[#00E5FF]/25 rounded-xl px-3 py-2 text-xs text-[#F5F7FA] font-mono-nums"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#94A3B8] mb-1">
                  Transparent PNG Outfit Image
                </label>
                <label className="flex items-center justify-between gap-2 bg-[#080B12] border border-dashed border-[#00E5FF]/35 rounded-xl px-3 py-2 text-xs text-[#94A3B8] cursor-pointer">
                  <span className="truncate">
                    {outfitFile ? outfitFile.name : "Choose PNG / WEBP..."}
                  </span>
                  <Upload className="w-3.5 h-3.5 text-[#00E5FF] shrink-0" />
                  <input
                    type="file"
                    accept="image/png,image/webp,image/jpeg"
                    onChange={(e) => setOutfitFile(e.target.files?.[0] || null)}
                    className="hidden"
                  />
                </label>
              </div>
            </div>

            <button
              type="submit"
              disabled={busy}
              className="inline-flex items-center gap-2 bg-gradient-to-r from-[#00E5FF] to-[#8B5CF6] text-[#080B12] font-bold text-xs px-5 py-2.5 rounded-xl cursor-pointer disabled:opacity-50"
            >
              <Plus className="w-4 h-4" />
              <span>{busy ? "Saving Outfit..." : "Add & Publish Outfit"}</span>
            </button>
          </form>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {outfits.map((o) => {
              const previewSrc =
                o.image_url ||
                (o.builtin_style_id
                  ? buildDressDataUrl(o.builtin_style_id as DressStyleId)
                  : null);
              return (
                <div
                  key={o.id}
                  className="bg-[#111827]/90 border border-[#00E5FF]/20 rounded-2xl p-4 space-y-3"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-16 h-16 rounded-xl bg-[#161D2B] border border-white/10 flex items-center justify-center overflow-hidden shrink-0">
                      {previewSrc ? (
                        <img
                          src={previewSrc}
                          alt={o.name}
                          className="w-14 h-14 object-contain"
                        />
                      ) : (
                        <span className="text-[10px] text-[#94A3B8]">No Image</span>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <span className="text-[10px] font-mono-nums text-[#00E5FF] uppercase">
                        {o.category} · Order #{o.display_order}
                      </span>
                      <h3 className="text-xs font-bold text-[#F5F7FA] truncate">
                        {o.name}
                      </h3>
                      <span
                        className={`inline-block mt-1 text-[10px] font-mono-nums px-1.5 py-0.5 rounded ${
                          o.is_published
                            ? "bg-emerald-950 text-emerald-300"
                            : "bg-slate-800 text-slate-400"
                        }`}
                      >
                        {o.is_published ? "Published" : "Hidden"}
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-white/10">
                    <button
                      type="button"
                      onClick={async () => {
                        await updateOutfit(o.id, { isPublished: !o.is_published });
                        await onRefresh();
                      }}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[#161D2B] text-xs font-semibold text-[#F5F7FA] cursor-pointer"
                    >
                      {o.is_published ? (
                        <EyeOff className="w-3.5 h-3.5 text-amber-300" />
                      ) : (
                        <Eye className="w-3.5 h-3.5 text-emerald-400" />
                      )}
                      <span>{o.is_published ? "Unpublish" : "Publish"}</span>
                    </button>

                    <label className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[#161D2B] text-xs font-semibold text-[#00E5FF] cursor-pointer">
                      <RefreshCw className="w-3.5 h-3.5" />
                      <span>Replace Img</span>
                      <input
                        type="file"
                        accept="image/png,image/webp,image/jpeg"
                        onChange={(e) => {
                          handleReplaceOutfitImage(o.id, e.target.files?.[0]);
                          e.target.value = "";
                        }}
                        className="hidden"
                      />
                    </label>

                    <button
                      type="button"
                      onClick={async () => {
                        await deleteOutfit(o.id);
                        await onRefresh();
                      }}
                      className="ml-auto p-1.5 rounded-lg bg-rose-950/60 text-rose-300 cursor-pointer"
                      aria-label={`Delete ${o.name}`}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {mode === "backgrounds" && (
        <>
          <form
            onSubmit={handleCreateBackground}
            className="bg-[#111827]/85 border border-[#00E5FF]/20 rounded-2xl p-4 sm:p-6 space-y-4"
          >
            <h2 className="text-base font-bold text-[#F5F7FA]">
              Studio Background Manager
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <div>
                <label className="block text-xs font-semibold text-[#94A3B8] mb-1">
                  Background Name
                </label>
                <input
                  type="text"
                  required
                  value={bgName}
                  onChange={(e) => setBgName(e.target.value)}
                  placeholder="e.g. Royal Blue Gradient"
                  className="w-full bg-[#080B12] border border-[#00E5FF]/25 rounded-xl px-3 py-2 text-xs text-[#F5F7FA]"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#94A3B8] mb-1">
                  Type
                </label>
                <select
                  value={bgType}
                  onChange={(e) => setBgType(e.target.value as "color" | "image")}
                  className="w-full bg-[#080B12] border border-[#00E5FF]/25 rounded-xl px-3 py-2 text-xs text-[#F5F7FA]"
                >
                  <option value="color">Solid Color Preset</option>
                  <option value="image">Custom Image Backdrop</option>
                </select>
              </div>
              {bgType === "color" ? (
                <div>
                  <label className="block text-xs font-semibold text-[#94A3B8] mb-1">
                    Color Hex
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={bgHex}
                      onChange={(e) => setBgHex(e.target.value)}
                      className="w-9 h-9 rounded-lg border border-white/20 bg-transparent cursor-pointer"
                    />
                    <input
                      type="text"
                      value={bgHex}
                      onChange={(e) => setBgHex(e.target.value)}
                      className="flex-1 bg-[#080B12] border border-[#00E5FF]/25 rounded-xl px-3 py-2 text-xs font-mono-nums text-[#F5F7FA]"
                    />
                  </div>
                </div>
              ) : (
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-[#94A3B8] mb-1">
                    Backdrop Image File
                  </label>
                  <label className="flex items-center justify-between gap-2 bg-[#080B12] border border-dashed border-[#00E5FF]/35 rounded-xl px-3 py-2 text-xs text-[#94A3B8] cursor-pointer">
                    <span className="truncate">
                      {bgFile ? bgFile.name : "Upload JPG / PNG / WEBP backdrop..."}
                    </span>
                    <Upload className="w-3.5 h-3.5 text-[#00E5FF]" />
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      onChange={(e) => setBgFile(e.target.files?.[0] || null)}
                      className="hidden"
                    />
                  </label>
                </div>
              )}
            </div>
            <button
              type="submit"
              disabled={busy}
              className="inline-flex items-center gap-2 bg-gradient-to-r from-[#00E5FF] to-[#8B5CF6] text-[#080B12] font-bold text-xs px-5 py-2.5 rounded-xl cursor-pointer disabled:opacity-50"
            >
              <Plus className="w-4 h-4" />
              <span>{busy ? "Saving..." : "Add Background Preset"}</span>
            </button>
          </form>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {backgrounds.map((bg) => (
              <div
                key={bg.id}
                className="bg-[#111827]/90 border border-[#00E5FF]/20 rounded-2xl p-4 space-y-3"
              >
                <div
                  className="h-24 rounded-xl border border-white/15 overflow-hidden flex items-center justify-center"
                  style={{
                    backgroundColor: bg.hex_color || "#080B12",
                  }}
                >
                  {bg.preset_type === "image" && bg.image_url ? (
                    <img
                      src={bg.image_url}
                      alt={bg.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span className="text-[11px] font-mono-nums px-2 py-0.5 rounded bg-black/40 text-white">
                      {bg.hex_color}
                    </span>
                  )}
                </div>

                <div>
                  <h3 className="text-xs font-bold text-[#F5F7FA]">{bg.name}</h3>
                  <p className="text-[11px] text-[#94A3B8]">
                    {bg.is_published ? "Published to Studio" : "Unpublished"}
                  </p>
                </div>

                <div className="flex items-center gap-1.5 pt-2 border-t border-white/10">
                  <button
                    type="button"
                    onClick={async () => {
                      await updateBackground(bg.id, { isPublished: !bg.is_published });
                      await onRefresh();
                    }}
                    className="px-2.5 py-1.5 rounded-lg bg-[#161D2B] text-xs font-semibold text-[#F5F7FA] cursor-pointer"
                  >
                    {bg.is_published ? "Hide" : "Publish"}
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      await deleteBackground(bg.id);
                      await onRefresh();
                    }}
                    className="ml-auto p-1.5 rounded-lg bg-rose-950/60 text-rose-300 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {mode === "portraits" && (
        <>
          <form
            onSubmit={handleCreatePortrait}
            className="bg-[#111827]/85 border border-[#00E5FF]/20 rounded-2xl p-4 sm:p-6 space-y-4"
          >
            <h2 className="text-base font-bold text-[#F5F7FA]">
              Sample Portrait Manager (Load Sample Portrait)
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-[#94A3B8] mb-1">
                  Portrait Title
                </label>
                <input
                  type="text"
                  required
                  value={portraitTitle}
                  onChange={(e) => setPortraitTitle(e.target.value)}
                  placeholder="e.g. Studio Male Portrait"
                  className="w-full bg-[#080B12] border border-[#00E5FF]/25 rounded-xl px-3 py-2 text-xs text-[#F5F7FA]"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#94A3B8] mb-1">
                  Sample Portrait Image
                </label>
                <label className="flex items-center justify-between gap-2 bg-[#080B12] border border-dashed border-[#00E5FF]/35 rounded-xl px-3 py-2 text-xs text-[#94A3B8] cursor-pointer">
                  <span className="truncate">
                    {portraitFile ? portraitFile.name : "Upload JPG / PNG / WEBP..."}
                  </span>
                  <Upload className="w-3.5 h-3.5 text-[#00E5FF]" />
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={(e) => setPortraitFile(e.target.files?.[0] || null)}
                    className="hidden"
                  />
                </label>
              </div>
            </div>
            <button
              type="submit"
              disabled={busy}
              className="inline-flex items-center gap-2 bg-gradient-to-r from-[#00E5FF] to-[#8B5CF6] text-[#080B12] font-bold text-xs px-5 py-2.5 rounded-xl cursor-pointer disabled:opacity-50"
            >
              <Plus className="w-4 h-4" />
              <span>{busy ? "Uploading..." : "Upload Sample Portrait"}</span>
            </button>
          </form>

          {portraits.length === 0 ? (
            <div className="bg-[#111827]/75 border border-[#00E5FF]/15 rounded-2xl p-8 text-center text-xs text-[#94A3B8]">
              No custom sample portraits uploaded yet (public studio uses built-in portrait until you publish custom ones).
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {portraits.map((p) => (
                <div
                  key={p.id}
                  className="bg-[#111827]/90 border border-[#00E5FF]/20 rounded-2xl overflow-hidden flex flex-col"
                >
                  <div className="h-44 bg-[#080B12]">
                    <img
                      src={p.image_url}
                      alt={p.title}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="p-3.5 space-y-2.5">
                    <div>
                      <h3 className="text-xs font-bold text-[#F5F7FA] truncate">
                        {p.title}
                      </h3>
                      <span className="text-[10px] font-mono-nums text-[#00E5FF]">
                        {p.is_published ? "Published" : "Unpublished"}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 pt-2 border-t border-white/10">
                      <button
                        type="button"
                        onClick={async () => {
                          await updatePortrait(p.id, { isPublished: !p.is_published });
                          await onRefresh();
                        }}
                        className="px-2.5 py-1.5 rounded-lg bg-[#161D2B] text-xs font-semibold text-[#F5F7FA] cursor-pointer"
                      >
                        {p.is_published ? "Unpublish" : "Publish"}
                      </button>
                      <button
                        type="button"
                        onClick={async () => {
                          await deletePortrait(p.id);
                          await onRefresh();
                        }}
                        className="ml-auto p-1.5 rounded-lg bg-rose-950/60 text-rose-300 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
