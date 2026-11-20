import React, { useEffect, useRef, useState } from "react";
import {
  ArrowUpRight,
  Bot,
  Briefcase,
  CreditCard,
  Download,
  FileText,
  Layers,
  LayoutGrid,
  Mail,
  RotateCcw,
  Ruler,
  Send,
  Shirt,
  Sparkles,
  Wand2,
  X,
} from "lucide-react";
import { BRAND_NAME } from "../types/photo";
import {
  generateStudioAssistantReply,
  STARTER_ASSISTANT_PROMPTS,
  type StudioAssistantAction,
  type StudioAssistantActionId,
  type StudioLiveSnapshot,
} from "../utils/studioAssistantEngine";

interface ChatMessage {
  id: string;
  role: "user" | "model";
  text: string;
  actions?: StudioAssistantAction[];
  followUps?: string[];
}

interface StudioAiAgentProps {
  studioSnapshot: StudioLiveSnapshot;
  onTriggerAction: (action: StudioAssistantAction) => void;
  isOpen: boolean;
  onToggle: (open: boolean) => void;
}

function createWelcomeMessage(): ChatMessage {
  return {
    id: "welcome",
    role: "model",
    text: `Hello! I am the built-in ${BRAND_NAME} Guide — works instantly with zero API key. Ask about AI Photo Enhance (HD/4K upscaling, deblurring, face retouch), 300 PPI photo sizes, Student & Officer outfits, A4 6-photo rows, Aadhaar/PAN Xerox, or your current settings.`,
  };
}

function getActionIcon(id: StudioAssistantActionId) {
  switch (id) {
    case "open_enhance":
      return <Wand2 className="w-3.5 h-3.5 shrink-0" />;
    case "jump_size":
      return <Ruler className="w-3.5 h-3.5 shrink-0" />;
    case "jump_bg_cut":
      return <Layers className="w-3.5 h-3.5 shrink-0" />;
    case "jump_outfit":
      return <Shirt className="w-3.5 h-3.5 shrink-0" />;
    case "jump_info":
    case "jump_export":
      return <Download className="w-3.5 h-3.5 shrink-0" />;
    case "open_sheet_preview":
      return <LayoutGrid className="w-3.5 h-3.5 shrink-0" />;
    case "open_xerox":
      return <CreditCard className="w-3.5 h-3.5 shrink-0" />;
    case "open_converters":
      return <FileText className="w-3.5 h-3.5 shrink-0" />;
    case "open_resume":
      return <Briefcase className="w-3.5 h-3.5 shrink-0" />;
    case "open_mail_desk":
      return <Mail className="w-3.5 h-3.5 shrink-0" />;
    default:
      return <ArrowUpRight className="w-3.5 h-3.5 shrink-0" />;
  }
}

