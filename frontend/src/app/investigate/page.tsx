"use client";

import React, { useState, useEffect, useRef, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  Sparkles,
  Send,
  RefreshCw,
  Database,
  CheckCircle2,
  AlertTriangle,
  HelpCircle,
  Clock,
  ArrowRight,
  ShieldCheck,
  Layers,
  Terminal,
  Receipt,
  RotateCcw,
  Zap
} from "lucide-react";
import AppShell from "@/components/layout/AppShell";
import {
  askLeakLens,
  fetchAskSuggestions,
  AskResponse,
  EvidenceItem
} from "@/lib/api";
import { EvidencePill } from "@/components/ui/Badges";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { LoadingState, EmptyState } from "@/components/ui/FeedbackStates";

interface MessageItem {
  id: string;
  role: "user" | "assistant";
  content: string;
  intent?: string;
  key_findings?: string[];
  evidence?: EvidenceItem[];
  related_exceptions?: string[];
  limitations?: string[];
  latency_ms?: number;
  timestamp: string;
}

const DEFAULT_SUGGESTIONS = [
  "How much money is currently unexplained?",
  "Which payments haven't settled?",
  "Show me all critical open exceptions.",
  "Are there any duplicate settlements detected?",
  "Show me all amount mismatch exceptions.",
  "Which transactions have unusual fee deductions?",
];

