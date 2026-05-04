import { NextApiRequest, NextApiResponse } from "next";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  try {
    const health = {
      status: "ok",
      timestamp: new Date().toISOString(),
      environment: {
        nodeEnv: process.env.NODE_ENV,
        hasPineconeKey: !!process.env.PINECONE_API_KEY,
        hasGroqKey: !!process.env.GROQ_API_KEY,
        pineconeIndex: process.env.PINECONE_INDEX_NAME || "not set",
        pineconeNamespace: process.env.PINECONE_NAMESPACE || "not set",
      },
      memory: {
        heapUsed: Math.round(process.memoryUsage().heapUsed / 1024 / 1024) + " MB",
        heapTotal: Math.round(process.memoryUsage().heapTotal / 1024 / 1024) + " MB",
        rss: Math.round(process.memoryUsage().rss / 1024 / 1024) + " MB",
      },
    };

    return res.status(200).json(health);
  } catch (error: any) {
    return res.status(500).json({
      status: "error",
      error: error.message,
    });
  }
}
