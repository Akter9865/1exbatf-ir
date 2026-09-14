import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const baseUploadDir = path.join(__dirname, '..', 'uploads');

// Ensure subdirectories exist
['images', 'documents', 'audio', 'avatars'].forEach(dir => {
  const fullPath = path.join(baseUploadDir, dir);
  if (!fs.existsSync(fullPath)) {
    fs.mkdirSync(fullPath, { recursive: true });
  }
});

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const mime = file.mimetype.toLowerCase();
    let folder = 'documents';

    if (mime.startsWith('image/')) {
      folder = req.path.includes('avatar') ? 'avatars' : 'images';
    } else if (mime.startsWith('audio/') || file.originalname.endsWith('.wav') || file.originalname.endsWith('.webm') || file.originalname.endsWith('.mp3')) {
      folder = 'audio';
    }

    cb(null, path.join(baseUploadDir, folder));
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname) || (file.mimetype.includes('audio/webm') ? '.webm' : file.mimetype.includes('audio/wav') ? '.wav' : '.bin');
    cb(null, `${uniqueSuffix}${ext}`);
  }
});

const fileFilter = (req, file, cb) => {
  const allowedMimes = [
    // Images
    'image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml',
    // Documents
    'application/pdf', 'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/zip', 'application/x-zip-compressed',
    'text/plain', 'text/csv',
    // Audio
    'audio/webm', 'audio/wav', 'audio/mpeg', 'audio/mp3', 'audio/ogg', 'audio/aac', 'audio/mp4', 'audio/x-m4a'
  ];

  if (allowedMimes.includes(file.mimetype) || file.mimetype.startsWith('audio/')) {
    cb(null, true);
  } else {
    cb(new Error(`File format ${file.mimetype} is not supported. Supported: JPG, PNG, WEBP, GIF, PDF, DOCX, XLSX, ZIP, and Audio files.`));
  }
};

export const upload = multer({
  storage,
  limits: {
    fileSize: 25 * 1024 * 1024 // 25 MB max limit
  },
  fileFilter
});