function InvestigateContent() {
  const searchParams = useSearchParams();
  const datasetId = searchParams.get("dataset_id") || "";

  const [messages, setMessages] = useState<MessageItem[]>([]);
  const [inputQuery, setInputQuery] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);
  const [suggestions, setSuggestions] = useState<string[]>(DEFAULT_SUGGESTIONS);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (datasetId) {
      loadSuggestions();
    }
  }, [datasetId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const loadSuggestions = async () => {
    try {
      const sugs = await fetchAskSuggestions(datasetId);
      if (sugs && sugs.length > 0) {
        setSuggestions(sugs);
      }
    } catch {
      setSuggestions(DEFAULT_SUGGESTIONS);
    }
  };

  const handleSendQuestion = async (queryText?: string) => {
    const q = (queryText || inputQuery).trim();
    if (!q || loading || !datasetId) return;

    setInputQuery("");
    setError(null);

    const userMsg: MessageItem = {
      id: `usr_${Date.now()}`,
      role: "user",
      content: q,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setLoading(true);

    try {
      const res: AskResponse = await askLeakLens(datasetId, q, conversationId);
      if (res.conversation_id) {
        setConversationId(res.conversation_id);
      }

      const assistantMsg: MessageItem = {
        id: `ast_${Date.now()}`,
        role: "assistant",
        content: res.answer,
        intent: res.intent,
        key_findings: res.key_findings,
        evidence: res.evidence,
        related_exceptions: res.related_exceptions,
        limitations: res.limitations,
        latency_ms: res.metadata?.total_time_ms,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      };

      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong while executing this ledger query.");
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendQuestion();
    }
  };

  const handleNewSession = () => {
    setMessages([]);
    setConversationId(null);
    setError(null);
  };

  if (!datasetId) {
    return (
      <EmptyState
        icon={Database}
        title="No Financial Dataset Selected"
        description="Select a financial session to begin querying ledger evidence."
        action={
          <Link
            href="/dashboard"
            className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-sm"
          >
            Go to Dashboard
          </Link>
        }
      />
    );
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto flex flex-col h-[calc(100vh-8.5rem)]">
      
      {/* Breadcrumbs */}
      <Breadcrumbs
        items={[
          { label: "Dashboard", href: `/dashboard?dataset_id=${datasetId}` },
          { label: "Ask LeakLens", isCurrent: true },
        ]}
      />

      {/* Header Info */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800 shrink-0">
        <div>
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-600/20 border border-blue-500/40 flex items-center justify-center text-blue-400 shadow-sm">
              <Sparkles className="w-4 h-4" />
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
              Financial Ledger Investigation
            </h1>
            <span className="text-[11px] font-mono px-2.5 py-0.5 rounded-full bg-slate-900 border border-slate-800 text-slate-400">
              Session: <strong className="text-slate-200">{datasetId}</strong>
            </span>
          </div>
          <p className="text-slate-400 text-xs mt-1 flex items-center space-x-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span>Grounded in verified ledger evidence • Deterministic query planner (zero arithmetic in prompts)</span>
          </p>
        </div>

        {conversationId && (
          <button
            type="button"
            onClick={handleNewSession}
            className="text-xs text-slate-300 hover:text-white border border-slate-700 bg-slate-900 hover:bg-slate-850 px-3 py-1.5 rounded-xl flex items-center space-x-1.5 transition-colors self-start sm:self-auto cursor-pointer shadow-sm"
          >
            <RotateCcw className="w-3 h-3" />
            <span>New Session</span>
          </button>
        )}
      </div>

      {/* Suggested Questions Pill Row for empty state */}
      {messages.length === 0 && (
        <div className="space-y-4 shrink-0 p-6 rounded-2xl border border-slate-800 bg-[#0c121e] shadow-xl">
          <div className="flex items-center justify-between pb-2 border-b border-slate-800/80">
            <span className="text-xs font-mono font-bold uppercase tracking-wider text-slate-300 flex items-center space-x-2">
              <Sparkles className="w-3.5 h-3.5 text-blue-400" />
              <span>Suggested Financial Inquiries</span>
            </span>
            <span className="text-[10px] font-mono text-emerald-400 px-2 py-0.5 rounded bg-emerald-950/50 border border-emerald-900/40">
              Evidence Grounded
            </span>
          </div>

          <div className="grid sm:grid-cols-2 gap-2.5 pt-1">
            {suggestions.map((sug, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => handleSendQuestion(sug)}
                className="text-left p-3.5 rounded-xl bg-slate-950/80 hover:bg-slate-900 border border-slate-800/80 hover:border-blue-700/60 text-xs text-slate-200 transition-all flex items-center justify-between group cursor-pointer shadow-sm"
              >
                <span className="leading-snug">{sug}</span>
                <ArrowRight className="w-3.5 h-3.5 text-slate-500 group-hover:text-blue-400 shrink-0 ml-2" />
              </button>
            ))}
          </div>

          <div className="p-3 rounded-xl bg-slate-950/50 border border-slate-850 text-[11px] text-slate-400 font-mono flex items-center space-x-2">
            <CheckCircle2 className="w-4 h-4 text-blue-400 shrink-0" />
            <span>Ask about transaction references (e.g. &ldquo;Tell me about PAY_000001&rdquo;), financial discrepancy aggregates, or missing bank settlements.</span>
          </div>
        </div>
      )}

      {/* Conversation Thread */}
      <div className="flex-1 overflow-y-auto space-y-6 pr-2">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex flex-col ${
              msg.role === "user" ? "items-end" : "items-start"
            }`}
          >
            {msg.role === "user" ? (
              /* User Query Bubble */
              <div className="max-w-2xl p-4 rounded-2xl rounded-tr-none bg-blue-600 text-white text-xs font-medium space-y-1 shadow-lg">
                <p className="leading-relaxed">{msg.content}</p>
                <span className="text-[10px] text-blue-200 block text-right font-mono pt-0.5">
                  {msg.timestamp}
                </span>
              </div>
            ) : (
              /* Assistant Answer Card */
              <div className="w-full max-w-4xl p-6 rounded-2xl rounded-tl-none border border-slate-800 bg-[#0c121e] space-y-5 shadow-xl">
                
                {/* Intent & Timing Header */}
                <div className="flex items-center justify-between pb-3 border-b border-slate-800/80">
                  <div className="flex items-center space-x-2">
                    <div className="w-5 h-5 rounded bg-blue-950 border border-blue-800/50 flex items-center justify-center text-blue-400">
                      <Sparkles className="w-3 h-3" />
                    </div>
                    <span className="text-xs font-mono font-semibold text-slate-300">
                      Ask LeakLens Intelligence
                    </span>
                    {msg.intent && (
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-slate-900 border border-slate-800 text-slate-400">
                        {msg.intent}
                      </span>
                    )}
                  </div>

                  {msg.latency_ms !== undefined && (
                    <span className="text-[10px] font-mono text-slate-500">
                      {msg.latency_ms} ms execution
                    </span>
                  )}
                </div>

                {/* Primary Answer Text */}
                <div className="text-xs text-slate-200 leading-relaxed font-sans whitespace-pre-line">
                  {msg.content}
                </div>

                {/* Key Findings */}
                {msg.key_findings && msg.key_findings.length > 0 && (
                  <div className="space-y-2 p-4 rounded-xl bg-slate-950/60 border border-slate-850">
                    <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-blue-400 block">
                      Confirmed Ledger Facts
                    </span>
                    <ul className="space-y-1.5 text-xs text-slate-300">
                      {msg.key_findings.map((item, fIdx) => (
                        <li key={fIdx} className="flex items-start space-x-2">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                          <span className="leading-snug">{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Evidence Pills linking back to records */}
                {msg.evidence && msg.evidence.length > 0 && (
                  <div className="space-y-2 pt-1 border-t border-slate-800/60">
                    <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 block font-semibold">
                      Supporting Evidence References
                    </span>
                    <div className="flex flex-wrap gap-2">
                      {msg.evidence.map((ev, eIdx) => (
                        <EvidencePill
                          key={eIdx}
                          label={`${ev.label}: ${ev.value}`}
                          variant={ev.type === "amount" ? "danger" : "neutral"}
                          href={ev.link ? `${ev.link}${ev.link.includes("?") ? "&" : "?"}dataset_id=${datasetId}` : undefined}
                        />
                      ))}
                    </div>
                  </div>
                )}

                {/* Related Exceptions Shortcuts */}
                {msg.related_exceptions && msg.related_exceptions.length > 0 && (
                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    <span className="text-[10px] font-mono uppercase text-slate-500">Related Discrepancies:</span>
                    {msg.related_exceptions.map((excId) => (
                      <Link
                        key={excId}
                        href={`/exceptions/${excId}?dataset_id=${datasetId}`}
                        className="text-[11px] font-mono px-2.5 py-0.5 rounded-lg bg-blue-950/50 hover:bg-blue-900 border border-blue-800/50 text-blue-300 flex items-center space-x-1 transition-colors"
                      >
                        <span>{excId}</span>
                        <ArrowRight className="w-2.5 h-2.5" />
                      </Link>
                    ))}
                  </div>
                )}

              </div>
            )}
          </div>
        ))}

        {/* Loading Indicator */}
        {loading && (
          <div className="flex items-start space-x-3 p-4 rounded-2xl border border-slate-800 bg-[#0c121e] max-w-md shadow-lg">
            <Sparkles className="w-4 h-4 text-blue-400 animate-spin shrink-0 mt-0.5" />
            <div className="space-y-1 text-xs">
              <span className="font-semibold text-slate-200">Analyzing verified ledger evidence...</span>
              <p className="text-[11px] text-slate-400 font-mono">Executing query plan across dataset records</p>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Localized Error state */}
      {error && (
        <div className="p-3.5 rounded-xl bg-rose-950/40 border border-rose-900/50 text-xs text-rose-300 shrink-0">
          {error}
        </div>
      )}

      {/* Input Bar */}
      <div className="pt-2 shrink-0">
        <div className="relative flex items-center">
          <input
            type="text"
            value={inputQuery}
            onChange={(e) => setInputQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={loading}
            placeholder="Ask anything about your financial ledger (e.g. 'How much money is currently unexplained?')..."
            className="w-full pl-4 pr-12 py-3.5 rounded-2xl bg-[#0c121e] border border-slate-800 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-xs text-slate-100 placeholder:text-slate-500 outline-none transition-colors shadow-lg disabled:opacity-50 font-sans"
          />
          <button
            type="button"
            disabled={loading || !inputQuery.trim()}
            onClick={() => handleSendQuestion()}
            className="absolute right-2 p-2 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white transition-colors cursor-pointer shadow-sm"
            aria-label="Submit financial query"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
        <p className="text-[10px] text-slate-400 font-mono text-center pt-2">
          Deterministic query planner • Formulates database retrieval filters without calculating arithmetic in prompts
        </p>
      </div>

    </div>
  );
}

export default function InvestigatePage() {
  return (
    <AppShell>
      <Suspense fallback={<LoadingState message="Loading financial query engine..." />}>
        <InvestigateContent />
      </Suspense>
    </AppShell>
  );
}
