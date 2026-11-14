import React, { useCallback, useEffect, useRef, useState } from "react";
import { PDFDocument } from "pdf-lib";
import {
  ArrowDown,
  ArrowUp,
  Briefcase,
  Calculator,
  Camera,
  Compass,
  Download,
  Eye,
  EyeOff,
  FileDown,
  FileText,
  FolderOpen,
  Gamepad2,
  GraduationCap,
  HeartPulse,
  Image as ImageIcon,
  Laptop,
  Layers,
  Loader2,
  Palette,
  Plus,
  Redo2,
  RotateCcw,
  Save,
  Scale,
  Sliders,
  Sparkles,
  Trash2,
  TrendingUp,
  Trophy,
  Undo2,
  Upload,
  User,
  Utensils,
  Video,
} from "lucide-react";
import { PRINT_PPI } from "../types/photo";
import {
  PROFESSION_PRESETS,
  RESUME_ACCENT_PRESETS,
  RESUME_PHOTO_SHAPES,
  RESUME_TEMPLATES,
  ResumeCertificationItem,
  ResumeData,
  ResumeEducationItem,
  ResumeExperienceItem,
  ResumeFontFamily,
  ResumePaperSize,
  ResumePhotoBorderStyle,
  ResumePhotoShape,
  ResumeProfessionId,
  ResumeProjectItem,
  ResumeSectionKey,
  ResumeTemplateId,
  createResumePreset,
  normalizeResumeData,
} from "../types/resume";
import { setJpegPpi, triggerBlobDownload } from "../utils/imageProcessing";
import { renderResumeCanvases } from "../utils/resumeRenderer";
import { useUndoRedo } from "../utils/useUndoRedo";
import { CameraCaptureModal } from "./CameraCaptureModal";

type EditorTab = "content" | "design" | "sections";

