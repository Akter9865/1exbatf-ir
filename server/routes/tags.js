import express from 'express';
import db from '../db.js';
import { authenticateToken } from '../middleware/authMiddleware.js';

const router = express.Router();
router.use(authenticateToken);

// List tags with usage counts
router.get('/', (req, res) => {
  try {
    const tags = db.prepare(`
      SELECT t.*, COUNT(ct.contact_id) as contact_count
      FROM tags t
      LEFT JOIN contact_tags ct ON t.id = ct.tag_id
      GROUP BY t.id
      ORDER BY contact_count DESC, t.name ASC
    `).all();

    res.json({ tags });
  } catch (error) {
    console.error('List tags error:', error);
    res.status(500).json({ error: 'Failed to retrieve tags' });
  }
});

// Create tag
router.post('/', (req, res) => {
  try {
    const { name, color = '#10b981' } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Tag name is required' });
    }

    const cleanName = name.trim();
    const existing = db.prepare('SELECT id FROM tags WHERE LOWER(name) = LOWER(?)').get(cleanName);
    if (existing) {
      return res.status(400).json({ error: 'A tag with this name already exists' });
    }

    const id = 'tag_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4);
    db.prepare('INSERT INTO tags (id, name, color) VALUES (?, ?, ?)').run(id, cleanName, color);

    const created = db.prepare('SELECT *, 0 as contact_count FROM tags WHERE id = ?').get(id);
    res.status(201).json({ tag: created });
  } catch (error) {
    console.error('Create tag error:', error);
    res.status(500).json({ error: 'Failed to create tag' });
  }
});

// Update tag
router.put('/:id', (req, res) => {
  try {
    const { id } = req.params;
    const { name, color } = req.body;

    if (name) {
      const existing = db.prepare('SELECT id FROM tags WHERE LOWER(name) = LOWER(?) AND id != ?').get(name.trim(), id);
      if (existing) {
        return res.status(400).json({ error: 'A tag with this name already exists' });
      }
    }

    db.prepare(`
      UPDATE tags 
      SET name = COALESCE(?, name),
          color = COALESCE(?, color)
      WHERE id = ?
    `).run(name ? name.trim() : null, color || null, id);

    const updated = db.prepare(`
      SELECT t.*, COUNT(ct.contact_id) as contact_count
      FROM tags t
      LEFT JOIN contact_tags ct ON t.id = ct.tag_id
      WHERE t.id = ?
      GROUP BY t.id
    `).get(id);

    res.json({ tag: updated });
  } catch (error) {
    console.error('Update tag error:', error);
    res.status(500).json({ error: 'Failed to update tag' });
  }
});

// Delete tag
router.delete('/:id', (req, res) => {
  try {
    const { id } = req.params;
    db.prepare('DELETE FROM tags WHERE id = ?').run(id);
    res.json({ success: true, message: 'Tag deleted successfully' });
  } catch (error) {
    console.error('Delete tag error:', error);
    res.status(500).json({ error: 'Failed to delete tag' });
  }
});

export default router;
