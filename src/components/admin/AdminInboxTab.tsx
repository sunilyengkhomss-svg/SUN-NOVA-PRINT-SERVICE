import React, { useMemo, useState } from "react";
import {
  CheckCircle2,
  ExternalLink,
  Mail,
  MailOpen,
  Paperclip,
  Search,
  Send,
  Trash2,
} from "lucide-react";
import {
  ContactMessageRecord,
  QuoteRequestRecord,
  QuoteStatus,
} from "../../types/cms";
import {
  deleteContactMessage,
  deleteQuoteRequest,
  replyToContactMessage,
  updateContactMessage,
  updateQuoteRequest,
} from "../../utils/adminApi";

interface AdminInboxTabProps {
  mode: "quotes" | "messages";
  quotes: QuoteRequestRecord[];
  messages: ContactMessageRecord[];
  emailProviderConfigured: boolean;
  onRefresh: () => Promise<void>;
}

const QUOTE_STATUSES: QuoteStatus[] = [
  "New",
  "Pending",
  "Contacted",
  "Quoted",
  "Completed",
  "Cancelled",
];

export function AdminInboxTab({
  mode,
  quotes,
  messages,
  emailProviderConfigured,
  onRefresh,
}: AdminInboxTabProps) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("All");
  const [selectedQuote, setSelectedQuote] = useState<QuoteRequestRecord | null>(null);
  const [quoteNotes, setQuoteNotes] = useState("");
  const [quoteStatus, setQuoteStatus] = useState<QuoteStatus>("New");

  const [selectedMsg, setSelectedMsg] = useState<ContactMessageRecord | null>(null);
  const [replyText, setReplyText] = useState("");
  const [replyStatus, setReplyStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const filteredQuotes = useMemo(() => {
    const q = search.trim().toLowerCase();
    return quotes.filter((item) => {
      if (statusFilter !== "All" && item.status !== statusFilter) return false;
      if (
        q &&
        !item.customer_name.toLowerCase().includes(q) &&
        !item.customer_email.toLowerCase().includes(q) &&
        !item.service_type.toLowerCase().includes(q)
      ) {
        return false;
      }
      return true;
    });
  }, [quotes, search, statusFilter]);

  const filteredMessages = useMemo(() => {
    const q = search.trim().toLowerCase();
    return messages.filter((m) => {
      if (statusFilter === "Unread" && m.is_read) return false;
      if (
        q &&
        !m.customer_name.toLowerCase().includes(q) &&
        !m.customer_email.toLowerCase().includes(q) &&
        !m.subject.toLowerCase().includes(q) &&
        !m.message.toLowerCase().includes(q)
      ) {
        return false;
      }
      return true;
    });
  }, [messages, search, statusFilter]);

  const handleSaveQuoteUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedQuote) return;
    setBusy(true);
    try {
      const res = await updateQuoteRequest(selectedQuote.id, {
        status: quoteStatus,
        internalNotes: quoteNotes,
      });
      setSelectedQuote(res.quote);
      await onRefresh();
    } finally {
      setBusy(false);
    }
  };

  const handleSendReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMsg || !replyText.trim()) return;
    setBusy(true);
    setReplyStatus(null);
    try {
      const res = await replyToContactMessage(selectedMsg.id, {
        subject: `Re: ${selectedMsg.subject}`,
        replyText: replyText.trim(),
      });
      setReplyStatus(res.message);
      await onRefresh();
    } catch (err) {
      setReplyStatus(err instanceof Error ? err.message : "Failed to send reply.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* Search & Filter Toolbar */}
      <div className="flex flex-col sm:flex-row gap-3 bg-[#111827]/85 border border-[#00E5FF]/20 rounded-2xl p-3.5">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-[#94A3B8] absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={
              mode === "quotes"
                ? "Search customer name, email, or service..."
                : "Search messages by customer, email, or subject..."
            }
            className="w-full bg-[#080B12] border border-[#00E5FF]/20 rounded-xl pl-9 pr-3 py-2 text-xs text-[#F5F7FA]"
          />
        </div>

        {mode === "quotes" ? (
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-[#080B12] border border-[#00E5FF]/20 rounded-xl px-3 py-2 text-xs text-[#F5F7FA]"
          >
            <option value="All">Status: All</option>
            {QUOTE_STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        ) : (
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-[#080B12] border border-[#00E5FF]/20 rounded-xl px-3 py-2 text-xs text-[#F5F7FA]"
          >
            <option value="All">Filter: All Messages</option>
            <option value="Unread">Unread Only</option>
          </select>
        )}
      </div>

      {mode === "quotes" ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
          <div className="lg:col-span-7 space-y-3">
            {filteredQuotes.length === 0 ? (
              <div className="bg-[#111827]/80 border border-[#00E5FF]/15 rounded-2xl p-8 text-center text-xs text-[#94A3B8]">
                No quotation requests found.
              </div>
            ) : (
              filteredQuotes.map((q) => (
                <div
                  key={q.id}
                  onClick={() => {
                    setSelectedQuote(q);
                    setQuoteNotes(q.internal_notes || "");
                    setQuoteStatus(q.status);
                  }}
                  className={`p-4 rounded-2xl border cursor-pointer transition-all space-y-1.5 ${
                    selectedQuote?.id === q.id
                      ? "bg-[#161D2B] border-[#00E5FF]"
                      : "bg-[#111827]/85 border-[#00E5FF]/15 hover:border-[#00E5FF]/40"
                  }`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-sm font-bold text-[#F5F7FA]">
                      {q.customer_name}
                    </span>
                    <span className="px-2 py-0.5 rounded-md text-[10px] font-mono-nums bg-[#080B12] border border-[#00E5FF]/30 text-[#00E5FF]">
                      {q.status}
                    </span>
                  </div>
                  <p className="text-xs text-[#94A3B8] font-mono-nums">
                    {q.customer_email}
                    {q.phone_number ? ` · ${q.phone_number}` : ""}
                  </p>
                  <p className="text-xs text-[#E2E8F0]">
                    {q.service_type} · Qty {q.quantity} · {q.paper_size}
                  </p>
                  {q.attachment_name && (
                    <span className="inline-flex items-center gap-1 text-[11px] text-amber-300">
                      <Paperclip className="w-3 h-3" />
                      {q.attachment_name} (Private R2)
                    </span>
                  )}
                </div>
              ))
            )}
          </div>

          <div className="lg:col-span-5 bg-[#111827]/90 border border-[#00E5FF]/20 rounded-2xl p-5">
            {!selectedQuote ? (
              <p className="text-xs text-[#94A3B8]">
                Select a quote request on the left to inspect specifications, download private customer attachments, and update status.
              </p>
            ) : (
              <form onSubmit={handleSaveQuoteUpdate} className="space-y-4">
                <div className="flex items-start justify-between gap-2 pb-3 border-b border-white/10">
                  <div>
                    <h3 className="text-sm font-bold text-[#F5F7FA]">
                      {selectedQuote.customer_name}
                    </h3>
                    <p className="text-xs font-mono-nums text-[#00E5FF]">
                      {selectedQuote.customer_email}
                    </p>
                    {selectedQuote.phone_number && (
                      <p className="text-xs text-[#94A3B8]">
                        Phone: {selectedQuote.phone_number}
                      </p>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={async () => {
                      await deleteQuoteRequest(selectedQuote.id);
                      setSelectedQuote(null);
                      await onRefresh();
                    }}
                    className="p-1.5 rounded-lg bg-rose-950/60 text-rose-300 cursor-pointer"
                    title="Delete Quote"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>

                <dl className="text-xs space-y-1.5">
                  <div className="flex justify-between gap-2">
                    <dt className="text-[#94A3B8]">Service</dt>
                    <dd className="text-[#F5F7FA] font-semibold">
                      {selectedQuote.service_type}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-2">
                    <dt className="text-[#94A3B8]">Paper / Size</dt>
                    <dd className="text-[#F5F7FA]">{selectedQuote.paper_size}</dd>
                  </div>
                  <div className="flex justify-between gap-2">
                    <dt className="text-[#94A3B8]">Quantity</dt>
                    <dd className="text-[#F5F7FA] font-mono-nums">
                      {selectedQuote.quantity}
                    </dd>
                  </div>
                  {selectedQuote.description && (
                    <div className="pt-2 border-t border-white/10">
                      <dt className="text-[#94A3B8] mb-1">Requirements</dt>
                      <dd className="text-[#E2E8F0] whitespace-pre-wrap bg-[#080B12] p-2.5 rounded-xl">
                        {selectedQuote.description}
                      </dd>
                    </div>
                  )}
                </dl>

                {selectedQuote.attachment_media_id && (
                  <a
                    href={`/api/admin/media/${encodeURIComponent(
                      selectedQuote.attachment_media_id
                    )}/file`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#161D2B] border border-[#00E5FF]/30 text-xs font-semibold text-[#00E5FF]"
                  >
                    <Paperclip className="w-3.5 h-3.5" />
                    <span>Open Private Artwork ({selectedQuote.attachment_name})</span>
                  </a>
                )}

                <div>
                  <label className="block text-xs font-semibold text-[#94A3B8] mb-1">
                    Pipeline Status
                  </label>
                  <select
                    value={quoteStatus}
                    onChange={(e) => setQuoteStatus(e.target.value as QuoteStatus)}
                    className="w-full bg-[#080B12] border border-[#00E5FF]/25 rounded-xl px-3 py-2 text-xs text-[#F5F7FA]"
                  >
                    {QUOTE_STATUSES.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#94A3B8] mb-1">
                    Internal Studio Notes
                  </label>
                  <textarea
                    rows={3}
                    value={quoteNotes}
                    onChange={(e) => setQuoteNotes(e.target.value)}
                    placeholder="Add pricing note, paper stock check, or follow-up log..."
                    className="w-full bg-[#080B12] border border-[#00E5FF]/25 rounded-xl px-3 py-2 text-xs text-[#F5F7FA]"
                  />
                </div>

                <button
                  type="submit"
                  disabled={busy}
                  className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-[#00E5FF] to-[#8B5CF6] text-[#080B12] font-bold text-xs py-2.5 rounded-xl cursor-pointer"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>{busy ? "Saving..." : "Update Quote Request"}</span>
                </button>
              </form>
            )}
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
          <div className="lg:col-span-6 space-y-3">
            {filteredMessages.length === 0 ? (
              <div className="bg-[#111827]/80 border border-[#00E5FF]/15 rounded-2xl p-8 text-center text-xs text-[#94A3B8]">
                No contact messages found.
              </div>
            ) : (
              filteredMessages.map((m) => (
                <div
                  key={m.id}
                  onClick={async () => {
                    setSelectedMsg(m);
                    setReplyText("");
                    setReplyStatus(null);
                    if (!m.is_read) {
                      await updateContactMessage(m.id, { isRead: true });
                      await onRefresh();
                    }
                  }}
                  className={`p-4 rounded-2xl border cursor-pointer transition-all space-y-1 ${
                    selectedMsg?.id === m.id
                      ? "bg-[#161D2B] border-[#00E5FF]"
                      : "bg-[#111827]/85 border-[#00E5FF]/15 hover:border-[#00E5FF]/40"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-bold text-[#F5F7FA] inline-flex items-center gap-1.5">
                      {!m.is_read && (
                        <span className="w-2 h-2 rounded-full bg-[#00E5FF]" />
                      )}
                      {m.customer_name}
                    </span>
                    <span className="text-[10px] font-mono-nums text-[#94A3B8]">
                      {new Date(m.created_at).toLocaleDateString()}
                    </span>
                  </div>
                  <p className="text-xs font-semibold text-[#00E5FF] truncate">
                    {m.subject}
                  </p>
                  <p className="text-xs text-[#94A3B8] line-clamp-2">{m.message}</p>
                </div>
              ))
            )}
          </div>

          <div className="lg:col-span-6 bg-[#111827]/90 border border-[#00E5FF]/20 rounded-2xl p-5">
            {!selectedMsg ? (
              <p className="text-xs text-[#94A3B8]">
                Select a customer message to read full details, mark read/unread, or compose a reply.
              </p>
            ) : (
              <div className="space-y-4">
                <div className="flex flex-wrap items-start justify-between gap-2 pb-3 border-b border-white/10">
                  <div>
                    <h3 className="text-sm font-bold text-[#F5F7FA]">
                      {selectedMsg.subject}
                    </h3>
                    <p className="text-xs font-mono-nums text-[#00E5FF]">
                      From: {selectedMsg.customer_name} &lt;{selectedMsg.customer_email}&gt;
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={async () => {
                        await updateContactMessage(selectedMsg.id, {
                          isRead: !selectedMsg.is_read,
                        });
                        setSelectedMsg({
                          ...selectedMsg,
                          is_read: selectedMsg.is_read ? 0 : 1,
                        });
                        await onRefresh();
                      }}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[#161D2B] text-xs font-semibold text-[#F5F7FA] cursor-pointer"
                    >
                      {selectedMsg.is_read ? (
                        <Mail className="w-3.5 h-3.5 text-amber-300" />
                      ) : (
                        <MailOpen className="w-3.5 h-3.5 text-emerald-400" />
                      )}
                      <span>{selectedMsg.is_read ? "Mark Unread" : "Mark Read"}</span>
                    </button>
                    <button
                      type="button"
                      onClick={async () => {
                        await deleteContactMessage(selectedMsg.id);
                        setSelectedMsg(null);
                        await onRefresh();
                      }}
                      className="p-1.5 rounded-lg bg-rose-950/60 text-rose-300 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                <div className="bg-[#080B12] border border-white/10 rounded-xl p-3.5 text-xs text-[#E2E8F0] whitespace-pre-wrap leading-relaxed">
                  {selectedMsg.message}
                </div>

                {!emailProviderConfigured && (
                  <div className="text-[11px] text-amber-200 bg-amber-950/50 border border-amber-500/35 rounded-xl px-3 py-2">
                    Note: Transactional email API (RESEND_API_KEY) is not configured yet. Submitting below saves your reply draft internally—use{" "}
                    <strong>Open Mail App</strong> to dispatch an actual email.
                  </div>
                )}

                <form onSubmit={handleSendReply} className="space-y-3">
                  <textarea
                    rows={3}
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    placeholder={`Write your reply to ${selectedMsg.customer_email}...`}
                    className="w-full bg-[#080B12] border border-[#00E5FF]/25 rounded-xl px-3 py-2 text-xs text-[#F5F7FA]"
                  />

                  {replyStatus && (
                    <p className="text-xs text-[#00E5FF]">{replyStatus}</p>
                  )}

                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="submit"
                      disabled={busy}
                      className="inline-flex items-center gap-1.5 bg-gradient-to-r from-[#00E5FF] to-[#8B5CF6] text-[#080B12] font-bold text-xs px-4 py-2 rounded-xl cursor-pointer"
                    >
                      <Send className="w-3.5 h-3.5" />
                      <span>
                        {emailProviderConfigured ? "Send Email Reply" : "Save Reply Draft"}
                      </span>
                    </button>

                    <a
                      href={`mailto:${encodeURIComponent(
                        selectedMsg.customer_email
                      )}?subject=${encodeURIComponent(
                        `Re: ${selectedMsg.subject}`
                      )}&body=${encodeURIComponent(replyText)}`}
                      className="inline-flex items-center gap-1.5 bg-[#161D2B] border border-[#00E5FF]/25 text-xs font-semibold text-[#F5F7FA] px-4 py-2 rounded-xl"
                    >
                      <ExternalLink className="w-3.5 h-3.5 text-[#00E5FF]" />
                      <span>Open Mail App</span>
                    </a>
                  </div>
                </form>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
