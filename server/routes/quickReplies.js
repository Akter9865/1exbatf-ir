import express from 'express';
import db from '../db.js';
import { authenticateToken } from '../middleware/authMiddleware.js';

const router = express.Router();
router.use(authenticateToken);

// List all quick replies
router.get('/', (req, res) => {
  try {
    const replies = db.prepare('SELECT * FROM quick_replies ORDER BY shortcut ASC').all();
    res.json({ quickReplies: replies });
  } catch (error) {
    console.error('List quick replies error:', error);
    res.status(500).json({ error: 'Failed to retrieve quick replies' });
  }
});

// Create quick reply
router.post('/', (req, res) => {
  try {
    const { shortcut, title, message, attachment_url } = req.body;

    if (!shortcut || !title || !message) {
      return res.status(400).json({ error: 'Shortcut, Title, and Message are required' });
    }

    const cleanShortcut = shortcut.trim().replace(/^\//, '').toLowerCase();
    const existing = db.prepare('SELECT id FROM quick_replies WHERE shortcut = ?').get(cleanShortcut);
    if (existing) {
      return res.status(400).json({ error: `Shortcut "/${cleanShortcut}" is already in use` });
    }

    const id = 'qr_' + Date.now();
    db.prepare(`
      INSERT INTO quick_replies (id, shortcut, title, message, attachment_url)
      VALUES (?, ?, ?, ?, ?)
    `).run(id, cleanShortcut, title.trim(), message.trim(), attachment_url || null);

    const created = db.prepare('SELECT * FROM quick_replies WHERE id = ?').get(id);
    res.status(201).json({ quickReply: created });
  } catch (error) {
    console.error('Create quick reply error:', error);
    res.status(500).json({ error: 'Failed to create quick reply' });
  }
});

// Update quick reply
router.put('/:id', (req, res) => {
  try {
    const { id } = req.params;
    const { shortcut, title, message, attachment_url } = req.body;

    const cleanShortcut = shortcut ? shortcut.trim().replace(/^\//, '').toLowerCase() : null;

    if (cleanShortcut) {
      const existing = db.prepare('SELECT id FROM quick_replies WHERE shortcut = ? AND id != ?').get(cleanShortcut, id);
      if (existing) {
        return res.status(400).json({ error: `Shortcut "/${cleanShortcut}" is already in use` });
      }
    }

    db.prepare(`
      UPDATE quick_replies 
      SET shortcut = COALESCE(?, shortcut),
          title = COALESCE(?, title),
          message = COALESCE(?, message),
          attachment_url = ?
      WHERE id = ?
    `).run(cleanShortcut, title ? title.trim() : null, message ? message.trim() : null, attachment_url || null, id);

    const updated = db.prepare('SELECT * FROM quick_replies WHERE id = ?').get(id);
    res.json({ quickReply: updated });
  } catch (error) {
    console.error('Update quick reply error:', error);
    res.status(500).json({ error: 'Failed to update quick reply' });
  }
});

// Delete quick reply
router.delete('/:id', (req, res) => {
  try {
    const { id } = req.params;
    db.prepare('DELETE FROM quick_replies WHERE id = ?').run(id);
    res.json({ success: true, message: 'Quick reply template deleted' });
  } catch (error) {
    console.error('Delete quick reply error:', error);
    res.status(500).json({ error: 'Failed to delete quick reply' });
  }
});

export default router;
