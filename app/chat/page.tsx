"use client";

/**
 * app/chat/page.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Premium dark-themed RAG Chat UI
 *
 * Features:
 *  • Streaming token-by-token display (typing effect)
 *  • Source citations — collapsible per AI message
 *  • Settings panel — configure Pinecone index / namespace at runtime
 *  • Loading animation (3-dot pulse) while waiting for first token
 *  • Error handling with inline feedback
 *  • Welcome screen with clickable example questions
 *  • Auto-scroll, auto-resizing textarea, keyboard shortcuts
 */

import { useState, useRef, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  Send,
  Settings,
  Sparkles,
  User,
  ChevronDown,
  ChevronUp,
  Copy,
  Check,
  BookOpen,
  ArrowLeft,
  AlertCircle,
  Loader2,
  X,
} from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────
interface Source {
  id: string;
  chunk: string;
}

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  sources?: Source[];
  isStreaming?: boolean;
  error?: string;
}

// ── Example questions shown on the welcome screen ─────────────────────────────
const EXAMPLE_QUESTIONS = [
  "What are the diagnostic criteria for Type 2 Diabetes?",
  "How is sepsis managed in an ICU setting?",
  "What are the side effects of beta-blockers?",
  "Explain the pathophysiology of congestive heart failure",
];


