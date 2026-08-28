"use client";

import React, { useState, useEffect, useRef, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  Sparkles,
  Send,
  RefreshCw,
  Database,
  ExternalLink,
  CheckCircle2,
  AlertTriangle,
  Info,
  DollarSign,
  Receipt,
  HelpCircle,
  Clock,
  ArrowRight
} from "lucide-react";
import AppShell from "@/components/layout/AppShell";
import {
  askLeakLens,
  fetchAskSuggestions,
  AskResponse,
  ChatMessage,
  EvidenceItem
} from "@/lib/api";

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

function InvestigateContent() {
  const searchParams = useSearchParams();
  const datasetId = searchParams.get("dataset_id") || "";

  const [messages, setMessages] = useState<MessageItem[]>([]);
  const [inputQuery, setInputQuery] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);
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
      setSuggestions(sugs);
    } catch {
      // Fallback suggestions
      setSuggestions([
        "How much money is currently unexplained?",
        "Why is today's settlement lower than expected?",
        "Show me my top 5 discrepancies.",
        "Which payments haven't settled?",
        "How many critical issues do I have?",
        "Which exception type has the highest financial impact?",
      ]);
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
      setError(err instanceof Error ? err.message : "Failed to retrieve investigation results.");
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

  if (!datasetId) {
    return (
      <div className="p-12 rounded-xl border border-dashed border-slate-800 bg-[#0c121e]/40 flex flex-col items-center justify-center text-center space-y-4">
        <Database className="w-12 h-12 text-slate-600" />
        <h2 className="text-base font-semibold text-slate-200">No Dataset Selected</h2>
        <p className="text-xs text-slate-400">Select a financial session to begin investigating data.</p>
        <Link href="/dashboard" className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium">
          Go to Dashboard
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto flex flex-col h-[calc(100vh-8rem)]">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-800 shrink-0">
        <div>
          <h1 className="text-xl font-bold text-white tracking-tight flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-600/20 border border-blue-500/40 flex items-center justify-center text-blue-400">
              <Sparkles className="w-4 h-4" />
            </div>
            <span>Ask LeakLens</span>
          </h1>
          <p className="text-slate-400 text-xs mt-0.5">
            Investigate your financial session in plain language with grounded reconciliation proofs.
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <span className="text-[11px] font-mono px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-800 text-slate-300">
            Session: <strong className="text-blue-400">{datasetId}</strong>
          </span>
        </div>
      </div>

      {/* Chat Messages Container */}
      <div className="flex-1 overflow-y-auto space-y-6 pr-2">
        
        {/* Empty State / Suggested Questions */}
        {messages.length === 0 && (
          <div className="p-8 rounded-xl border border-slate-800 bg-[#0c121e] space-y-6 text-center max-w-2xl mx-auto my-8">
            <div className="w-12 h-12 rounded-xl bg-blue-600/20 border border-blue-500/40 flex items-center justify-center text-blue-400 mx-auto">
              <Sparkles className="w-6 h-6" />
            </div>
            <div className="space-y-1.5">
              <h2 className="text-base font-bold text-white tracking-tight">Ask anything about your financial data</h2>
              <p className="text-xs text-slate-400">
                LeakLens converts your questions into deterministic database queries and explains the findings with auditable evidence.
              </p>
            </div>

            {/* Suggestions Grid */}
            <div className="space-y-2 text-left">
              <span className="text-[10px] uppercase font-mono text-slate-500 font-semibold block px-1">
                Suggested Financial Investigations
              </span>
              <div className="grid sm:grid-cols-2 gap-2">
                {suggestions.map((sug, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleSendQuestion(sug)}
                    className="p-3 rounded-lg bg-slate-900/80 hover:bg-slate-900 border border-slate-800 hover:border-slate-700 text-xs text-slate-300 hover:text-white transition-all text-left flex items-start space-x-2 group cursor-pointer"
                  >
                    <ArrowRight className="w-3.5 h-3.5 text-blue-400 mt-0.5 shrink-0 group-hover:translate-x-0.5 transition-transform" />
                    <span>{sug}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Message Thread */}
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex flex-col ${msg.role === "user" ? "items-end" : "items-start"}`}
          >
            {/* User Message */}
            {msg.role === "user" ? (
              <div className="max-w-2xl bg-blue-600 text-white rounded-2xl rounded-tr-sm px-4 py-3 text-xs shadow-md space-y-1">
                <p className="font-medium">{msg.content}</p>
                <span className="text-[10px] text-blue-200 block text-right font-mono">{msg.timestamp}</span>
              </div>
            ) : (
              /* Assistant Answer Card */
              <div className="w-full max-w-3xl rounded-2xl rounded-tl-sm border border-slate-800 bg-[#0c121e] p-5 space-y-4 shadow-xl">
                
                {/* Assistant Header */}
                <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
                  <div className="flex items-center space-x-2">
                    <div className="w-6 h-6 rounded-md bg-blue-600/20 border border-blue-500/40 flex items-center justify-center text-blue-400">
                      <Sparkles className="w-3.5 h-3.5" />
                    </div>
                    <span className="text-xs font-bold text-white tracking-tight">LeakLens Financial Intelligence</span>
                    {msg.intent && (
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-slate-400">
                        {msg.intent}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center space-x-2 text-[10px] font-mono text-slate-500">
                    {msg.latency_ms && <span>{msg.latency_ms} ms</span>}
                    <span>•</span>
                    <span>{msg.timestamp}</span>
                  </div>
                </div>

                {/* Primary Answer Narrative */}
                <div className="text-xs text-slate-200 leading-relaxed font-medium">
                  {msg.content}
                </div>

                {/* Key Findings Checklist */}
                {msg.key_findings && msg.key_findings.length > 0 && (
                  <div className="p-3.5 rounded-lg bg-slate-950/60 border border-slate-800/80 space-y-2">
                    <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 font-semibold block">
                      Key Findings
                    </span>
                    <ul className="space-y-1.5 text-xs text-slate-300">
                      {msg.key_findings.map((f, idx) => (
                        <li key={idx} className="flex items-start space-x-2">
                          <CheckCircle2 className="w-3.5 h-3.5 text-blue-400 shrink-0 mt-0.5" />
                          <span>{f}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Evidence Metric Chips */}
                {msg.evidence && msg.evidence.length > 0 && (
                  <div className="space-y-2">
                    <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 font-semibold block">
                      Grounded Evidence & Direct Links
                    </span>
                    <div className="flex flex-wrap gap-2">
                      {msg.evidence.map((ev, idx) => {
                        const content = (
                          <div className="px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 hover:border-slate-700 text-xs font-mono flex items-center space-x-2 transition-colors">
                            <span className="text-slate-400 text-[11px]">{ev.label}:</span>
                            <strong className="text-white font-bold">{ev.value}</strong>
                            {ev.link && <ExternalLink className="w-3 h-3 text-blue-400 ml-1" />}
                          </div>
                        );
                        return ev.link ? (
                          <Link key={idx} href={ev.link}>
                            {content}
                          </Link>
                        ) : (
                          <div key={idx}>{content}</div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Limitations */}
                {msg.limitations && msg.limitations.length > 0 && (
                  <div className="text-[10px] text-slate-500 font-mono pt-1">
                    <span className="text-slate-400 font-semibold">Scope: </span>
                    {msg.limitations.join(" • ")}
                  </div>
                )}

              </div>
            )}
          </div>
        ))}

        {/* Loading Indicator */}
        {loading && (
          <div className="flex items-center space-x-3 p-4 rounded-xl bg-[#0c121e] border border-slate-800 text-xs text-blue-400 font-mono animate-pulse w-fit">
            <RefreshCw className="w-4 h-4 animate-spin" />
            <span>Investigating your financial data & calculating evidence...</span>
          </div>
        )}

        {/* Error Alert */}
        {error && (
          <div className="p-4 rounded-lg bg-rose-950/40 border border-rose-900 text-xs text-rose-300">
            {error}
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Chat Input Bar */}
      <div className="pt-2 border-t border-slate-800 shrink-0">
        <div className="relative flex items-center">
          <input
            type="text"
            placeholder="Ask about unexplained money, missing settlements, top issues, or payment IDs..."
            value={inputQuery}
            disabled={loading}
            onChange={(e) => setInputQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            className="w-full pl-4 pr-24 py-3.5 bg-[#0c121e] border border-slate-800 rounded-xl text-xs font-mono text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 transition-colors shadow-inner"
          />
          <button
            type="button"
            disabled={loading || !inputQuery.trim()}
            onClick={() => handleSendQuestion()}
            className="absolute right-2 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white text-xs font-medium flex items-center space-x-1.5 transition-colors cursor-pointer"
          >
            <span>Ask</span>
            <Send className="w-3 h-3" />
          </button>
        </div>
        <div className="flex items-center justify-between text-[10px] font-mono text-slate-500 pt-2 px-1">
          <span>Supported: Summaries, Discrepancies, Top Issues, Exception Types, Transaction Lookups</span>
          <span>Deterministic ground truth • AI reasoning</span>
        </div>
      </div>

    </div>
  );
}

export default function InvestigatePage() {
  return (
    <AppShell>
      <Suspense fallback={<div className="text-center py-20 text-slate-500">Loading Ask LeakLens...</div>}>
        <InvestigateContent />
      </Suspense>
    </AppShell>
  );
}
