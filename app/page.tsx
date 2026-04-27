"use client";
import Link from "next/link";
import { Database, MessageSquare, Sparkles } from "lucide-react";

export default function Home() {
  return (
    <main
      style={{
        minHeight: "100vh",
        background: "linear-gradient(135deg, #020817 0%, #080f2e 50%, #020817 100%)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: "2rem",
        fontFamily: "'Inter', -apple-system, sans-serif",
        padding: "2rem",
      }}
    >
      {/* Logo */}
      <div style={{ textAlign: "center" }}>
        <div
          style={{
            width: "72px", height: "72px", borderRadius: "22px",
            background: "linear-gradient(135deg, #06b6d4, #3b82f6)",
            display: "flex", alignItems: "center", justifyContent: "center",
            margin: "0 auto 1.25rem",
            boxShadow: "0 0 60px rgba(6,182,212,0.4)",
          }}
        >
          <Sparkles size={32} color="white" />
        </div>
        <h1
          style={{
            color: "white", fontSize: "2.2rem", fontWeight: 700,
            letterSpacing: "-0.04em", margin: "0 0 0.5rem",
          }}
        >
          MediScan AI
        </h1>
        <p style={{ color: "rgba(255,255,255,0.42)", fontWeight: 400, margin: 0 }}>
          RAG-Powered Medical Knowledge Base
        </p>
      </div>

      {/* Nav cards */}
      <div style={{ display: "flex", gap: "16px", flexWrap: "wrap", justifyContent: "center" }}>
        <Link href="/chat" style={{ textDecoration: "none" }}>
          <div
            style={{
              padding: "24px 32px", borderRadius: "16px",
              background: "linear-gradient(135deg, rgba(6,182,212,0.15), rgba(59,130,246,0.1))",
              border: "1px solid rgba(6,182,212,0.3)",
              display: "flex", flexDirection: "column", alignItems: "center", gap: "10px",
              cursor: "pointer", transition: "transform 0.2s, box-shadow 0.2s",
              minWidth: "180px",
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLDivElement).style.transform = "translateY(-3px)";
              (e.currentTarget as HTMLDivElement).style.boxShadow = "0 12px 32px rgba(6,182,212,0.2)";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLDivElement).style.transform = "translateY(0)";
              (e.currentTarget as HTMLDivElement).style.boxShadow = "none";
            }}
          >
            <MessageSquare size={28} color="#06b6d4" />
            <span style={{ color: "white", fontWeight: 600, fontSize: "0.95rem" }}>Chat</span>
            <span style={{ color: "rgba(255,255,255,0.42)", fontSize: "0.78rem", textAlign: "center" }}>
              Ask medical questions
            </span>
          </div>
        </Link>

        <Link href="/pinecone" style={{ textDecoration: "none" }}>
          <div
            style={{
              padding: "24px 32px", borderRadius: "16px",
              background: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(255,255,255,0.1)",
              display: "flex", flexDirection: "column", alignItems: "center", gap: "10px",
              cursor: "pointer", transition: "transform 0.2s, box-shadow 0.2s",
              minWidth: "180px",
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLDivElement).style.transform = "translateY(-3px)";
              (e.currentTarget as HTMLDivElement).style.boxShadow = "0 12px 32px rgba(255,255,255,0.06)";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLDivElement).style.transform = "translateY(0)";
              (e.currentTarget as HTMLDivElement).style.boxShadow = "none";
            }}
          >
            <Database size={28} color="rgba(255,255,255,0.6)" />
            <span style={{ color: "white", fontWeight: 600, fontSize: "0.95rem" }}>Knowledge Base</span>
            <span style={{ color: "rgba(255,255,255,0.42)", fontSize: "0.78rem", textAlign: "center" }}>
              Upload & index documents
            </span>
          </div>
        </Link>
      </div>
    </main>
  );
}