export function StudioAiAgent({
  studioSnapshot,
  onTriggerAction,
  isOpen,
  onToggle,
}: StudioAiAgentProps) {
  const [messages, setMessages] = useState<ChatMessage[]>(() => [
    createWelcomeMessage(),
  ]);
  const [input, setInput] = useState("");
  const endRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (isOpen) {
      endRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isOpen]);

  const sendMessage = (questionText: string) => {
    const trimmed = questionText.trim();
    if (!trimmed) return;

    const now = Date.now();
    const userTurn: ChatMessage = {
      id: `u-${now}`,
      role: "user",
      text: trimmed,
    };

    const reply = generateStudioAssistantReply(trimmed, studioSnapshot);
    const assistantTurn: ChatMessage = {
      id: `m-${now + 1}`,
      role: "model",
      text: reply.text,
      actions: reply.actions,
      followUps: reply.followUps,
    };

    setMessages((prev) => [...prev, userTurn, assistantTurn]);
    setInput("");
  };

  const handleReset = () => {
    setMessages([createWelcomeMessage()]);
    setInput("");
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage(input);
  };

  const liveSummaryLine = `${
    studioSnapshot.workspaceMode === "passport"
      ? `${studioSnapshot.presetLabel} · ${studioSnapshot.paperLabel} (${studioSnapshot.sheetCount})`
      : studioSnapshot.workspaceMode === "enhance"
        ? "AI Photo Enhance Studio"
        : studioSnapshot.workspaceMode === "xerox"
          ? "Aadhaar / PAN / ID Xerox"
          : studioSnapshot.workspaceMode === "converters"
            ? "PDF, XML & Text Converters"
            : "Resume Maker"
  }`;

  return (
    <>
      {!isOpen && (
        <button
          type="button"
          onClick={() => onToggle(true)}
          aria-label="Open Studio Guide"
          title="Studio Guide (Built-In · No API Key)"
          className="fixed bottom-4 right-4 z-40 inline-flex items-center justify-center gap-2 bg-[#111827]/92 backdrop-blur-xl hover:bg-[#161D2B] text-[#F5F7FA] text-xs font-semibold w-11 h-11 sm:w-auto sm:h-auto sm:px-3.5 sm:py-2.5 rounded-full shadow-[0_8px_32px_rgba(0,0,0,0.55),0_0_20px_rgba(0,229,255,0.22)] border border-[#00E5FF]/35 transition-transform hover:scale-[1.03] cursor-pointer"
        >
          <Sparkles className="w-4 h-4 text-[#00E5FF] shrink-0" />
          <span className="hidden sm:inline">Studio Guide</span>
        </button>
      )}

      {isOpen && (
        <aside
          aria-label="SUN-NOVA Studio Guide"
          className="fixed bottom-4 right-4 z-50 w-[calc(100vw-2rem)] sm:w-[400px] h-[540px] max-h-[84vh] bg-[#111827]/95 backdrop-blur-xl rounded-[20px] border border-[#00E5FF]/30 shadow-[0_16px_48px_rgba(0,0,0,0.65)] flex flex-col overflow-hidden"
        >
          {/* Header */}
          <div className="px-4 py-3 bg-[#080B12]/90 border-b border-[#00E5FF]/20 text-[#F5F7FA] flex items-center justify-between gap-2 shrink-0">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-7 h-7 rounded-lg bg-[#00E5FF]/12 border border-[#00E5FF]/30 flex items-center justify-center shrink-0">
                <Bot className="w-4 h-4 text-[#00E5FF]" />
              </div>
              <div className="min-w-0">
                <h3 className="text-xs font-bold truncate">
                  {BRAND_NAME} · Studio Guide
                </h3>
                <p className="text-[11px] text-[#94A3B8] truncate">
                  Built-In App Assistant · No API Key Needed
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              {messages.length > 1 && (
                <button
                  type="button"
                  onClick={handleReset}
                  aria-label="Reset conversation"
                  title="Reset chat"
                  className="p-1.5 text-[#94A3B8] hover:text-[#00E5FF] hover:bg-white/5 rounded-lg transition-colors cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                </button>
              )}
              <button
                type="button"
                onClick={() => onToggle(false)}
                aria-label="Close Studio Guide"
                className="p-1.5 text-[#94A3B8] hover:text-[#F5F7FA] hover:bg-white/5 rounded-lg transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Live Studio Context Bar */}
          <div className="px-3.5 py-1.5 bg-[#0B101B] border-b border-[#00E5FF]/12 flex items-center justify-between gap-2 text-[11px] shrink-0">
            <span className="text-[#94A3B8] truncate font-mono-nums">
              Active: <span className="text-[#E2E8F0]">{liveSummaryLine}</span>
            </span>
            <button
              type="button"
              onClick={() => sendMessage("Check my current studio settings")}
              className="text-[#00E5FF] hover:underline font-semibold shrink-0 cursor-pointer"
            >
              Inspect
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto overscroll-contain p-3.5 space-y-3 bg-[#080B12]/60">
            {messages.map((msg, idx) => {
              const isLatestAssistant =
                msg.role === "model" && idx === messages.length - 1;

              return (
                <div
                  key={msg.id}
                  className={`flex flex-col ${
                    msg.role === "user" ? "items-end" : "items-start"
                  }`}
                >
                  <div
                    className={`max-w-[90%] rounded-xl px-3 py-2.5 text-xs leading-relaxed whitespace-pre-wrap ${
                      msg.role === "user"
                        ? "bg-gradient-to-r from-[#00E5FF] to-[#8B5CF6] text-[#080B12] font-semibold"
                        : "bg-[#161D2B] border border-[#00E5FF]/20 text-[#F5F7FA]"
                    }`}
                  >
                    {msg.text}
                  </div>

                  {/* One-Tap Action Shortcuts */}
                  {msg.role === "model" &&
                    msg.actions &&
                    msg.actions.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1.5 max-w-[92%]">
                        {msg.actions.map((action) => {
                          const isMail = action.id === "open_mail_desk";
                          return (
                            <button
                              key={`${msg.id}-${action.id}-${action.label}`}
                              type="button"
                              onClick={() => onTriggerAction(action)}
                              className={`inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1.5 rounded-lg border transition-colors cursor-pointer ${
                                isMail
                                  ? "bg-[#8B5CF6]/18 border-[#8B5CF6]/45 text-[#E9D5FF] hover:bg-[#8B5CF6]/30"
                                  : "bg-[#00E5FF]/12 border-[#00E5FF]/35 text-[#00E5FF] hover:bg-[#00E5FF]/22"
                              }`}
                            >
                              {getActionIcon(action.id)}
                              <span>{action.label}</span>
                            </button>
                          );
                        })}
                      </div>
                    )}

                  {/* Contextual Follow-Up Questions on Latest Reply */}
                  {isLatestAssistant &&
                    msg.followUps &&
                    msg.followUps.length > 0 && (
                      <div className="mt-2.5 space-y-1 max-w-[95%]">
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-[#64748B]">
                          Related questions
                        </p>
                        <div className="flex flex-wrap gap-1.5">
                          {msg.followUps.map((q) => (
                            <button
                              key={q}
                              type="button"
                              onClick={() => sendMessage(q)}
                              className="text-left text-[11px] font-medium text-[#CBD5E1] bg-[#111827] hover:border-[#00E5FF]/50 hover:text-[#00E5FF] border border-white/10 rounded-lg px-2.5 py-1 transition-colors cursor-pointer"
                            >
                              {q}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                </div>
              );
            })}

            {messages.length <= 1 && (
              <div className="pt-1 space-y-1.5">
                <p className="text-[11px] font-semibold text-[#94A3B8]">
                  Quick questions:
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {STARTER_ASSISTANT_PROMPTS.map((q) => (
                    <button
                      key={q}
                      type="button"
                      onClick={() => sendMessage(q)}
                      className="text-left text-[11px] font-medium text-[#E2E8F0] bg-[#161D2B] hover:border-[#00E5FF]/50 hover:text-[#00E5FF] border border-[#00E5FF]/15 rounded-lg px-2.5 py-1.5 transition-colors cursor-pointer"
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div ref={endRef} />
          </div>

          {/* Input */}
          <form
            onSubmit={handleSubmit}
            className="p-2.5 border-t border-[#00E5FF]/20 bg-[#111827] flex items-center gap-2 shrink-0"
          >
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask about sizes, skin beauty, outfits, Xerox..."
              className="flex-1 text-xs bg-[#080B12] border border-[#00E5FF]/20 rounded-lg px-3 py-2 text-[#F5F7FA] placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-[#00E5FF]"
            />
            <button
              type="submit"
              disabled={!input.trim()}
              aria-label="Send question"
              className="p-2 bg-gradient-to-r from-[#00E5FF] to-[#8B5CF6] disabled:opacity-40 text-[#080B12] rounded-lg transition-all cursor-pointer"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        </aside>
      )}
    </>
  );
}