export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [question, setQuestion] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [indexName, setIndexName] = useState("");
  const [namespace, setNamespace] = useState("");
  const [expandedSources, setExpandedSources] = useState<Set<string>>(
    new Set()
  );
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll to the latest message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Auto-resize the textarea as the user types
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${Math.min(
        textareaRef.current.scrollHeight,
        200
      )}px`;
    }
  }, [question]);

  const toggleSources = (id: string) => {
    setExpandedSources((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const copyToClipboard = async (text: string, id: string) => {
    await navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // ── Core: send message and process streaming NDJSON response ──────────────
  const sendMessage = useCallback(
    async (overrideText?: string) => {
      const text = (overrideText ?? question).trim();
      if (!text || isLoading) return;

      const userMsg: Message = {
        id: `user-${Date.now()}`,
        role: "user",
        content: text,
      };

      const assistantId = `assistant-${Date.now() + 1}`;
      const assistantMsg: Message = {
        id: assistantId,
        role: "assistant",
        content: "",
        isStreaming: true,
      };

      setMessages((prev) => [...prev, userMsg, assistantMsg]);
      setQuestion("");
      setIsLoading(true);

      try {
        const response = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            question: text,
            indexName: indexName || undefined,
            namespace: namespace || undefined,
            topK: 5,
          }),
        });

        if (!response.ok) {
          const err = await response.json();
          throw new Error(err.error || `HTTP ${response.status}`);
        }

        const reader = response.body?.getReader();
        if (!reader) throw new Error("ReadableStream not supported in browser");

        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          // Accumulate decoded bytes; split on newlines for NDJSON parsing
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? ""; // keep the last incomplete line

          for (const line of lines) {
            if (!line.trim()) continue;
            try {
              const data = JSON.parse(line);

              if (data.type === "sources") {
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === assistantId
                      ? { ...m, sources: data.sources }
                      : m
                  )
                );
              } else if (data.type === "token") {
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === assistantId
                      ? { ...m, content: m.content + data.content }
                      : m
                  )
                );
              } else if (data.type === "done") {
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === assistantId ? { ...m, isStreaming: false } : m
                  )
                );
              } else if (data.type === "error") {
                throw new Error(data.error);
              }
            } catch (parseErr) {
              console.warn("NDJSON parse error:", parseErr, "Line:", line);
            }
          }
        }
      } catch (error: any) {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId
              ? { ...m, content: "", error: error.message, isStreaming: false }
              : m
          )
        );
      } finally {
        setIsLoading(false);
        textareaRef.current?.focus();
      }
    },
    [question, isLoading, indexName, namespace]
  );

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="chat-root">
      {/* ── Header ── */}
      <header className="chat-header">
        <div className="chat-header-inner">
          <div className="chat-header-left">
            <Link href="/" className="back-link" title="Back to home">
              <ArrowLeft size={18} />
            </Link>
            <div className="logo-icon">
              <Sparkles size={18} color="white" />
            </div>
            <div>
              <h1 className="logo-title">MediScan AI</h1>
              <p className="logo-subtitle">RAG-Powered Medical Assistant</p>
            </div>
          </div>

          <button
            className={`settings-btn ${showSettings ? "settings-btn--active" : ""}`}
            onClick={() => setShowSettings((s) => !s)}
          >
            {showSettings ? <X size={14} /> : <Settings size={14} />}
            {showSettings ? "Close" : "Settings"}
          </button>
        </div>

        {/* Settings panel */}
        {showSettings && (
          <div className="settings-panel">
            <div className="settings-grid">
              {(
                [
                  {
                    label: "Index Name",
                    value: indexName,
                    setter: setIndexName,
                    placeholder: "e.g. medical-docs",
                  },
                  {
                    label: "Namespace",
                    value: namespace,
                    setter: setNamespace,
                    placeholder: "e.g. textbooks",
                  },
                ] as const
              ).map(({ label, value, setter, placeholder }) => (
                <div key={label}>
                  <label className="settings-label">{label}</label>
                  <input
                    className="settings-input"
                    value={value}
                    onChange={(e) => setter(e.target.value)}
                    placeholder={placeholder}
                  />
                </div>
              ))}
            </div>
            <p className="settings-hint">
              💡 Leave empty to use <code>PINECONE_INDEX_NAME</code> /{" "}
              <code>PINECONE_NAMESPACE</code> from <code>.env</code>
            </p>
          </div>
        )}
      </header>

      {/* ── Messages Scroll Area ── */}
      <main className="chat-main">
        <div className="chat-messages-wrap">
          {/* Welcome screen */}
          {messages.length === 0 && (
            <div className="welcome">
              <div className="welcome-icon">
                <Sparkles size={38} color="white" />
              </div>
              <h2 className="welcome-title">Medical Knowledge Assistant</h2>
              <p className="welcome-sub">
                Ask any clinical or medical question. Answers come strictly from
                your uploaded knowledge base — no hallucination.
              </p>
              <div className="examples-grid">
                {EXAMPLE_QUESTIONS.map((q) => (
                  <button
                    key={q}
                    className="example-btn"
                    onClick={() => sendMessage(q)}
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Message list */}
          <div className="messages-list">
            {messages.map((msg) => (
              <MessageBubble
                key={msg.id}
                message={msg}
                isExpanded={expandedSources.has(msg.id)}
                onToggleSources={() => toggleSources(msg.id)}
                isCopied={copiedId === msg.id}
                onCopy={() => copyToClipboard(msg.content, msg.id)}
              />
            ))}
          </div>

          <div ref={messagesEndRef} />
        </div>
      </main>

      {/* ── Input Footer ── */}
      <footer className="chat-footer">
        <div className="input-wrap">
          <div className="input-box">
            <textarea
              id="chat-input"
              ref={textareaRef}
              className="chat-textarea"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask a medical question… (Enter to send, Shift+Enter for new line)"
              rows={1}
            />
            <button
              id="chat-send-btn"
              className={`send-btn ${
                !isLoading && question.trim() ? "send-btn--active" : ""
              }`}
              onClick={() => sendMessage()}
              disabled={isLoading || !question.trim()}
            >
              {isLoading ? (
                <Loader2 size={18} className="spin-icon" />
              ) : (
                <Send size={18} />
              )}
            </button>
          </div>
          <p className="footer-disclaimer">
            Answers are strictly based on uploaded medical documents · Not
            medical advice
          </p>
        </div>
      </footer>

      {/* ── Keyframe animations & scoped styles ── */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');

        /* ── Layout ── */
        .chat-root {
          min-height: 100vh;
          display: flex;
          flex-direction: column;
          background: linear-gradient(135deg, #020817 0%, #080f2e 50%, #020817 100%);
          font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
          color: white;
        }

        /* ── Header ── */
        .chat-header {
          position: sticky; top: 0; z-index: 50;
          border-bottom: 1px solid rgba(255,255,255,0.07);
          background: rgba(2,8,23,0.85);
          backdrop-filter: blur(24px);
        }
        .chat-header-inner {
          max-width: 900px; margin: 0 auto;
          padding: 0 1.5rem;
          display: flex; align-items: center; justify-content: space-between;
          height: 64px;
        }
        .chat-header-left { display: flex; align-items: center; gap: 12px; }
        .back-link {
          color: rgba(255,255,255,0.4); text-decoration: none;
          padding: 6px; border-radius: 8px;
          transition: color 0.2s, background 0.2s;
        }
        .back-link:hover { color: white; background: rgba(255,255,255,0.08); }
        .logo-icon {
          width: 36px; height: 36px; border-radius: 10px;
          background: linear-gradient(135deg, #06b6d4, #3b82f6);
          display: flex; align-items: center; justify-content: center;
          box-shadow: 0 0 24px rgba(6,182,212,0.45);
          flex-shrink: 0;
        }
        .logo-title { margin: 0; font-size: 1rem; font-weight: 700; letter-spacing: -0.02em; }
        .logo-subtitle { margin: 0; font-size: 0.68rem; color: rgba(255,255,255,0.38); }

        /* Settings button */
        .settings-btn {
          display: flex; align-items: center; gap: 6px;
          padding: 7px 14px; border-radius: 8px;
          border: 1px solid rgba(255,255,255,0.1);
          background: rgba(255,255,255,0.05);
          color: rgba(255,255,255,0.65); cursor: pointer;
          font-size: 0.8rem; font-weight: 500;
          transition: all 0.2s;
        }
        .settings-btn:hover { background: rgba(255,255,255,0.09); color: white; }
        .settings-btn--active { background: rgba(6,182,212,0.15); color: #06b6d4; border-color: rgba(6,182,212,0.3); }

        /* Settings panel */
        .settings-panel {
          max-width: 900px; margin: 0 auto;
          padding: 1rem 1.5rem 1.25rem;
          border-top: 1px solid rgba(255,255,255,0.05);
          animation: fadeSlideIn 0.2s ease;
        }
        .settings-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 10px; }
        .settings-label {
          display: block; margin-bottom: 6px;
          font-size: 0.7rem; font-weight: 600;
          text-transform: uppercase; letter-spacing: 0.06em;
          color: rgba(255,255,255,0.45);
        }
        .settings-input {
          width: 100%; box-sizing: border-box;
          background: rgba(255,255,255,0.05);
          border: 1px solid rgba(255,255,255,0.1);
          border-radius: 8px; padding: 9px 12px;
          color: white; font-size: 0.85rem; outline: none;
          transition: border-color 0.2s;
          font-family: inherit;
        }
        .settings-input:focus { border-color: rgba(6,182,212,0.5); }
        .settings-input::placeholder { color: rgba(255,255,255,0.28); }
        .settings-hint { margin: 0; font-size: 0.71rem; color: rgba(255,255,255,0.32); line-height: 1.5; }
        .settings-hint code { background: rgba(255,255,255,0.08); padding: 1px 5px; border-radius: 4px; font-size: 0.68rem; }

        /* ── Main scroll area ── */
        .chat-main { flex: 1; overflow-y: auto; padding: 2rem 1.5rem; }
        .chat-messages-wrap { max-width: 900px; margin: 0 auto; }

        /* ── Welcome screen ── */
        .welcome { text-align: center; padding: 3.5rem 0 2.5rem; }
        .welcome-icon {
          width: 84px; height: 84px; border-radius: 26px;
          background: linear-gradient(135deg, #06b6d4, #3b82f6);
          display: flex; align-items: center; justify-content: center;
          margin: 0 auto 1.5rem;
          box-shadow: 0 0 64px rgba(6,182,212,0.35), 0 0 120px rgba(59,130,246,0.15);
        }
        .welcome-title {
          font-size: 2rem; font-weight: 700; letter-spacing: -0.04em;
          color: white; margin: 0 0 0.6rem;
        }
        .welcome-sub {
          color: rgba(255,255,255,0.42); font-size: 0.97rem;
          max-width: 480px; margin: 0 auto 2.5rem;
          line-height: 1.65;
        }
        .examples-grid {
          display: grid; grid-template-columns: repeat(2, 1fr);
          gap: 10px; max-width: 660px; margin: 0 auto;
        }
        .example-btn {
          padding: 14px 16px; border-radius: 12px;
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.08);
          color: rgba(255,255,255,0.65); font-size: 0.83rem;
          cursor: pointer; text-align: left; line-height: 1.5;
          transition: all 0.2s; font-family: inherit;
        }
        .example-btn:hover {
          background: rgba(6,182,212,0.1);
          border-color: rgba(6,182,212,0.3);
          color: rgba(255,255,255,0.9);
          transform: translateY(-1px);
          box-shadow: 0 4px 16px rgba(6,182,212,0.12);
        }

        /* ── Messages list ── */
        .messages-list { display: flex; flex-direction: column; gap: 28px; }

        /* ── User bubble ── */
        .msg-user { display: flex; justify-content: flex-end; gap: 10px; align-items: flex-start; }
        .user-avatar {
          flex-shrink: 0; width: 34px; height: 34px; border-radius: 50%;
          background: linear-gradient(135deg, #6366f1, #8b5cf6);
          display: flex; align-items: center; justify-content: center;
          box-shadow: 0 0 14px rgba(99,102,241,0.4);
        }
        .user-bubble {
          max-width: 72%; background: linear-gradient(135deg, #6366f1, #8b5cf6);
          border-radius: 18px 18px 4px 18px;
          padding: 12px 16px; color: white; font-size: 0.9rem; line-height: 1.65;
          box-shadow: 0 4px 24px rgba(99,102,241,0.3);
        }

        /* ── AI bubble ── */
        .msg-ai { display: flex; gap: 10px; align-items: flex-start; }
        .ai-avatar {
          flex-shrink: 0; width: 34px; height: 34px; border-radius: 50%;
          background: linear-gradient(135deg, #06b6d4, #3b82f6);
          display: flex; align-items: center; justify-content: center;
          box-shadow: 0 0 14px rgba(6,182,212,0.4);
        }
        .ai-body { flex: 1; min-width: 0; }
        .ai-card {
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.08);
          border-left: 3px solid #06b6d4;
          border-radius: 4px 18px 18px 18px;
          padding: 14px 16px; position: relative;
        }
        .ai-text {
          margin: 0; color: rgba(255,255,255,0.9);
          font-size: 0.9rem; line-height: 1.75;
          white-space: pre-wrap; word-break: break-word;
        }

        /* Loading dots */
        .loading-dots { display: flex; gap: 5px; align-items: center; padding: 4px 0; }
        .dot {
          width: 7px; height: 7px; border-radius: 50%; background: #06b6d4;
        }
        .dot-1 { animation: pulseDot 1.4s ease-in-out 0s infinite; }
        .dot-2 { animation: pulseDot 1.4s ease-in-out 0.2s infinite; }
        .dot-3 { animation: pulseDot 1.4s ease-in-out 0.4s infinite; }

        /* Cursor blink */
        .cursor {
          display: inline-block; width: 2px; height: 1.1em;
          background: #06b6d4; margin-left: 2px;
          vertical-align: text-bottom;
          animation: blink 0.9s ease-in-out infinite;
        }

        /* Error block */
        .error-block {
          display: flex; gap: 9px; align-items: flex-start;
          color: #f87171; font-size: 0.88rem; line-height: 1.5;
        }

        /* Copy button */
        .copy-btn {
          position: absolute; top: 10px; right: 10px;
          background: rgba(255,255,255,0.07);
          border: 1px solid rgba(255,255,255,0.1);
          border-radius: 6px; padding: 4px 9px; cursor: pointer;
          color: rgba(255,255,255,0.4); display: flex; align-items: center; gap: 4px;
          font-size: 0.71rem; transition: all 0.2s; font-family: inherit;
        }
        .copy-btn:hover { background: rgba(255,255,255,0.12); color: white; }
        .copy-btn--copied { color: #06b6d4; border-color: rgba(6,182,212,0.3); }

        /* Sources */
        .sources-toggle {
          display: flex; align-items: center; gap: 6px; margin-top: 8px;
          background: none; border: none; cursor: pointer;
          color: rgba(255,255,255,0.38); font-size: 0.78rem;
          padding: 4px 0; transition: color 0.2s; font-family: inherit;
        }
        .sources-toggle:hover { color: #06b6d4; }
        .sources-list { margin-top: 8px; display: flex; flex-direction: column; gap: 8px; animation: fadeSlideIn 0.2s ease; }
        .source-card {
          background: rgba(6,182,212,0.06);
          border: 1px solid rgba(6,182,212,0.15);
          border-radius: 10px; padding: 10px 12px;
        }
        .source-header { display: flex; align-items: center; gap: 7px; margin-bottom: 6px; }
        .source-badge {
          background: rgba(6,182,212,0.2); color: #06b6d4;
          font-size: 0.67rem; font-weight: 700;
          padding: 2px 8px; border-radius: 99px; letter-spacing: 0.04em;
          flex-shrink: 0;
        }
        .source-id {
          font-size: 0.71rem; color: rgba(255,255,255,0.38);
          word-break: break-all; font-family: 'SF Mono', 'Fira Code', monospace;
        }
        .source-chunk {
          margin: 0; font-size: 0.79rem;
          color: rgba(255,255,255,0.52); line-height: 1.6;
        }

        /* ── Input Footer ── */
        .chat-footer {
          position: sticky; bottom: 0;
          border-top: 1px solid rgba(255,255,255,0.07);
          background: rgba(2,8,23,0.92);
          backdrop-filter: blur(24px);
          padding: 1rem 1.5rem 1.5rem;
        }
        .input-wrap { max-width: 900px; margin: 0 auto; }
        .input-box {
          display: flex; gap: 10px; align-items: flex-end;
          background: rgba(255,255,255,0.05);
          border: 1px solid rgba(255,255,255,0.1);
          border-radius: 16px; padding: 12px 12px 12px 16px;
          transition: border-color 0.2s;
        }
        .input-box:focus-within { border-color: rgba(6,182,212,0.4); }
        .chat-textarea {
          flex: 1; background: transparent; border: none; outline: none;
          color: white; font-size: 0.9rem; resize: none; line-height: 1.65;
          max-height: 200px; overflow-y: auto; font-family: inherit;
        }
        .chat-textarea::placeholder { color: rgba(255,255,255,0.28); }

        .send-btn {
          flex-shrink: 0; width: 40px; height: 40px; border-radius: 10px;
          border: none; cursor: not-allowed;
          background: rgba(255,255,255,0.08);
          color: rgba(255,255,255,0.3);
          display: flex; align-items: center; justify-content: center;
          transition: all 0.2s;
        }
        .send-btn--active {
          cursor: pointer;
          background: linear-gradient(135deg, #06b6d4, #3b82f6);
          color: white;
          box-shadow: 0 0 22px rgba(6,182,212,0.45);
        }
        .send-btn--active:hover { transform: scale(1.06); box-shadow: 0 0 30px rgba(6,182,212,0.55); }
        .footer-disclaimer {
          text-align: center; margin: 8px 0 0;
          font-size: 0.68rem; color: rgba(255,255,255,0.22);
        }

        /* ── Scrollbar ── */
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.14); border-radius: 4px; }

        /* ── Animations ── */
        @keyframes fadeSlideIn {
          from { opacity: 0; transform: translateY(-6px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes pulseDot {
          0%, 100% { opacity: 1; transform: scale(1); }
          50%       { opacity: 0.3; transform: scale(0.75); }
        }
        @keyframes blink {
          0%, 100% { opacity: 1; }
          50%       { opacity: 0; }
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }
        .spin-icon { animation: spin 1s linear infinite; }

        /* ── Responsive ── */
        @media (max-width: 600px) {
          .examples-grid { grid-template-columns: 1fr; }
          .settings-grid { grid-template-columns: 1fr; }
          .welcome-title { font-size: 1.5rem; }
        }
      `}</style>
    </div>
  );
}


