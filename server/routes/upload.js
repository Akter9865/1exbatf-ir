import express from 'express';
import { upload } from '../middleware/uploadMiddleware.js';

const router = express.Router();

// Upload Single File (Image, Document, Voice Audio)
router.post('/', (req, res) => {
  upload.single('file')(req, res, (err) => {
    if (err) {
      console.error('File upload error:', err);
      return res.status(400).json({ error: err.message || 'File upload failed' });
    }

    if (!req.file) {
      return res.status(400).json({ error: 'No file provided' });
    }

    const mime = req.file.mimetype.toLowerCase();
    let fileType = 'document';

    if (mime.startsWith('image/')) {
      fileType = 'image';
    } else if (mime.startsWith('audio/') || req.file.filename.endsWith('.webm') || req.file.filename.endsWith('.wav') || req.file.filename.endsWith('.mp3')) {
      fileType = 'audio';
    }

    // Relative path served via static express
    const folder = fileType === 'image' 
      ? (req.path.includes('avatar') ? 'avatars' : 'images')
      : fileType === 'audio' 
      ? 'audio' 
      : 'documents';

    const fileUrl = `/uploads/${folder}/${req.file.filename}`;

    res.json({
      file_name: req.file.originalname,
      file_url: fileUrl,
      file_type: fileType,
      file_size: req.file.size,
      mime_type: req.file.mimetype
    });
  });
});

export default router;
