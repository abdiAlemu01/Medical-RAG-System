import { NextApiRequest, NextApiResponse } from "next";
import formidable, { File } from "formidable";
import fs from "fs";
import path from "path";

export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const uploadDir = path.join(process.cwd(), "uploads");
  
  // Create uploads directory if it doesn't exist
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
  }

  const form = formidable({
    uploadDir,
    keepExtensions: true,
    maxFileSize: 50 * 1024 * 1024, // 50MB
    filename: (name, ext, part) => {
      return `${Date.now()}_${part.originalFilename}`;
    },
  });

  try {
    const [fields, files] = await form.parse(req);
    const uploadedFiles = (files.files || []) as File[];
    
    const fileList = uploadedFiles.map((file: File) => ({
      filename: file.originalFilename,
      path: file.filepath,
      size: file.size,
    }));

    res.status(200).json({ 
      success: true, 
      files: fileList,
      message: `${fileList.length} file(s) uploaded successfully` 
    });
  } catch (error) {
    console.error("Upload error:", error);
    res.status(500).json({ error: "File upload failed" });
  }
}