interface BubbleProps {
  message: Message;
  isExpanded: boolean;
  onToggleSources: () => void;
  isCopied: boolean;
  onCopy: () => void;
}

function MessageBubble({
  message,
  isExpanded,
  onToggleSources,
  isCopied,
  onCopy,
}: BubbleProps) {
  if (message.role === "user") {
    return (
      <div className="msg-user">
        <div className="user-bubble">{message.content}</div>
        <div className="user-avatar">
          <User size={16} color="white" />
        </div>
      </div>
    );
  }

  // ── AI message ─────────────────────────────────────────────────────────────
  return (
    <div className="msg-ai">
      <div className="ai-avatar">
        <Sparkles size={16} color="white" />
      </div>

      <div className="ai-body">
        <div className="ai-card">
          {/* Error state */}
          {message.error && (
            <div className="error-block">
              <AlertCircle size={15} style={{ flexShrink: 0, marginTop: 2 }} />
              <span>{message.error}</span>
            </div>
          )}

          {/* Loading dots — shown while waiting for first token */}
          {message.isStreaming && !message.content && (
            <div className="loading-dots">
              <div className="dot dot-1" />
              <div className="dot dot-2" />
              <div className="dot dot-3" />
            </div>
          )}

          {/* Answer text + streaming cursor */}
          {message.content && (
            <p className="ai-text">
              {message.content}
              {message.isStreaming && <span className="cursor" />}
            </p>
          )}

          {/* Copy button — visible once streaming is done */}
          {!message.isStreaming && message.content && !message.error && (
            <button
              className={`copy-btn ${isCopied ? "copy-btn--copied" : ""}`}
              onClick={onCopy}
              title="Copy response"
            >
              {isCopied ? (
                <>
                  <Check size={11} /> Copied
                </>
              ) : (
                <>
                  <Copy size={11} /> Copy
                </>
              )}
            </button>
          )}
        </div>

        {/* Sources — shown below the card once streaming is complete */}
        {!message.isStreaming &&
          message.sources &&
          message.sources.length > 0 && (
            <div>
              <button className="sources-toggle" onClick={onToggleSources}>
                <BookOpen size={13} />
                {message.sources.length} source
                {message.sources.length !== 1 ? "s" : ""} retrieved
                {isExpanded ? (
                  <ChevronUp size={13} />
                ) : (
                  <ChevronDown size={13} />
                )}
              </button>

              {isExpanded && (
                <div className="sources-list">
                  {message.sources.map((src, idx) => (
                    <div key={src.id} className="source-card">
                      <div className="source-header">
                        <span className="source-badge">SOURCE {idx + 1}</span>
                        <span className="source-id">{src.id}</span>
                      </div>
                      <p className="source-chunk">
                        {src.chunk.slice(0, 320)}
                        {src.chunk.length > 320 ? "…" : ""}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
      </div>
    </div>
  );
}
