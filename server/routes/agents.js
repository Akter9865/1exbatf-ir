import express from 'express';
import bcrypt from 'bcryptjs';
import db from '../db.js';
import { authenticateToken, requireRole } from '../middleware/authMiddleware.js';

const router = express.Router();
router.use(authenticateToken);

// 1. List all agents
router.get('/', (req, res) => {
  try {
    const agents = db.prepare(`
      SELECT 
        u.id, u.email, u.name, u.role, u.avatar_url, u.status, u.created_at,
        (
          SELECT COUNT(*) FROM conversations c 
          WHERE c.assigned_agent_id = u.id AND c.status = 'open'
        ) as active_conversations_count,
        (
          SELECT COUNT(*) FROM contacts ct 
          WHERE ct.assigned_agent_id = u.id
        ) as total_contacts_count
      FROM users u
      ORDER BY u.created_at ASC
    `).all();

    res.json({ agents });
  } catch (error) {
    console.error('List agents error:', error);
    res.status(500).json({ error: 'Failed to retrieve agents' });
  }
});

// 2. Create Agent (Admins and Super Admins only)
router.post('/', requireRole(['super_admin', 'admin']), (req, res) => {
  try {
    const { email, password, name, role = 'agent', avatar_url, status = 'active' } = req.body;

    if (!email || !password || !name) {
      return res.status(400).json({ error: 'Email, password, and name are required' });
    }

    const existing = db.prepare('SELECT id FROM users WHERE LOWER(email) = LOWER(?)').get(email.trim());
    if (existing) {
      return res.status(400).json({ error: 'An account with this email already exists' });
    }

    // Only Super Admin can create Super Admins
    const finalRole = (role === 'super_admin' && req.user.role !== 'super_admin') ? 'admin' : role;

    const id = 'usr_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4);
    const salt = bcrypt.genSaltSync(10);
    const passwordHash = bcrypt.hashSync(password, salt);

    db.prepare(`
      INSERT INTO users (id, email, password_hash, name, role, avatar_url, status)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(id, email.trim().toLowerCase(), passwordHash, name.trim(), finalRole, avatar_url || null, status);

    const created = db.prepare('SELECT id, email, name, role, avatar_url, status, created_at FROM users WHERE id = ?').get(id);
    res.status(201).json({ agent: created });
  } catch (error) {
    console.error('Create agent error:', error);
    res.status(500).json({ error: 'Failed to create agent' });
  }
});

// 3. Update Agent
router.put('/:id', requireRole(['super_admin', 'admin']), (req, res) => {
  try {
    const { id } = req.params;
    const { name, email, role, status, avatar_url, new_password } = req.body;

    if (email) {
      const existing = db.prepare('SELECT id FROM users WHERE LOWER(email) = LOWER(?) AND id != ?').get(email.trim(), id);
      if (existing) {
        return res.status(400).json({ error: 'An account with this email already exists' });
      }
    }

    // Role safety: normal Admin cannot promote to Super Admin
    let safeRole = role;
    if (role === 'super_admin' && req.user.role !== 'super_admin') {
      safeRole = undefined;
    }

    if (new_password && new_password.trim()) {
      const newHash = bcrypt.hashSync(new_password.trim(), 10);
      db.prepare(`
        UPDATE users 
        SET name = COALESCE(?, name),
            email = COALESCE(?, email),
            role = COALESCE(?, role),
            status = COALESCE(?, status),
            avatar_url = COALESCE(?, avatar_url),
            password_hash = ?,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(
        name ? name.trim() : null,
        email ? email.trim().toLowerCase() : null,
        safeRole || null,
        status || null,
        avatar_url || null,
        newHash,
        id
      );
    } else {
      db.prepare(`
        UPDATE users 
        SET name = COALESCE(?, name),
            email = COALESCE(?, email),
            role = COALESCE(?, role),
            status = COALESCE(?, status),
            avatar_url = COALESCE(?, avatar_url),
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(
        name ? name.trim() : null,
        email ? email.trim().toLowerCase() : null,
        safeRole || null,
        status || null,
        avatar_url || null,
        id
      );
    }

    const updated = db.prepare('SELECT id, email, name, role, avatar_url, status, created_at FROM users WHERE id = ?').get(id);
    res.json({ agent: updated });
  } catch (error) {
    console.error('Update agent error:', error);
    res.status(500).json({ error: 'Failed to update agent' });
  }
});

// 4. Delete Agent
router.delete('/:id', requireRole(['super_admin']), (req, res) => {
  try {
    const { id } = req.params;

    if (id === req.user.id) {
      return res.status(400).json({ error: 'You cannot delete your own account' });
    }

    db.prepare('DELETE FROM users WHERE id = ?').run(id);
    res.json({ success: true, message: 'Agent deleted successfully' });
  } catch (error) {
    console.error('Delete agent error:', error);
    res.status(500).json({ error: 'Failed to delete agent' });
  }
});

export default router;
