import React, { useEffect, useRef, useState } from "react";
import { Bot, Loader2, Send, Sparkles, X } from "lucide-react";
import { BRAND_NAME } from "../types/photo";

interface ChatMessage {
  id: string;
  role: "user" | "model";
  text: string;
}

interface StudioAiAgentProps {
  studioContext: string;
  isOpen: boolean;
  onToggle: (open: boolean) => void;
}

const STARTER_PROMPTS = [
  "Which size fits Passport Seva or SSC forms?",
  "How to put 6 different photos in 1 A4 row?",
  "How to align Student or Officer outfits?",
  "How to make Aadhaar Front & Back Up-Down Xerox?",
];

export function StudioAiAgent({
  studioContext,
  isOpen,
  onToggle,
}: StudioAiAgentProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "welcome",
      role: "model",
      text: `Hello! I am the ${BRAND_NAME} assistant. Ask me about 300 PPI photo sizes, Student & Officer dress fitting, outline cuts, or Aadhaar/PAN A4 Xerox layouts.`,
    },
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (isOpen) {
      endRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isOpen]);

  const sendMessage = async (questionText: string) => {
    const trimmed = questionText.trim();
    if (!trimmed || isLoading) return;

    const userTurn: ChatMessage = {
      id: `u-${Date.now()}`,
      role: "user",
      text: trimmed,
    };

    const nextHistory = [...messages, userTurn];
    setMessages(nextHistory);
    setInput("");
    setErrorMsg(null);
    setIsLoading(true);

    try {
      const apiMessages = nextHistory
        .filter((m) => m.id !== "welcome")
        .map((m) => ({ role: m.role, text: m.text }));

      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: apiMessages,
          studioContext,
        }),
      });

      const data = (await res.json()) as { reply?: string; error?: string };
      if (!res.ok) {
        throw new Error(data.error || "Could not get a response from AI agent.");
      }

      setMessages((prev) => [
        ...prev,
        {
          id: `m-${Date.now()}`,
          role: "model",
          text:
            data.reply ||
            "I can help you configure your passport photos or ID Xerox sheets.",
        },
      ]);
    } catch (err: unknown) {
      setErrorMsg(
        err instanceof Error ? err.message : "Failed to reach AI assistant."
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    void sendMessage(input);
  };

  return (
    <>
      {!isOpen && (
        <button
          type="button"
          onClick={() => onToggle(true)}
          className="fixed bottom-5 right-5 z-40 inline-flex items-center gap-2 bg-[#111827]/90 backdrop-blur-xl hover:bg-[#161D2B] text-[#F5F7FA] text-xs sm:text-sm font-semibold px-4 py-3 rounded-full shadow-[0_8px_32px_rgba(0,0,0,0.5),0_0_20px_rgba(0,229,255,0.2)] border border-[#00E5FF]/35 transition-transform hover:scale-[1.02] cursor-pointer"
        >
          <Sparkles className="w-4 h-4 text-[#00E5FF] shrink-0" />
          <span>Ask AI Agent</span>
        </button>
      )}

      {isOpen && (
        <aside
          aria-label="Ask AI Agent"
          className="fixed bottom-4 right-4 z-50 w-[calc(100vw-2rem)] sm:w-[390px] h-[520px] max-h-[82vh] bg-[#111827]/95 backdrop-blur-xl rounded-[20px] border border-[#00E5FF]/30 shadow-[0_16px_48px_rgba(0,0,0,0.65)] flex flex-col overflow-hidden"
        >
          {/* Header */}
          <div className="px-4 py-3 bg-[#080B12]/90 border-b border-[#00E5FF]/20 text-[#F5F7FA] flex items-center justify-between gap-3 shrink-0">
            <div className="flex items-center gap-2 min-w-0">
              <Bot className="w-4 h-4 text-[#00E5FF] shrink-0" />
              <div className="min-w-0">
                <h3 className="text-xs font-bold truncate">
                  {BRAND_NAME} · AI Assistant
                </h3>
                <p className="text-[11px] text-[#94A3B8] truncate">
                  Photo Sizes, Outfits &amp; Print Help
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => onToggle(false)}
              aria-label="Close AI assistant"
              className="p-1 text-[#94A3B8] hover:text-[#F5F7FA] rounded cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-3.5 space-y-3 bg-[#080B12]/60">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex ${
                  msg.role === "user" ? "justify-end" : "justify-start"
                }`}
              >
                <div
                  className={`max-w-[85%] rounded-xl px-3 py-2 text-xs leading-relaxed whitespace-pre-wrap ${
                    msg.role === "user"
                      ? "bg-gradient-to-r from-[#00E5FF] to-[#8B5CF6] text-[#080B12] font-semibold"
                      : "bg-[#161D2B] border border-[#00E5FF]/20 text-[#F5F7FA]"
                  }`}
                >
                  {msg.text}
                </div>
              </div>
            ))}

            {messages.length <= 1 && (
              <div className="pt-1 space-y-1.5">
                <p className="text-[11px] font-semibold text-[#94A3B8]">
                  Quick questions:
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {STARTER_PROMPTS.map((q) => (
                    <button
                      key={q}
                      type="button"
                      onClick={() => void sendMessage(q)}
                      className="text-left text-[11px] font-medium text-[#E2E8F0] bg-[#161D2B] hover:border-[#00E5FF]/50 hover:text-[#00E5FF] border border-[#00E5FF]/15 rounded-lg px-2.5 py-1.5 transition-colors cursor-pointer"
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {isLoading && (
              <div className="flex justify-start">
                <div className="inline-flex items-center gap-2 bg-[#161D2B] border border-[#00E5FF]/20 text-[#94A3B8] rounded-lg px-3 py-2 text-xs">
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-[#00E5FF]" />
                  <span>Thinking...</span>
                </div>
              </div>
            )}

            {errorMsg && (
              <div className="text-xs text-rose-300 bg-rose-950/60 border border-rose-500/35 rounded-lg px-3 py-2">
                {errorMsg}
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
              placeholder="Ask about sizes, outfits, Xerox..."
              className="flex-1 text-xs bg-[#080B12] border border-[#00E5FF]/20 rounded-lg px-3 py-2 text-[#F5F7FA] placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-[#00E5FF]"
            />
            <button
              type="submit"
              disabled={!input.trim() || isLoading}
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
