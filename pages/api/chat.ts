

import { NextApiRequest, NextApiResponse } from "next";
import { retrieveContext, streamAnswer } from "@/lib/rag";

export const config = {
  api: {
    // Disable response size limit — needed for streaming
    responseLimit: false,
  },
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    console.log("[/api/chat] Request received");
    
    // Support body as string or pre-parsed object (depending on Content-Type header)
    const body =
      typeof req.body === "string" ? JSON.parse(req.body) : req.body;

    const { question, indexName, namespace, topK = 5 } = body;

    if (!question?.trim()) {
      return res.status(400).json({ error: "Question is required." });
    }

    // Resolve index & namespace: prefer request body, fall back to env vars
    const resolvedIndex = (indexName as string) || process.env.PINECONE_INDEX_NAME;
    const resolvedNamespace = (namespace as string) || process.env.PINECONE_NAMESPACE;

    console.log(`[/api/chat] Using index: ${resolvedIndex}, namespace: ${resolvedNamespace}`);

    if (!resolvedIndex || !resolvedNamespace) {
      return res.status(400).json({
        error:
          "Pinecone index name and namespace are required. Set them in the chat Settings panel or add PINECONE_INDEX_NAME / PINECONE_NAMESPACE to .env",
      });
    }

    // Validate environment variables
    if (!process.env.PINECONE_API_KEY) {
      console.error("[/api/chat] PINECONE_API_KEY is not set");
      return res.status(500).json({ error: "Server configuration error: PINECONE_API_KEY missing" });
    }

    if (!process.env.GROQ_API_KEY) {
      console.error("[/api/chat] GROQ_API_KEY is not set");
      return res.status(500).json({ error: "Server configuration error: GROQ_API_KEY missing" });
    }

    // ── Set streaming response headers ────────────────────────────────────────
    res.setHeader("Content-Type", "application/x-ndjson; charset=utf-8");
    res.setHeader("Transfer-Encoding", "chunked");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("X-Accel-Buffering", "no"); // Prevent nginx from buffering

    console.log("[/api/chat] Starting context retrieval...");
    
    // ── Step 1 + 2: Embed question and retrieve relevant Pinecone chunks ──────
    const { context, sources } = await retrieveContext(
      question,
      resolvedIndex,
      resolvedNamespace,
      topK
    );

    console.log("[/api/chat] Context retrieved, sending sources...");
    
    // Send sources to the client before the LLM starts generating
    res.write(JSON.stringify({ type: "sources", sources }) + "\n");

    console.log("[/api/chat] Starting answer stream...");
    
    // ── Step 3 + 4: Stream the Groq answer token by token ────────────────────
    for await (const token of streamAnswer(question, context)) {
      res.write(JSON.stringify({ type: "token", content: token }) + "\n");
    }

    res.write(JSON.stringify({ type: "done" }) + "\n");
    res.end();
    console.log("[/api/chat] Request completed successfully");
  } catch (error: any) {
    console.error("[/api/chat] Error:", error);
    console.error("[/api/chat] Error stack:", error.stack);

    if (!res.headersSent) {
      // Error before streaming started — return normal JSON error
      return res
        .status(500)
        .json({ 
          error: error.message || "Internal server error",
          details: process.env.NODE_ENV === "development" ? error.stack : undefined
        });
    }

    // Error mid-stream — send error event then close
    res.write(
      JSON.stringify({ type: "error", error: error.message || "Stream error" }) +
        "\n"
    );
    res.end();
  }
}
