import { NextApiRequest, NextApiResponse } from "next";
import fs from 'fs'
import path from 'path'

async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method === 'GET') {
        const uploadDir = process.env.NODE_ENV === 'production' 
            ? '/opt/render/project/src/uploads'
            : path.join(process.cwd(), 'uploads');
        
        // Create uploads directory if it doesn't exist
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
            return res.status(200).json([]);
        }
        
        const files = fs.readdirSync(uploadDir);
        res.status(200).json(files);
    }
}

export default handler;