import { NextApiRequest, NextApiResponse } from "next";
import fs from 'fs'
import path from 'path'

export default async (req: NextApiRequest, res: NextApiResponse) => {
    if (req.method === 'GET') {
        const uploadDir = path.join(process.cwd(), 'uploads');
        
        // Create uploads directory if it doesn't exist
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
            return res.status(200).json([]);
        }
        
        const files = fs.readdirSync(uploadDir);
        res.status(200).json(files);
    }
}