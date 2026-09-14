import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import db from '../db.js';
import { authenticateToken, requireRole } from '../middleware/authMiddleware.js';
import { testSupabaseConnection, getSupabaseConfig, initSupabase } from '../supabase.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = express.Router();
router.use(authenticateToken);

// 1. Get all system settings
router.get('/', (req, res) => {
  try {
    const rows = db.prepare('SELECT key, value FROM settings').all();
    const settings = rows.reduce((acc, r) => {
      acc[r.key] = r.value;
      return acc;
    }, {});

    const leadSources = db.prepare('SELECT * FROM lead_sources ORDER BY name ASC').all();
    const { url, key } = getSupabaseConfig();

    res.json({
      settings,
      leadSources,
      supabase: {
        url,
        hasKey: Boolean(key),
        keyMasked: key ? `${key.substring(0, 10)}...${key.substring(key.length - 6)}` : ''
      }
    });
  } catch (error) {
    console.error('Get settings error:', error);
    res.status(500).json({ error: 'Failed to retrieve settings' });
  }
});

// 2. Update Settings (Admin or Super Admin only)
router.put('/', requireRole(['super_admin', 'admin']), (req, res) => {
  try {
    const updates = req.body; // e.g. { brand_name: "Guru Anna", agent_name: "Akter", ... }

    const updateStmt = db.prepare('INSERT OR REPLACE INTO settings (key, value, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP)');

    for (const [key, value] of Object.entries(updates)) {
      if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
        updateStmt.run(key, String(value));
      }
    }

    const rows = db.prepare('SELECT key, value FROM settings').all();
    const settings = rows.reduce((acc, r) => {
      acc[r.key] = r.value;
      return acc;
    }, {});

    res.json({ settings, message: 'Settings saved successfully' });
  } catch (error) {
    console.error('Update settings error:', error);
    res.status(500).json({ error: 'Failed to update settings' });
  }
});

// 3. Add Lead Source
router.post('/lead-sources', requireRole(['super_admin', 'admin']), (req, res) => {
  try {
    const { name } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Lead source name is required' });
    }

    const id = 'src_' + Date.now();
    db.prepare('INSERT OR IGNORE INTO lead_sources (id, name) VALUES (?, ?)').run(id, name.trim());

    const sources = db.prepare('SELECT * FROM lead_sources ORDER BY name ASC').all();
    res.json({ leadSources: sources });
  } catch (error) {
    console.error('Add lead source error:', error);
    res.status(500).json({ error: 'Failed to add lead source' });
  }
});

// 4. Delete Lead Source
router.delete('/lead-sources/:id', requireRole(['super_admin', 'admin']), (req, res) => {
  try {
    const { id } = req.params;
    db.prepare('DELETE FROM lead_sources WHERE id = ?').run(id);
    const sources = db.prepare('SELECT * FROM lead_sources ORDER BY name ASC').all();
    res.json({ leadSources: sources });
  } catch (error) {
    console.error('Delete lead source error:', error);
    res.status(500).json({ error: 'Failed to delete lead source' });
  }
});

// 5. Test Supabase Connection
router.post('/supabase/test', requireRole(['super_admin', 'admin']), async (req, res) => {
  try {
    const { url, key } = req.body;
    const result = await testSupabaseConnection(url, key);
    res.json(result);
  } catch (error) {
    res.status(500).json({
      connected: false,
      message: error.message || 'Error testing Supabase connection'
    });
  }
});

// 6. Save Supabase Configuration
router.post('/supabase/save', requireRole(['super_admin', 'admin']), async (req, res) => {
  try {
    const { url, key } = req.body;

    if (!url || !key) {
      return res.status(400).json({ error: 'Supabase URL and API Key are required' });
    }

    // Save to settings table
    const updateStmt = db.prepare('INSERT OR REPLACE INTO settings (key, value, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP)');
    updateStmt.run('supabase_url', url.trim());
    updateStmt.run('supabase_key', key.trim());

    // Update .env file
    const envPath = path.join(__dirname, '..', '..', '.env');
    let envContent = fs.existsSync(envPath) ? fs.readFileSync(envPath, 'utf-8') : '';

    const replaceOrAppend = (keyName, val) => {
      const regex = new RegExp(`^${keyName}=.*$`, 'm');
      if (regex.test(envContent)) {
        envContent = envContent.replace(regex, `${keyName}=${val}`);
      } else {
        envContent += `\n${keyName}=${val}`;
      }
    };

    replaceOrAppend('VITE_SUPABASE_URL', url.trim());
    replaceOrAppend('VITE_SUPABASE_ANON_KEY', key.trim());
    replaceOrAppend('SUPABASE_SERVICE_ROLE_KEY', key.trim());

    fs.writeFileSync(envPath, envContent.trim() + '\n', 'utf-8');

    // Update process.env in memory
    process.env.VITE_SUPABASE_URL = url.trim();
    process.env.VITE_SUPABASE_ANON_KEY = key.trim();
    process.env.SUPABASE_SERVICE_ROLE_KEY = key.trim();

    initSupabase();

    const testResult = await testSupabaseConnection(url.trim(), key.trim());

    res.json({
      success: true,
      message: 'Supabase credentials saved and environment updated successfully!',
      testResult
    });
  } catch (error) {
    console.error('Save Supabase error:', error);
    res.status(500).json({ error: 'Failed to save Supabase credentials' });
  }
});

// 7. Get Supabase Schema SQL Content for 1-Click Copy
router.get('/supabase/sql', requireRole(['super_admin', 'admin']), (req, res) => {
  try {
    const sqlPath = path.join(__dirname, '..', '..', 'supabase_schema.sql');
    if (fs.existsSync(sqlPath)) {
      const sqlContent = fs.readFileSync(sqlPath, 'utf-8');
      res.json({ sql: sqlContent });
    } else {
      res.status(404).json({ error: 'supabase_schema.sql not found' });
    }
  } catch (error) {
    res.status(500).json({ error: 'Failed to read schema SQL' });
  }
});

export default router;