export function ResumeMakerStudio() {
  const {
    state: resume,
    setState: setResume,
    undo,
    redo,
    reset: resetResumeHistory,
    canUndo,
    canRedo,
    undoCount,
    redoCount,
  } = useUndoRedo<ResumeData>(() => createResumePreset("business"), 60);

  const [editorTab, setEditorTab] = useState<EditorTab>("content");
  const [skillInput, setSkillInput] = useState("");
  const [previewUrls, setPreviewUrls] = useState<string[]>([]);
  const [activePreviewPage, setActivePreviewPage] = useState(0);
  const [isRenderingPreview, setIsRenderingPreview] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [aiLoadingTarget, setAiLoadingTarget] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isCameraOpen, setIsCameraOpen] = useState(false);

  const loadJsonInputRef = useRef<HTMLInputElement | null>(null);

  // Keyboard shortcuts for Undo / Redo when not editing inside an input/textarea
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const isTextControl =
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT" ||
          target.isContentEditable);
      if (isTextControl) return;

      const isMod = e.metaKey || e.ctrlKey;
      if (!isMod) return;

      if (e.key.toLowerCase() === "z" && !e.shiftKey) {
        if (canUndo) {
          e.preventDefault();
          undo();
        }
      } else if (
        e.key.toLowerCase() === "y" ||
        (e.key.toLowerCase() === "z" && e.shiftKey)
      ) {
        if (canRedo) {
          e.preventDefault();
          redo();
        }
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [canUndo, canRedo, undo, redo]);

  // Live Multi-Page Preview Rendering
  useEffect(() => {
    let cancelled = false;
    setIsRenderingPreview(true);
    const timer = setTimeout(async () => {
      try {
        const canvases = await renderResumeCanvases(resume, { scale: 0.45 });
        if (cancelled) return;
        const urls = canvases.map((c) => c.toDataURL("image/png"));
        setPreviewUrls(urls);
        setActivePreviewPage((prev) =>
          prev >= urls.length ? Math.max(0, urls.length - 1) : prev
        );
      } catch {
        // Ignore transient render errors
      } finally {
        if (!cancelled) setIsRenderingPreview(false);
      }
    }, 120);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [resume]);

  const updateField = useCallback(
    <K extends keyof ResumeData>(
      key: K,
      value: ResumeData[K],
      coalesceKey?: string
    ) => {
      setResume(
        (prev) => ({ ...prev, [key]: value }),
        coalesceKey ? { coalesceKey } : undefined
      );
    },
    [setResume]
  );

  const handleSelectProfession = (profId: ResumeProfessionId) => {
    const preset = createResumePreset(profId);
    // Preserve user's uploaded photo if they already added one
    const nextData: ResumeData = {
      ...preset,
      photoUrl: resume.photoUrl,
    };
    setResume(nextData);
    setStatusMessage(
      `Loaded ${
        PROFESSION_PRESETS.find((p) => p.id === profId)?.label || "Custom"
      } template.`
    );
    setErrorMessage(null);
  };

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !file.type.startsWith("image/")) {
      setErrorMessage("Please select a valid JPG, PNG, or WEBP photo.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        setResume((prev) => ({
          ...prev,
          photoUrl: reader.result as string,
          showPhoto: true,
        }));
        setErrorMessage(null);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleCameraCapture = (blob: Blob) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        setResume((prev) => ({
          ...prev,
          photoUrl: reader.result as string,
          showPhoto: true,
        }));
      }
    };
    reader.readAsDataURL(blob);
  };

  // Experience CRUD
  const addExperience = () => {
    const item: ResumeExperienceItem = {
      id: `exp-${Date.now()}`,
      role: "New Role / Designation",
      organization: "Organization / School / Company",
      location: "City",
      period: "2024 – Present",
      bullets: "• Key responsibility or measurable achievement.",
    };
    setResume((prev) => ({
      ...prev,
      experience: [...prev.experience, item],
    }));
  };

  const updateExperience = (
    id: string,
    patch: Partial<ResumeExperienceItem>,
    coalesceKey?: string
  ) => {
    setResume(
      (prev) => ({
        ...prev,
        experience: prev.experience.map((e) =>
          e.id === id ? { ...e, ...patch } : e
        ),
      }),
      coalesceKey ? { coalesceKey } : undefined
    );
  };

  const moveExperience = (idx: number, dir: -1 | 1) => {
    setResume((prev) => {
      const next = [...prev.experience];
      const target = idx + dir;
      if (target < 0 || target >= next.length) return prev;
      [next[idx], next[target]] = [next[target], next[idx]];
      return { ...prev, experience: next };
    });
  };

  const removeExperience = (id: string) => {
    setResume((prev) => ({
      ...prev,
      experience: prev.experience.filter((e) => e.id !== id),
    }));
  };

  // Education CRUD
  const addEducation = () => {
    const item: ResumeEducationItem = {
      id: `edu-${Date.now()}`,
      degree: "Degree / Qualification",
      institution: "University / Institute Name",
      year: "2020 – 2023",
      grade: "First Class",
    };
    setResume((prev) => ({
      ...prev,
      education: [...prev.education, item],
    }));
  };

  const updateEducation = (
    id: string,
    patch: Partial<ResumeEducationItem>,
    coalesceKey?: string
  ) => {
    setResume(
      (prev) => ({
        ...prev,
        education: prev.education.map((e) =>
          e.id === id ? { ...e, ...patch } : e
        ),
      }),
      coalesceKey ? { coalesceKey } : undefined
    );
  };

  const removeEducation = (id: string) => {
    setResume((prev) => ({
      ...prev,
      education: prev.education.filter((e) => e.id !== id),
    }));
  };

  // Projects CRUD
  const addProject = () => {
    const item: ResumeProjectItem = {
      id: `proj-${Date.now()}`,
      title: "Project / Subject / Initiative",
      subtitle: "Year or Role",
      details: "Describe scope, subjects taught, or outcome achieved.",
    };
    setResume((prev) => ({
      ...prev,
      projects: [...prev.projects, item],
      visibleSections: { ...prev.visibleSections, projects: true },
    }));
  };

  const updateProject = (
    id: string,
    patch: Partial<ResumeProjectItem>,
    coalesceKey?: string
  ) => {
    setResume(
      (prev) => ({
        ...prev,
        projects: prev.projects.map((p) =>
          p.id === id ? { ...p, ...patch } : p
        ),
      }),
      coalesceKey ? { coalesceKey } : undefined
    );
  };

  const removeProject = (id: string) => {
    setResume((prev) => ({
      ...prev,
      projects: prev.projects.filter((p) => p.id !== id),
    }));
  };

  // Certifications CRUD
  const addCertification = () => {
    const item: ResumeCertificationItem = {
      id: `cert-${Date.now()}`,
      title: "Certification / License Title",
      issuer: "Issuing Body",
      year: "2025",
    };
    setResume((prev) => ({
      ...prev,
      certifications: [...prev.certifications, item],
      visibleSections: { ...prev.visibleSections, certifications: true },
    }));
  };

  const updateCertification = (
    id: string,
    patch: Partial<ResumeCertificationItem>,
    coalesceKey?: string
  ) => {
    setResume(
      (prev) => ({
        ...prev,
        certifications: prev.certifications.map((c) =>
          c.id === id ? { ...c, ...patch } : c
        ),
      }),
      coalesceKey ? { coalesceKey } : undefined
    );
  };

  const removeCertification = (id: string) => {
    setResume((prev) => ({
      ...prev,
      certifications: prev.certifications.filter((c) => c.id !== id),
    }));
  };

  // Skills Add / Remove
  const handleAddSkills = () => {
    const parts = skillInput
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    if (parts.length === 0) return;
    setResume((prev) => {
      const existing = new Set(prev.skills.map((s) => s.toLowerCase()));
      const uniqueNew = parts.filter((p) => !existing.has(p.toLowerCase()));
      return {
        ...prev,
        skills: [...prev.skills, ...uniqueNew],
      };
    });
    setSkillInput("");
  };

  const handleRemoveSkill = (idx: number) => {
    setResume((prev) => ({
      ...prev,
      skills: prev.skills.filter((_, i) => i !== idx),
    }));
  };

  // Section Reorder & Visibility
  const moveSection = (idx: number, dir: -1 | 1) => {
    setResume((prev) => {
      const next = [...prev.sectionOrder];
      const target = idx + dir;
      if (target < 0 || target >= next.length) return prev;
      [next[idx], next[target]] = [next[target], next[idx]];
      return { ...prev, sectionOrder: next };
    });
  };

  const toggleSection = (key: ResumeSectionKey) => {
    setResume((prev) => ({
      ...prev,
      visibleSections: {
        ...prev.visibleSections,
        [key]: !prev.visibleSections[key],
      },
    }));
  };

  const updateSectionTitle = (key: ResumeSectionKey, title: string) => {
    setResume(
      (prev) => ({
        ...prev,
        sectionTitles: {
          ...prev.sectionTitles,
          [key]: title,
        },
      }),
      { coalesceKey: `sec-title-${key}` }
    );
  };

  // AI Resume Assist
  const handleAiPolishSummary = async () => {
    try {
      setAiLoadingTarget("summary");
      setErrorMessage(null);
      const res = await fetch("/api/resume-assist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          task: "polish_summary",
          jobTitle: resume.jobTitle,
          currentText: resume.summary,
        }),
      });
      const json = (await res.json()) as { text?: string; error?: string };
      if (!res.ok || !json.text) {
        throw new Error(json.error || "Could not polish summary.");
      }
      setResume((prev) => ({ ...prev, summary: json.text! }));
      setStatusMessage("Polished summary with AI. Use Undo anytime to revert.");
    } catch (err: unknown) {
      setErrorMessage(
        err instanceof Error ? err.message : "AI polish unavailable."
      );
    } finally {
      setAiLoadingTarget(null);
    }
  };

  const handleAiSuggestBullets = async (exp: ResumeExperienceItem) => {
    try {
      setAiLoadingTarget(exp.id);
      setErrorMessage(null);
      const res = await fetch("/api/resume-assist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          task: "suggest_bullets",
          jobTitle: resume.jobTitle,
          role: exp.role,
          organization: exp.organization,
          currentText: exp.bullets,
        }),
      });
      const json = (await res.json()) as { text?: string; error?: string };
      if (!res.ok || !json.text) {
        throw new Error(json.error || "Could not suggest bullets.");
      }
      updateExperience(exp.id, { bullets: json.text! });
      setStatusMessage(
        `Generated bullets for ${exp.role}. Use Undo anytime to revert.`
      );
    } catch (err: unknown) {
      setErrorMessage(
        err instanceof Error ? err.message : "AI suggestion unavailable."
      );
    } finally {
      setAiLoadingTarget(null);
    }
  };

  // Export Handlers (PDF / 300 PPI JPG / PNG / JSON Save-Load)
  const cleanFileSlug =
    (resume.fullName || "resume")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "resume";

  const handleDownloadPdf = async () => {
    try {
      setIsExporting(true);
      setErrorMessage(null);
      setStatusMessage(null);

      // Render at high print clarity (0.75 * 300 PPI = 225 PPI -> 1860x2631 px)
      const canvases = await renderResumeCanvases(resume, { scale: 0.75 });
      const pdfDoc = await PDFDocument.create();

      const pageW = resume.paperSize === "letter" ? 612 : 595.28;
      const pageH = resume.paperSize === "letter" ? 792 : 841.89;

      for (const canvas of canvases) {
        const jpgBlob = await new Promise<Blob>((resolve) =>
          canvas.toBlob((b) => resolve(b!), "image/jpeg", 0.95)
        );
        const jpgBytes = await jpgBlob.arrayBuffer();
        const embedded = await pdfDoc.embedJpg(jpgBytes);
        const page = pdfDoc.addPage([pageW, pageH]);
        page.drawImage(embedded, { x: 0, y: 0, width: pageW, height: pageH });
      }

      const pdfBytes = await pdfDoc.save();
      const blob = new Blob([new Uint8Array(pdfBytes)], {
        type: "application/pdf",
      });
      const filename = `${cleanFileSlug}-resume-${resume.paperSize}.pdf`;
      triggerBlobDownload(blob, filename);
      setStatusMessage(
        `Downloaded ${filename} (${canvases.length} ${
          canvases.length === 1 ? "page" : "pages"
        }).`
      );
    } catch (err: unknown) {
      setErrorMessage(
        err instanceof Error ? err.message : "Failed to generate PDF."
      );
    } finally {
      setIsExporting(false);
    }
  };

  const handleDownloadImage = async (format: "jpeg" | "png") => {
    try {
      setIsExporting(true);
      setErrorMessage(null);
      setStatusMessage(null);

      const canvases = await renderResumeCanvases(resume, { scale: 1 });
      for (let i = 0; i < canvases.length; i++) {
        const canvas = canvases[i];
        const pageSuffix = canvases.length > 1 ? `-page${i + 1}` : "";
        if (format === "png") {
          const blob = await new Promise<Blob>((resolve) =>
            canvas.toBlob((b) => resolve(b!), "image/png")
          );
          triggerBlobDownload(blob, `${cleanFileSlug}-resume${pageSuffix}.png`);
        } else {
          const rawBlob = await new Promise<Blob>((resolve) =>
            canvas.toBlob((b) => resolve(b!), "image/jpeg", 0.96)
          );
          const ppiBlob = await setJpegPpi(rawBlob, PRINT_PPI);
          triggerBlobDownload(
            ppiBlob,
            `${cleanFileSlug}-resume${pageSuffix}-300ppi.jpg`
          );
        }
      }
      setStatusMessage(
        `Downloaded ${canvases.length} ${
          format === "png" ? "PNG" : "300 PPI JPG"
        } ${canvases.length === 1 ? "file" : "files"}.`
      );
    } catch (err: unknown) {
      setErrorMessage(
        err instanceof Error ? err.message : "Failed to export image."
      );
    } finally {
      setIsExporting(false);
    }
  };

  const handleSaveJsonDraft = () => {
    const blob = new Blob([JSON.stringify(resume, null, 2)], {
      type: "application/json",
    });
    triggerBlobDownload(blob, `${cleanFileSlug}-resume-draft.json`);
    setStatusMessage("Saved editable resume draft (.json).");
  };

  const handleLoadJsonDraft = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result)) as Partial<ResumeData>;
        if (!parsed || typeof parsed.fullName !== "string") {
          throw new Error("Invalid resume draft file.");
        }
        setResume(normalizeResumeData(parsed));
        setStatusMessage("Loaded resume draft from JSON.");
        setErrorMessage(null);
      } catch {
        setErrorMessage("Could not read resume draft JSON file.");
      }
    };
    reader.readAsText(file);
  };

  return (
    <section className="space-y-6">
      {/* Top Resume Studio Toolbar: Profession Switcher + Undo/Redo + Exports */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 sm:p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold text-slate-900">
              Professional Resume &amp; CV Maker
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              15 Profession Presets (Game, Sports, Business, Teacher, IT, Design &amp;
              more) · 16 Templates · 18 Colors · 8 Photo Shapes · Live Line Gap Control
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Undo & Redo Controls */}
            <div className="inline-flex items-center gap-1 p-1 bg-slate-100 rounded-lg border border-slate-200">
              <button
                type="button"
                onClick={undo}
                disabled={!canUndo}
                title="Undo (Ctrl+Z)"
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold rounded-md bg-white text-slate-800 hover:bg-slate-50 disabled:bg-transparent disabled:text-slate-400 transition-colors cursor-pointer disabled:cursor-not-allowed whitespace-nowrap"
              >
                <Undo2 className="w-3.5 h-3.5" />
                <span>Undo</span>
                {undoCount > 0 && (
                  <span className="font-mono-nums text-[10px] text-slate-500">
                    ({undoCount})
                  </span>
                )}
              </button>
              <button
                type="button"
                onClick={redo}
                disabled={!canRedo}
                title="Redo (Ctrl+Y)"
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold rounded-md bg-white text-slate-800 hover:bg-slate-50 disabled:bg-transparent disabled:text-slate-400 transition-colors cursor-pointer disabled:cursor-not-allowed whitespace-nowrap"
              >
                <Redo2 className="w-3.5 h-3.5" />
                <span>Redo</span>
                {redoCount > 0 && (
                  <span className="font-mono-nums text-[10px] text-slate-500">
                    ({redoCount})
                  </span>
                )}
              </button>
            </div>

            <button
              type="button"
              onClick={handleSaveJsonDraft}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer whitespace-nowrap"
              title="Save editable resume draft as JSON"
            >
              <Save className="w-3.5 h-3.5" />
              <span>Save Draft</span>
            </button>

            <button
              type="button"
              onClick={() => loadJsonInputRef.current?.click()}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer whitespace-nowrap"
            >
              <FolderOpen className="w-3.5 h-3.5" />
              <span>Load Draft</span>
            </button>
            <input
              ref={loadJsonInputRef}
              type="file"
              accept="application/json,.json"
              onChange={handleLoadJsonDraft}
              className="hidden"
            />

            <button
              type="button"
              onClick={() => {
                resetResumeHistory(createResumePreset(resume.professionId));
                setStatusMessage("Reset current template to clean defaults.");
              }}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 border border-slate-200 rounded-lg transition-colors cursor-pointer whitespace-nowrap"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset</span>
            </button>
          </div>
        </div>

        {/* Profession Preset Selector */}
        <div className="pt-3 border-t border-slate-100">
          <div className="text-[11px] font-semibold text-slate-500 mb-2">
            Profession Presets ({PROFESSION_PRESETS.length} categories — Game, Sports, Business, Teacher &amp; more):
          </div>
          <div className="flex flex-wrap gap-1.5">
            {PROFESSION_PRESETS.map((preset) => {
              const active = resume.professionId === preset.id;
              const IconComp =
                preset.id === "gaming"
                  ? Gamepad2
                  : preset.id === "sports"
                  ? Trophy
                  : preset.id === "teacher"
                  ? GraduationCap
                  : preset.id === "tech"
                  ? Laptop
                  : preset.id === "finance"
                  ? Calculator
                  : preset.id === "healthcare"
                  ? HeartPulse
                  : preset.id === "sales"
                  ? TrendingUp
                  : preset.id === "design"
                  ? Palette
                  : preset.id === "media"
                  ? Video
                  : preset.id === "civil"
                  ? Compass
                  : preset.id === "hospitality"
                  ? Utensils
                  : preset.id === "legal"
                  ? Scale
                  : preset.id === "student"
                  ? User
                  : preset.id === "custom"
                  ? Sparkles
                  : Briefcase;
              return (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => handleSelectProfession(preset.id)}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border transition-colors cursor-pointer whitespace-nowrap ${
                    active
                      ? "bg-slate-900 text-white border-slate-900"
                      : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100"
                  }`}
                >
                  <IconComp className="w-3.5 h-3.5" />
                  <span>{preset.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Main Two-Column Resume Workbench */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left 5 Columns: Structured Resume Editor */}
        <div className="lg:col-span-5 bg-white rounded-xl border border-slate-200 p-4 sm:p-5 space-y-5">
          {/* Editor Sub-Tabs */}
          <div className="grid grid-cols-3 gap-1 p-1 bg-slate-100 rounded-lg">
            <button
              type="button"
              onClick={() => setEditorTab("content")}
              className={`px-2.5 py-2 text-xs font-semibold rounded-md transition-colors cursor-pointer whitespace-nowrap ${
                editorTab === "content"
                  ? "bg-white text-slate-900 shadow-sm"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Details &amp; Content
            </button>
            <button
              type="button"
              onClick={() => setEditorTab("design")}
              className={`px-2.5 py-2 text-xs font-semibold rounded-md transition-colors cursor-pointer whitespace-nowrap ${
                editorTab === "design"
                  ? "bg-white text-slate-900 shadow-sm"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Template &amp; Style
            </button>
            <button
              type="button"
              onClick={() => setEditorTab("sections")}
              className={`px-2.5 py-2 text-xs font-semibold rounded-md transition-colors cursor-pointer whitespace-nowrap ${
                editorTab === "sections"
                  ? "bg-white text-slate-900 shadow-sm"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Sections &amp; Order
            </button>
          </div>

          {editorTab === "design" && (
            <div className="space-y-5 max-h-[820px] overflow-y-auto pr-1">
              {/* Template Picker (16 Distinct Layout Templates) */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold text-slate-700">
                    01. Resume Layout Templates ({RESUME_TEMPLATES.length})
                  </span>
                  <span className="text-[11px] font-mono-nums text-slate-500">
                    {RESUME_TEMPLATES.find((t) => t.id === resume.template)?.label}
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-72 overflow-y-auto pr-0.5">
                  {RESUME_TEMPLATES.map((tpl) => (
                    <button
                      key={tpl.id}
                      type="button"
                      onClick={() =>
                        updateField("template", tpl.id as ResumeTemplateId)
                      }
                      className={`p-2.5 rounded-lg border text-left transition-colors cursor-pointer ${
                        resume.template === tpl.id
                          ? "border-slate-900 bg-slate-50"
                          : "border-slate-200 hover:border-slate-300"
                      }`}
                    >
                      <div className="text-xs font-bold text-slate-900 truncate">
                        {tpl.label}
                      </div>
                      <div className="text-[11px] text-slate-500 mt-0.5 line-clamp-2">
                        {tpl.description}
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Accent Color (18 Color Styles + Custom Color Picker) */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold text-slate-700">
                    02. Colour Styles ({RESUME_ACCENT_PRESETS.length} + Custom)
                  </span>
                  <label className="inline-flex items-center gap-1.5 text-xs text-slate-500 cursor-pointer">
                    <span>Custom:</span>
                    <input
                      type="color"
                      value={resume.accentColor}
                      onChange={(e) =>
                        updateField(
                          "accentColor",
                          e.target.value,
                          "resume-accent"
                        )
                      }
                      className="w-6 h-6 rounded border border-slate-300 cursor-pointer p-0 bg-transparent"
                    />
                  </label>
                </div>
                <div className="grid grid-cols-3 gap-1.5">
                  {RESUME_ACCENT_PRESETS.map((c) => (
                    <button
                      key={c.hex}
                      type="button"
                      onClick={() => updateField("accentColor", c.hex)}
                      className={`flex items-center gap-1.5 p-2 rounded-lg border text-[11px] cursor-pointer ${
                        resume.accentColor.toUpperCase() === c.hex
                          ? "border-slate-900 bg-slate-50 font-semibold"
                          : "border-slate-200 hover:border-slate-300"
                      }`}
                    >
                      <span
                        className="w-3.5 h-3.5 rounded-full shrink-0 border border-slate-300"
                        style={{ backgroundColor: c.hex }}
                      />
                      <span className="truncate">{c.name}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Typography & Paper */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    03. Font Style
                  </label>
                  <select
                    value={resume.fontFamily}
                    onChange={(e) =>
                      updateField(
                        "fontFamily",
                        e.target.value as ResumeFontFamily
                      )
                    }
                    className="w-full border border-slate-300 rounded-lg px-2.5 py-2 text-xs font-medium bg-white"
                  >
                    <option value="sans">Modern Sans (Jakarta)</option>
                    <option value="serif">Academic Serif (Georgia)</option>
                    <option value="classic">Clean Corporate (Segoe)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    04. Paper Size
                  </label>
                  <select
                    value={resume.paperSize}
                    onChange={(e) =>
                      updateField(
                        "paperSize",
                        e.target.value as ResumePaperSize
                      )
                    }
                    className="w-full border border-slate-300 rounded-lg px-2.5 py-2 text-xs font-medium bg-white"
                  >
                    <option value="a4">A4 (210 × 297 mm)</option>
                    <option value="letter">US Letter (8.5 × 11 in)</option>
                  </select>
                </div>
              </div>

              {/* Text Scale & Line Spacing */}
              <div className="space-y-3 pt-2 border-t border-slate-100">
                <div>
                  <div className="flex justify-between text-xs text-slate-600 mb-1">
                    <span className="font-semibold text-slate-700">
                      05. Text Size Scale
                    </span>
                    <span className="font-mono-nums font-semibold">
                      {Math.round(resume.fontScale * 100)}%
                    </span>
                  </div>
                  <input
                    type="range"
                    min={0.86}
                    max={1.12}
                    step={0.02}
                    value={resume.fontScale}
                    onChange={(e) =>
                      updateField(
                        "fontScale",
                        Number(e.target.value),
                        "resume-font-scale"
                      )
                    }
                    className="w-full accent-slate-900 cursor-pointer"
                  />
                </div>

                <div>
                  <div className="flex justify-between text-xs text-slate-600 mb-1">
                    <span className="font-semibold text-slate-700">
                      Line Height Gap
                    </span>
                    <span className="font-mono-nums font-semibold">
                      {(resume.lineGapScale ?? 1).toFixed(2)}×
                    </span>
                  </div>
                  <input
                    type="range"
                    min={0.8}
                    max={1.5}
                    step={0.05}
                    value={resume.lineGapScale ?? 1}
                    onChange={(e) =>
                      updateField(
                        "lineGapScale",
                        Number(e.target.value),
                        "resume-line-gap"
                      )
                    }
                    className="w-full accent-slate-900 cursor-pointer"
                  />
                </div>
              </div>

              {/* Profile Photo & Shape Style Options (8 Shapes + Border Controls) */}
              <div className="pt-3 border-t border-slate-100 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-700">
                    06. Photo Shape &amp; Frame Style
                  </span>
                  <label className="inline-flex items-center gap-1.5 text-xs text-slate-600 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={resume.showPhoto}
                      onChange={(e) =>
                        updateField("showPhoto", e.target.checked)
                      }
                      className="rounded border-slate-300 accent-slate-900"
                    />
                    <span>Show Photo</span>
                  </label>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <label className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg cursor-pointer whitespace-nowrap">
                    <Upload className="w-3.5 h-3.5" />
                    <span>Upload Photo</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handlePhotoUpload}
                      className="hidden"
                    />
                  </label>
                  <button
                    type="button"
                    onClick={() => setIsCameraOpen(true)}
                    className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-lg cursor-pointer whitespace-nowrap"
                  >
                    <Camera className="w-3.5 h-3.5" />
                    <span>Click Photo</span>
                  </button>
                  {resume.photoUrl && (
                    <button
                      type="button"
                      onClick={() => updateField("photoUrl", null)}
                      className="inline-flex items-center gap-1 px-2.5 py-2 text-xs font-medium text-red-600 hover:bg-red-50 rounded-lg cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Remove</span>
                    </button>
                  )}
                </div>

                {/* 8 Photo Shapes Grid */}
                <div>
                  <span className="block text-[11px] font-medium text-slate-500 mb-1.5">
                    Photo Shape Style ({RESUME_PHOTO_SHAPES.length} shapes):
                  </span>
                  <div className="grid grid-cols-4 gap-1.5">
                    {RESUME_PHOTO_SHAPES.map((shape) => {
                      const active = resume.photoShape === shape.id;
                      return (
                        <button
                          key={shape.id}
                          type="button"
                          onClick={() =>
                            updateField("photoShape", shape.id as ResumePhotoShape)
                          }
                          className={`py-1.5 px-1.5 text-[11px] font-semibold rounded-lg border transition-colors cursor-pointer text-center truncate ${
                            active
                              ? "border-slate-900 bg-slate-50 text-slate-900"
                              : "border-slate-200 text-slate-600 hover:border-slate-300"
                          }`}
                        >
                          {shape.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Photo Size & Frame Border Style */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <div className="flex justify-between text-[11px] text-slate-600 mb-0.5">
                      <span>Photo Size</span>
                      <span className="font-mono-nums font-semibold">
                        {Math.round((resume.photoSizeScale ?? 1) * 100)}%
                      </span>
                    </div>
                    <input
                      type="range"
                      min={0.75}
                      max={1.3}
                      step={0.05}
                      value={resume.photoSizeScale ?? 1}
                      onChange={(e) =>
                        updateField(
                          "photoSizeScale",
                          Number(e.target.value),
                          "resume-photo-size"
                        )
                      }
                      className="w-full accent-slate-900 cursor-pointer"
                    />
                  </div>
                  <div>
                    <div className="flex justify-between text-[11px] text-slate-600 mb-0.5">
                      <span>Frame Width</span>
                      <span className="font-mono-nums font-semibold">
                        {resume.photoBorderWidth ?? 5} px
                      </span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={12}
                      step={1}
                      value={resume.photoBorderWidth ?? 5}
                      onChange={(e) =>
                        updateField(
                          "photoBorderWidth",
                          Number(e.target.value),
                          "resume-photo-bw"
                        )
                      }
                      className="w-full accent-slate-900 cursor-pointer"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-4 gap-1 p-1 bg-slate-100 rounded-lg">
                  {(
                    ["solid", "double", "dashed", "none"] as ResumePhotoBorderStyle[]
                  ).map((bStyle) => (
                    <button
                      key={bStyle}
                      type="button"
                      onClick={() => updateField("photoBorderStyle", bStyle)}
                      className={`py-1 text-[11px] font-semibold rounded-md capitalize cursor-pointer ${
                        (resume.photoBorderStyle || "solid") === bStyle
                          ? "bg-white text-slate-900 shadow-sm"
                          : "text-slate-600"
                      }`}
                    >
                      {bStyle}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {editorTab === "sections" && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-xs text-slate-600">
                <Layers className="w-4 h-4 text-slate-500 shrink-0" />
                <span>
                  Reorder sections, toggle visibility, or rename any heading for
                  your profession.
                </span>
              </div>

              <div className="space-y-2">
                {resume.sectionOrder.map((secKey, idx) => {
                  const isVisible = resume.visibleSections[secKey];
                  return (
                    <div
                      key={secKey}
                      className="flex items-center gap-2 p-2.5 rounded-lg border border-slate-200 bg-slate-50/70"
                    >
                      <button
                        type="button"
                        onClick={() => toggleSection(secKey)}
                        className={`p-1.5 rounded-md border cursor-pointer shrink-0 ${
                          isVisible
                            ? "bg-white text-slate-900 border-slate-300"
                            : "bg-slate-100 text-slate-400 border-slate-200"
                        }`}
                        title={isVisible ? "Hide section" : "Show section"}
                      >
                        {isVisible ? (
                          <Eye className="w-3.5 h-3.5" />
                        ) : (
                          <EyeOff className="w-3.5 h-3.5" />
                        )}
                      </button>

                      <input
                        type="text"
                        value={resume.sectionTitles[secKey]}
                        onChange={(e) =>
                          updateSectionTitle(secKey, e.target.value)
                        }
                        className="flex-1 min-w-0 border border-slate-300 bg-white rounded-md px-2.5 py-1.5 text-xs font-semibold text-slate-900"
                      />

                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => moveSection(idx, -1)}
                          disabled={idx === 0}
                          className="p-1.5 rounded border border-slate-200 bg-white text-slate-600 hover:text-slate-900 disabled:opacity-40 cursor-pointer"
                          aria-label="Move section up"
                        >
                          <ArrowUp className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => moveSection(idx, 1)}
                          disabled={idx === resume.sectionOrder.length - 1}
                          className="p-1.5 rounded border border-slate-200 bg-white text-slate-600 hover:text-slate-900 disabled:opacity-40 cursor-pointer"
                          aria-label="Move section down"
                        >
                          <ArrowDown className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {editorTab === "content" && (
            <div className="space-y-6 max-h-[780px] overflow-y-auto pr-1">
              {/* Personal Info */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-900">
                    <User className="w-3.5 h-3.5" />
                    <span>Personal &amp; Header Details</span>
                  </span>
                  <div className="flex items-center gap-1.5">
                    <label className="text-[11px] font-semibold text-slate-700 hover:underline cursor-pointer">
                      {resume.photoUrl ? "Change Photo" : "+ Photo"}
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handlePhotoUpload}
                        className="hidden"
                      />
                    </label>
                    <button
                      type="button"
                      onClick={() => setIsCameraOpen(true)}
                      className="text-[11px] font-semibold text-slate-600 hover:text-slate-900 cursor-pointer"
                    >
                      · Camera
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <input
                    type="text"
                    placeholder="Full Name"
                    value={resume.fullName}
                    onChange={(e) =>
                      updateField("fullName", e.target.value, "res-fullname")
                    }
                    className="border border-slate-300 rounded-lg px-3 py-2 text-xs font-semibold text-slate-900"
                  />
                  <input
                    type="text"
                    placeholder="Job Title / Target Role"
                    value={resume.jobTitle}
                    onChange={(e) =>
                      updateField("jobTitle", e.target.value, "res-jobtitle")
                    }
                    className="border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-900"
                  />
                  <input
                    type="email"
                    placeholder="Email Address"
                    value={resume.email}
                    onChange={(e) =>
                      updateField("email", e.target.value, "res-email")
                    }
                    className="border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-900"
                  />
                  <input
                    type="text"
                    placeholder="Contact Phone (Optional)"
                    value={resume.phone}
                    onChange={(e) =>
                      updateField("phone", e.target.value, "res-phone")
                    }
                    className="border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-900"
                  />
                  <input
                    type="text"
                    placeholder="City, State"
                    value={resume.location}
                    onChange={(e) =>
                      updateField("location", e.target.value, "res-location")
                    }
                    className="border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-900"
                  />
                  <input
                    type="text"
                    placeholder="LinkedIn / Portfolio URL (Optional)"
                    value={resume.website}
                    onChange={(e) =>
                      updateField("website", e.target.value, "res-website")
                    }
                    className="border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-900"
                  />
                </div>
              </div>

              {/* Summary */}
              <div className="space-y-2 pt-4 border-t border-slate-100">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-bold text-slate-900">
                    {resume.sectionTitles.summary}
                  </span>
                  <button
                    type="button"
                    onClick={handleAiPolishSummary}
                    disabled={aiLoadingTarget === "summary"}
                    className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-800 bg-slate-100 hover:bg-slate-200 px-2.5 py-1 rounded-md cursor-pointer disabled:opacity-60"
                  >
                    {aiLoadingTarget === "summary" ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                      <Sparkles className="w-3 h-3" />
                    )}
                    <span>AI Polish Summary</span>
                  </button>
                </div>
                <textarea
                  rows={4}
                  value={resume.summary}
                  onChange={(e) =>
                    updateField("summary", e.target.value, "res-summary")
                  }
                  placeholder="Write a concise career summary..."
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-900 leading-relaxed"
                />
              </div>

              {/* Experience */}
              <div className="space-y-3 pt-4 border-t border-slate-100">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-900">
                    {resume.sectionTitles.experience} ({resume.experience.length}
                    )
                  </span>
                  <button
                    type="button"
                    onClick={addExperience}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 px-2.5 py-1.5 rounded-lg cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Experience</span>
                  </button>
                </div>

                {resume.experience.map((exp, idx) => (
                  <div
                    key={exp.id}
                    className="p-3 rounded-lg border border-slate-200 bg-slate-50/70 space-y-2"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[11px] font-bold text-slate-500 font-mono-nums">
                        #{idx + 1}
                      </span>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => handleAiSuggestBullets(exp)}
                          disabled={aiLoadingTarget === exp.id}
                          className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-100 px-2 py-1 rounded cursor-pointer"
                        >
                          {aiLoadingTarget === exp.id ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : (
                            <Sparkles className="w-3 h-3" />
                          )}
                          <span>AI Bullets</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => moveExperience(idx, -1)}
                          disabled={idx === 0}
                          className="p-1 text-slate-500 hover:text-slate-900 disabled:opacity-40 cursor-pointer"
                          aria-label="Move up"
                        >
                          <ArrowUp className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => moveExperience(idx, 1)}
                          disabled={idx === resume.experience.length - 1}
                          className="p-1 text-slate-500 hover:text-slate-900 disabled:opacity-40 cursor-pointer"
                          aria-label="Move down"
                        >
                          <ArrowDown className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => removeExperience(exp.id)}
                          className="p-1 text-slate-400 hover:text-red-600 cursor-pointer"
                          aria-label="Remove experience"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <input
                        type="text"
                        placeholder="Role / Designation"
                        value={exp.role}
                        onChange={(e) =>
                          updateExperience(
                            exp.id,
                            { role: e.target.value },
                            `exp-role-${exp.id}`
                          )
                        }
                        className="border border-slate-300 bg-white rounded-md px-2.5 py-1.5 text-xs font-semibold"
                      />
                      <input
                        type="text"
                        placeholder="Period (e.g. 2021 – Present)"
                        value={exp.period}
                        onChange={(e) =>
                          updateExperience(
                            exp.id,
                            { period: e.target.value },
                            `exp-period-${exp.id}`
                          )
                        }
                        className="border border-slate-300 bg-white rounded-md px-2.5 py-1.5 text-xs"
                      />
                      <input
                        type="text"
                        placeholder="Company / School / Organization"
                        value={exp.organization}
                        onChange={(e) =>
                          updateExperience(
                            exp.id,
                            { organization: e.target.value },
                            `exp-org-${exp.id}`
                          )
                        }
                        className="border border-slate-300 bg-white rounded-md px-2.5 py-1.5 text-xs"
                      />
                      <input
                        type="text"
                        placeholder="Location"
                        value={exp.location}
                        onChange={(e) =>
                          updateExperience(
                            exp.id,
                            { location: e.target.value },
                            `exp-loc-${exp.id}`
                          )
                        }
                        className="border border-slate-300 bg-white rounded-md px-2.5 py-1.5 text-xs"
                      />
                    </div>
                    <textarea
                      rows={3}
                      placeholder="Key responsibilities & achievements (one bullet per line)"
                      value={exp.bullets}
                      onChange={(e) =>
                        updateExperience(
                          exp.id,
                          { bullets: e.target.value },
                          `exp-bul-${exp.id}`
                        )
                      }
                      className="w-full border border-slate-300 bg-white rounded-md px-2.5 py-1.5 text-xs leading-relaxed"
                    />
                  </div>
                ))}
              </div>

              {/* Education */}
              <div className="space-y-3 pt-4 border-t border-slate-100">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-900">
                    {resume.sectionTitles.education} ({resume.education.length})
                  </span>
                  <button
                    type="button"
                    onClick={addEducation}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-slate-800 bg-slate-100 hover:bg-slate-200 px-2.5 py-1.5 rounded-lg cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Education</span>
                  </button>
                </div>

                {resume.education.map((edu) => (
                  <div
                    key={edu.id}
                    className="p-3 rounded-lg border border-slate-200 bg-slate-50/70 space-y-2"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <input
                        type="text"
                        placeholder="Degree / Diploma / Board"
                        value={edu.degree}
                        onChange={(e) =>
                          updateEducation(
                            edu.id,
                            { degree: e.target.value },
                            `edu-deg-${edu.id}`
                          )
                        }
                        className="flex-1 border border-slate-300 bg-white rounded-md px-2.5 py-1.5 text-xs font-semibold"
                      />
                      <button
                        type="button"
                        onClick={() => removeEducation(edu.id)}
                        className="p-1 text-slate-400 hover:text-red-600 cursor-pointer"
                        aria-label="Remove education"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <input
                        type="text"
                        placeholder="Institution / University"
                        value={edu.institution}
                        onChange={(e) =>
                          updateEducation(
                            edu.id,
                            { institution: e.target.value },
                            `edu-inst-${edu.id}`
                          )
                        }
                        className="col-span-3 sm:col-span-1 border border-slate-300 bg-white rounded-md px-2.5 py-1.5 text-xs"
                      />
                      <input
                        type="text"
                        placeholder="Year"
                        value={edu.year}
                        onChange={(e) =>
                          updateEducation(
                            edu.id,
                            { year: e.target.value },
                            `edu-yr-${edu.id}`
                          )
                        }
                        className="border border-slate-300 bg-white rounded-md px-2.5 py-1.5 text-xs"
                      />
                      <input
                        type="text"
                        placeholder="Grade / %"
                        value={edu.grade}
                        onChange={(e) =>
                          updateEducation(
                            edu.id,
                            { grade: e.target.value },
                            `edu-gr-${edu.id}`
                          )
                        }
                        className="border border-slate-300 bg-white rounded-md px-2.5 py-1.5 text-xs"
                      />
                    </div>
                  </div>
                ))}
              </div>

              {/* Skills */}
              <div className="space-y-2.5 pt-4 border-t border-slate-100">
                <span className="block text-xs font-bold text-slate-900">
                  {resume.sectionTitles.skills}
                </span>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Add skills (comma separated, e.g. Excel, Leadership)"
                    value={skillInput}
                    onChange={(e) => setSkillInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        handleAddSkills();
                      }
                    }}
                    className="flex-1 border border-slate-300 rounded-lg px-3 py-2 text-xs"
                  />
                  <button
                    type="button"
                    onClick={handleAddSkills}
                    className="px-3 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg cursor-pointer shrink-0"
                  >
                    Add
                  </button>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {resume.skills.map((skill, idx) => (
                    <button
                      key={`${skill}-${idx}`}
                      type="button"
                      onClick={() => handleRemoveSkill(idx)}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium bg-slate-100 hover:bg-red-50 hover:text-red-700 text-slate-800 rounded-md border border-slate-200 cursor-pointer"
                      title="Click to remove"
                    >
                      <span>{skill}</span>
                      <span aria-hidden="true">×</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Projects / Subjects Taught */}
              <div className="space-y-2.5 pt-4 border-t border-slate-100">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-900">
                    {resume.sectionTitles.projects} ({resume.projects.length})
                  </span>
                  <button
                    type="button"
                    onClick={addProject}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-slate-800 bg-slate-100 hover:bg-slate-200 px-2.5 py-1.5 rounded-lg cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Item</span>
                  </button>
                </div>
                {resume.projects.map((proj) => (
                  <div
                    key={proj.id}
                    className="p-3 rounded-lg border border-slate-200 bg-slate-50/70 space-y-2"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <input
                        type="text"
                        placeholder="Title"
                        value={proj.title}
                        onChange={(e) =>
                          updateProject(
                            proj.id,
                            { title: e.target.value },
                            `proj-t-${proj.id}`
                          )
                        }
                        className="flex-1 border border-slate-300 bg-white rounded-md px-2.5 py-1.5 text-xs font-semibold"
                      />
                      <button
                        type="button"
                        onClick={() => removeProject(proj.id)}
                        className="p-1 text-slate-400 hover:text-red-600 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <input
                      type="text"
                      placeholder="Subtitle / Grades / Stack"
                      value={proj.subtitle}
                      onChange={(e) =>
                        updateProject(
                          proj.id,
                          { subtitle: e.target.value },
                          `proj-s-${proj.id}`
                        )
                      }
                      className="w-full border border-slate-300 bg-white rounded-md px-2.5 py-1.5 text-xs"
                    />
                    <textarea
                      rows={2}
                      placeholder="Details"
                      value={proj.details}
                      onChange={(e) =>
                        updateProject(
                          proj.id,
                          { details: e.target.value },
                          `proj-d-${proj.id}`
                        )
                      }
                      className="w-full border border-slate-300 bg-white rounded-md px-2.5 py-1.5 text-xs"
                    />
                  </div>
                ))}
              </div>

              {/* Certifications */}
              <div className="space-y-2.5 pt-4 border-t border-slate-100">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-900">
                    {resume.sectionTitles.certifications} (
                    {resume.certifications.length})
                  </span>
                  <button
                    type="button"
                    onClick={addCertification}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-slate-800 bg-slate-100 hover:bg-slate-200 px-2.5 py-1.5 rounded-lg cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Credential</span>
                  </button>
                </div>
                {resume.certifications.map((cert) => (
                  <div
                    key={cert.id}
                    className="p-2.5 rounded-lg border border-slate-200 bg-slate-50/70 space-y-2"
                  >
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        placeholder="Certificate / License Name"
                        value={cert.title}
                        onChange={(e) =>
                          updateCertification(
                            cert.id,
                            { title: e.target.value },
                            `cert-t-${cert.id}`
                          )
                        }
                        className="flex-1 border border-slate-300 bg-white rounded-md px-2.5 py-1.5 text-xs font-semibold"
                      />
                      <button
                        type="button"
                        onClick={() => removeCertification(cert.id)}
                        className="p-1 text-slate-400 hover:text-red-600 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        type="text"
                        placeholder="Issuer (e.g. CBSE / PMI)"
                        value={cert.issuer}
                        onChange={(e) =>
                          updateCertification(
                            cert.id,
                            { issuer: e.target.value },
                            `cert-i-${cert.id}`
                          )
                        }
                        className="border border-slate-300 bg-white rounded-md px-2.5 py-1.5 text-xs"
                      />
                      <input
                        type="text"
                        placeholder="Year"
                        value={cert.year}
                        onChange={(e) =>
                          updateCertification(
                            cert.id,
                            { year: e.target.value },
                            `cert-y-${cert.id}`
                          )
                        }
                        className="border border-slate-300 bg-white rounded-md px-2.5 py-1.5 text-xs"
                      />
                    </div>
                  </div>
                ))}
              </div>

              {/* Languages & Declaration */}
              <div className="space-y-3 pt-4 border-t border-slate-100">
                <div>
                  <label className="block text-xs font-bold text-slate-900 mb-1">
                    {resume.sectionTitles.languages}
                  </label>
                  <input
                    type="text"
                    value={resume.languages}
                    onChange={(e) =>
                      updateField("languages", e.target.value, "res-langs")
                    }
                    placeholder="e.g. English (Fluent), Hindi (Native)"
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs"
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-900">
                      {resume.sectionTitles.declaration}
                    </span>
                    <label className="inline-flex items-center gap-1.5 text-xs text-slate-600 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={resume.visibleSections.declaration}
                        onChange={() => toggleSection("declaration")}
                        className="rounded border-slate-300 accent-slate-900"
                      />
                      <span>Include on Resume</span>
                    </label>
                  </div>
                  <textarea
                    rows={2}
                    value={resume.declarationText}
                    onChange={(e) =>
                      updateField(
                        "declarationText",
                        e.target.value,
                        "res-decl-txt"
                      )
                    }
                    placeholder="I hereby declare..."
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs"
                  />
                  <input
                    type="text"
                    value={resume.declarationPlace}
                    onChange={(e) =>
                      updateField(
                        "declarationPlace",
                        e.target.value,
                        "res-decl-place"
                      )
                    }
                    placeholder="Declaration Place (City)"
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-xs"
                  />
                </div>
              </div>
            </div>
          )}

          {errorMessage && (
            <div
              role="alert"
              className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2"
            >
              {errorMessage}
            </div>
          )}
          {statusMessage && (
            <div className="text-xs text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2 font-mono-nums">
              {statusMessage}
            </div>
          )}
        </div>

        {/* Right 7 Columns: Live Multi-Page Preview & Export Controls */}
        <div className="lg:col-span-7 bg-white rounded-xl border border-slate-200 p-4 sm:p-6 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2 text-xs text-slate-600 font-mono-nums">
              <FileText className="w-4 h-4 text-slate-700" />
              <span className="font-semibold text-slate-900">
                Live {resume.paperSize.toUpperCase()} Preview
              </span>
              <span aria-hidden="true">·</span>
              <span>
                {previewUrls.length || 1}{" "}
                {previewUrls.length === 1 ? "Page" : "Pages"}
              </span>
              {isRenderingPreview && (
                <Loader2 className="w-3.5 h-3.5 animate-spin text-slate-500 ml-1" />
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={handleDownloadPdf}
                disabled={isExporting}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 disabled:bg-slate-400 rounded-lg transition-colors cursor-pointer whitespace-nowrap"
              >
                {isExporting ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <FileDown className="w-3.5 h-3.5" />
                )}
                <span>Download PDF</span>
              </button>

              <button
                type="button"
                onClick={() => handleDownloadImage("jpeg")}
                disabled={isExporting}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-800 bg-slate-100 hover:bg-slate-200 disabled:opacity-50 rounded-lg transition-colors cursor-pointer whitespace-nowrap"
              >
                <Download className="w-3.5 h-3.5" />
                <span>300 PPI JPG</span>
              </button>

              <button
                type="button"
                onClick={() => handleDownloadImage("png")}
                disabled={isExporting}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-800 bg-slate-100 hover:bg-slate-200 disabled:opacity-50 rounded-lg transition-colors cursor-pointer whitespace-nowrap"
              >
                <ImageIcon className="w-3.5 h-3.5" />
                <span>PNG</span>
              </button>
            </div>
          </div>

          {/* Post-Edit Line Gaps & Page Fit Customizer */}
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-3.5 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-900">
                <Sliders className="w-3.5 h-3.5" />
                <span>Customize Finished Resume Line Gaps &amp; Spacing</span>
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                <button
                  type="button"
                  onClick={() =>
                    setResume((prev) => ({
                      ...prev,
                      lineGapScale: 0.85,
                      sectionGapScale: 0.75,
                      itemGapScale: 0.75,
                    }))
                  }
                  className="px-2 py-1 text-[11px] font-semibold rounded border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 cursor-pointer"
                >
                  Tight (1-Page)
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setResume((prev) => ({
                      ...prev,
                      lineGapScale: 1,
                      sectionGapScale: 1,
                      itemGapScale: 1,
                    }))
                  }
                  className="px-2 py-1 text-[11px] font-semibold rounded border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 cursor-pointer"
                >
                  Balanced (1.0×)
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setResume((prev) => ({
                      ...prev,
                      lineGapScale: 1.25,
                      sectionGapScale: 1.3,
                      itemGapScale: 1.25,
                    }))
                  }
                  className="px-2 py-1 text-[11px] font-semibold rounded border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 cursor-pointer"
                >
                  Wide / Airy
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <div className="flex justify-between text-[11px] text-slate-600 mb-0.5">
                  <span>Line Gap</span>
                  <span className="font-mono-nums font-semibold">
                    {(resume.lineGapScale ?? 1).toFixed(2)}×
                  </span>
                </div>
                <input
                  type="range"
                  aria-label="Resume line gap scale"
                  min={0.8}
                  max={1.5}
                  step={0.05}
                  value={resume.lineGapScale ?? 1}
                  onChange={(e) =>
                    updateField(
                      "lineGapScale",
                      Number(e.target.value),
                      "resume-line-gap"
                    )
                  }
                  className="w-full accent-slate-900 cursor-pointer"
                />
              </div>

              <div>
                <div className="flex justify-between text-[11px] text-slate-600 mb-0.5">
                  <span>Section Gap</span>
                  <span className="font-mono-nums font-semibold">
                    {(resume.sectionGapScale ?? 1).toFixed(2)}×
                  </span>
                </div>
                <input
                  type="range"
                  aria-label="Resume section gap scale"
                  min={0.65}
                  max={1.6}
                  step={0.05}
                  value={resume.sectionGapScale ?? 1}
                  onChange={(e) =>
                    updateField(
                      "sectionGapScale",
                      Number(e.target.value),
                      "resume-sec-gap"
                    )
                  }
                  className="w-full accent-slate-900 cursor-pointer"
                />
              </div>

              <div>
                <div className="flex justify-between text-[11px] text-slate-600 mb-0.5">
                  <span>Item / Entry Gap</span>
                  <span className="font-mono-nums font-semibold">
                    {(resume.itemGapScale ?? 1).toFixed(2)}×
                  </span>
                </div>
                <input
                  type="range"
                  aria-label="Resume entry gap scale"
                  min={0.65}
                  max={1.6}
                  step={0.05}
                  value={resume.itemGapScale ?? 1}
                  onChange={(e) =>
                    updateField(
                      "itemGapScale",
                      Number(e.target.value),
                      "resume-item-gap"
                    )
                  }
                  className="w-full accent-slate-900 cursor-pointer"
                />
              </div>
            </div>
          </div>

          {/* Page Switcher if Multi-Page */}
          {previewUrls.length > 1 && (
            <div className="flex items-center justify-center gap-2">
              {previewUrls.map((_, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setActivePreviewPage(idx)}
                  className={`px-3 py-1 text-xs font-semibold rounded-md border cursor-pointer font-mono-nums ${
                    activePreviewPage === idx
                      ? "bg-slate-900 text-white border-slate-900"
                      : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100"
                  }`}
                >
                  Page {idx + 1}
                </button>
              ))}
            </div>
          )}

          {/* Paper Canvas Frame */}
          <div className="bg-slate-100 border border-slate-200 rounded-lg p-3 sm:p-5 flex justify-center overflow-auto">
            {previewUrls[activePreviewPage] ? (
              <img
                src={previewUrls[activePreviewPage]}
                alt={`Resume preview page ${activePreviewPage + 1}`}
                referrerPolicy="no-referrer"
                className="preserve-paper w-full max-w-[640px] h-auto bg-white shadow-md border border-slate-200 rounded-sm"
              />
            ) : (
              <div className="preserve-paper w-full max-w-[640px] aspect-[210/297] bg-white border border-slate-200 flex items-center justify-center text-xs text-slate-400">
                Rendering resume preview...
              </div>
            )}
          </div>
        </div>
      </div>

      <CameraCaptureModal
        isOpen={isCameraOpen}
        onClose={() => setIsCameraOpen(false)}
        onCapture={handleCameraCapture}
      />
    </section>
  );
}
