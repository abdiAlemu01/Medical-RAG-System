
import { Pinecone } from "@pinecone-database/pinecone";
import { FeatureExtractionPipeline, pipeline } from "@xenova/transformers";
import { ChatGroq } from "@langchain/groq";
import { HumanMessage, SystemMessage } from "@langchain/core/messages";


let _extractor: FeatureExtractionPipeline | null = null;

async function getExtractor(): Promise<FeatureExtractionPipeline> {
  if (!_extractor) {
    try {
      console.log("[RAG] Loading embedding model...");
      _extractor = (await pipeline(
        "feature-extraction",
        "mixedbread-ai/mxbai-embed-large-v1",
        { quantized: true } // Use quantized model to reduce memory usage
      )) as FeatureExtractionPipeline;
      console.log("[RAG] Embedding model loaded successfully");
    } catch (error) {
      console.error("[RAG] Failed to load embedding model:", error);
      throw new Error("Failed to initialize embedding model. This may be due to memory constraints.");
    }
  }
  return _extractor;
}

export interface Source {
  id: string;
  chunk: string;
}

export interface RetrievedContext {
  context: string;
  sources: Source[];
}


export async function getEmbedding(text: string): Promise<number[]> {
  try {
    const extractor = await getExtractor();
    const output = await extractor([text.replace(/\n/g, " ")], { pooling: "cls" });
    return output.tolist()[0] as number[];
  } catch (error) {
    console.error("[RAG] Error generating embedding:", error);
    throw new Error("Failed to generate text embedding");
  }
}


export async function retrieveContext(
  query: string,
  indexName: string,
  namespace: string,
  topK: number = 5
): Promise<RetrievedContext> {
  try {
    console.log("[RAG] Generating embedding for query...");
    const embedding = await getEmbedding(query);

    console.log("[RAG] Connecting to Pinecone...");
    if (!process.env.PINECONE_API_KEY) {
      throw new Error("PINECONE_API_KEY environment variable is not set");
    }
    
    const client = new Pinecone({ apiKey: process.env.PINECONE_API_KEY });
    const index = client.Index(indexName).namespace(namespace);

    console.log(`[RAG] Querying Pinecone index: ${indexName}, namespace: ${namespace}`);
    const result = await index.query({
      vector: embedding,
      topK,
      includeMetadata: true,
    });

    const sources: Source[] = (result.matches ?? []).map((match) => ({
      id: match.id,
      chunk: (match.metadata?.chunk as string) ?? "",
    }));

    console.log(`[RAG] Retrieved ${sources.length} sources`);

    if (sources.length === 0) {
      return {
        context: "No relevant information found in the knowledge base.",
        sources: [],
      };
    }

    // Combine chunks into a single context string separated by dividers
    const context = sources.map((s) => s.chunk).join("\n\n---\n\n");
    return { context, sources };
  } catch (error) {
    console.error("[RAG] Error in retrieveContext:", error);
    throw error;
  }
}


export async function* streamAnswer(
  question: string,
  context: string
): AsyncGenerator<string> {
  try {
    console.log("[RAG] Initializing Groq LLM...");
    if (!process.env.GROQ_API_KEY) {
      throw new Error("GROQ_API_KEY environment variable is not set");
    }

    const llm = new ChatGroq({
      apiKey: process.env.GROQ_API_KEY,
      model: "llama-3.3-70b-versatile",
      temperature: 0.5,
    });

    const systemPrompt = `You are MediScan AI, a precise medical knowledge assistant.
Your answers must be grounded exclusively in the context extracted from medical documents provided below.

STRICT RULES:
1. Answer ONLY using information present in the context. Do NOT use outside knowledge.
2. If the answer is not found in the context, respond with exactly:
   "I don't have enough information in my knowledge base to answer that question."
3. Be clear, structured, and use appropriate medical terminology.
4. When citing specific facts, be precise and concise.
5. Always clarify that answers are for educational purposes and not a substitute for professional medical advice.

--- CONTEXT START ---
${context}
--- CONTEXT END ---`;

    console.log("[RAG] Starting LLM stream...");
    const stream = await llm.stream([
      new SystemMessage(systemPrompt),
      new HumanMessage(question),
    ]);

    for await (const chunk of stream) {
      const content = chunk.content as string;
      if (content) yield content;
    }
    console.log("[RAG] Stream completed");
  } catch (error) {
    console.error("[RAG] Error in streamAnswer:", error);
    throw error;
  }
}
