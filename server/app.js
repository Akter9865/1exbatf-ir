import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

import { initDB } from './db.js';
import { baseUploadDir } from './middleware/uploadMiddleware.js';

// Route handlers
import authRoutes from './routes/auth.js';
import chatRoutes from './routes/chat.js';
import conversationsRoutes from './routes/conversations.js';
import messagesRoutes from './routes/messages.js';
import contactsRoutes from './routes/contacts.js';
import pipelineRoutes from './routes/pipeline.js';
import quickRepliesRoutes from './routes/quickReplies.js';
import automationsRoutes from './routes/automations.js';
import tagsRoutes from './routes/tags.js';
import agentsRoutes from './routes/agents.js';
import exportRoutes from './routes/export.js';
import dashboardRoutes from './routes/dashboard.js';
import settingsRoutes from './routes/settings.js';
import uploadRoutes from './routes/upload.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize DB schema & seed default admin/settings
initDB();

const app = express();

// Middlewares
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-visitor-session']
}));

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Serve uploaded static files from baseUploadDir
app.use('/uploads', express.static(baseUploadDir));

// Health check handler
const healthCheck = (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'WhatsApp CRM Backend',
    environment: process.env.VERCEL ? 'vercel-serverless' : 'node-server'
  });
};

app.get('/api/health', healthCheck);
app.get('/health', healthCheck);

// Register routes with both /api prefix and root prefix
// to ensure seamless compatibility with Vercel rewrites & standalone Node
const routeTable = [
  ['/auth', authRoutes],
  ['/chat', chatRoutes],
  ['/conversations', conversationsRoutes],
  ['/messages', messagesRoutes],
  ['/contacts', contactsRoutes],
  ['/pipeline', pipelineRoutes],
  ['/quick-replies', quickRepliesRoutes],
  ['/automations', automationsRoutes],
  ['/tags', tagsRoutes],
  ['/agents', agentsRoutes],
  ['/export', exportRoutes],
  ['/dashboard', dashboardRoutes],
  ['/settings', settingsRoutes],
  ['/upload', uploadRoutes],
];

routeTable.forEach(([subPath, router]) => {
  app.use(`/api${subPath}`, router);
  app.use(subPath, router);
});

// JSON fallback for any unhandled API route (prevents returning HTML)
app.use('/api/*', (req, res) => {
  res.status(404).json({
    error: `API endpoint not found: ${req.method} ${req.originalUrl || req.url}`
  });
});

// Global Error Handler
app.use((err, req, res, next) => {
  console.error('Unhandled API Error:', err);
  res.status(err.status || 500).json({
    error: err.message || 'Internal Server Error'
  });
});

export default app;
