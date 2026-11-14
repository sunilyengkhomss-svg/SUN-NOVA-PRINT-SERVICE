import React, { useEffect, useState } from "react";
import { Check, Copy, ExternalLink, Mail, X } from "lucide-react";
import { BRAND_NAME } from "../types/photo";

interface MailQueryModalProps {
  isOpen: boolean;
  supportEmail: string;
  initialSubject: string;
  initialBody: string;
  onClose: () => void;
}

export function MailQueryModal({
  isOpen,
  supportEmail,
  initialSubject,
  initialBody,
  onClose,
}: MailQueryModalProps) {
  const [customerName, setCustomerName] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [subject, setSubject] = useState(initialSubject);
  const [messageBody, setMessageBody] = useState(initialBody);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setSubject(initialSubject);
    setMessageBody(initialBody);
    setCopied(false);
  }, [isOpen, initialSubject, initialBody]);

  if (!isOpen) return null;

  const fullBody = [
    customerName.trim() ? `From: ${customerName.trim()}` : "",
    customerEmail.trim() ? `Reply Email: ${customerEmail.trim()}` : "",
    "",
    messageBody.trim(),
  ]
    .filter((line, idx) => idx >= 2 || line !== "")
    .join("\n")
    .trim();

  const mailtoHref = `mailto:${encodeURIComponent(
    supportEmail.trim()
  )}?subject=${encodeURIComponent(subject.trim())}&body=${encodeURIComponent(
    fullBody
  )}`;

  const handleCopyDraft = async () => {
    try {
      await navigator.clipboard.writeText(
        `To: ${supportEmail}\nSubject: ${subject}\n\n${fullBody}`
      );
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // Ignore clipboard failure
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Send Query on Mail"
      className="fixed inset-0 z-50 bg-[#080B12]/80 backdrop-blur-md flex items-center justify-center p-4"
    >
      <div className="bg-[#111827]/95 backdrop-blur-xl rounded-[20px] border border-[#00E5FF]/25 max-w-lg w-full overflow-hidden shadow-[0_16px_48px_rgba(0,0,0,0.6)]">
        <div className="px-5 py-4 border-b border-[#00E5FF]/15 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <Mail className="w-4 h-4 text-[#00E5FF]" />
            <div>
              <h3 className="text-sm font-bold text-[#F5F7FA]">
                Send Query on Mail · {BRAND_NAME}
              </h3>
              <p className="text-[11px] text-[#94A3B8]">
                Direct email support &amp; print quotation requests
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close mail modal"
            className="p-1.5 text-[#94A3B8] hover:text-[#F5F7FA] rounded-lg hover:bg-white/5 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-3.5">
          <div className="text-xs bg-[#161D2B] border border-[#00E5FF]/20 rounded-lg px-3 py-2 flex items-center justify-between gap-2">
            <span className="text-[#94A3B8]">To Print Desk:</span>
            <span className="font-mono-nums font-semibold text-[#00E5FF] truncate">
              {supportEmail}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-semibold text-[#94A3B8] mb-1">
                Your Name (Optional)
              </label>
              <input
                type="text"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="e.g. Rahul Sharma"
                className="w-full bg-[#080B12] border border-[#00E5FF]/20 rounded-lg px-3 py-2 text-xs text-[#F5F7FA] placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-[#00E5FF]"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-[#94A3B8] mb-1">
                Your Reply Email (Optional)
              </label>
              <input
                type="email"
                value={customerEmail}
                onChange={(e) => setCustomerEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full bg-[#080B12] border border-[#00E5FF]/20 rounded-lg px-3 py-2 text-xs text-[#F5F7FA] placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-[#00E5FF]"
              />
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-[#94A3B8] mb-1">
              Subject
            </label>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="w-full bg-[#080B12] border border-[#00E5FF]/20 rounded-lg px-3 py-2 text-xs font-medium text-[#F5F7FA] focus:outline-none focus:ring-2 focus:ring-[#00E5FF]"
            />
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-[#94A3B8] mb-1">
              Query / Print Details
            </label>
            <textarea
              rows={5}
              value={messageBody}
              onChange={(e) => setMessageBody(e.target.value)}
              className="w-full bg-[#080B12] border border-[#00E5FF]/20 rounded-lg px-3 py-2 text-xs text-[#F5F7FA] focus:outline-none focus:ring-2 focus:ring-[#00E5FF]"
            />
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-[#00E5FF]/15">
            <button
              type="button"
              onClick={handleCopyDraft}
              className="inline-flex items-center gap-1.5 border border-[#00E5FF]/25 bg-[#161D2B] hover:bg-[#1E273B] text-[#F5F7FA] text-xs font-semibold px-3.5 py-2 rounded-lg cursor-pointer transition-colors"
            >
              {copied ? (
                <Check className="w-3.5 h-3.5 text-emerald-400" />
              ) : (
                <Copy className="w-3.5 h-3.5 text-[#00E5FF]" />
              )}
              <span>{copied ? "Copied Email Draft" : "Copy Email & Query"}</span>
            </button>

            <a
              href={mailtoHref}
              onClick={() => setTimeout(onClose, 300)}
              className="inline-flex items-center gap-1.5 bg-gradient-to-r from-[#00E5FF] to-[#8B5CF6] text-[#080B12] text-xs font-bold px-4 py-2 rounded-lg hover:brightness-110 transition-all"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>Open Mail App</span>
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
