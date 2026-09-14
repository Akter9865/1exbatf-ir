import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import db from '../db.js';
import { authenticateToken, JWT_SECRET } from '../middleware/authMiddleware.js';

const router = express.Router();

// Admin Login
router.post('/login', (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const user = db.prepare('SELECT * FROM users WHERE LOWER(email) = LOWER(?)').get(email.trim());

    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const isValid = bcrypt.compareSync(password, user.password_hash);
    if (!isValid) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    if (user.status !== 'active') {
      return res.status(403).json({ error: 'This account has been deactivated. Please contact administrator.' });
    }

    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role, name: user.name },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    const { password_hash, ...userWithoutPassword } = user;
    res.json({
      token,
      user: userWithoutPassword
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Internal server error during login' });
  }
});

// Current Authenticated User Profile
router.get('/me', authenticateToken, (req, res) => {
  res.json({ user: req.user });
});

// Update Profile
router.put('/profile', authenticateToken, (req, res) => {
  try {
    const { name, email, avatar_url, current_password, new_password } = req.body;

    if (!name || !email) {
      return res.status(400).json({ error: 'Name and email are required' });
    }

    // Check email collision
    const existing = db.prepare('SELECT id FROM users WHERE LOWER(email) = LOWER(?) AND id != ?').get(email.trim(), req.user.id);
    if (existing) {
      return res.status(400).json({ error: 'Email is already in use by another account' });
    }

    if (new_password) {
      if (!current_password) {
        return res.status(400).json({ error: 'Current password is required to set a new password' });
      }
      const fullUser = db.prepare('SELECT password_hash FROM users WHERE id = ?').get(req.user.id);
      if (!bcrypt.compareSync(current_password, fullUser.password_hash)) {
        return res.status(400).json({ error: 'Current password incorrect' });
      }
      const newHash = bcrypt.hashSync(new_password, 10);
      db.prepare(`
        UPDATE users 
        SET name = ?, email = ?, avatar_url = ?, password_hash = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(name.trim(), email.trim(), avatar_url || null, newHash, req.user.id);
    } else {
      db.prepare(`
        UPDATE users 
        SET name = ?, email = ?, avatar_url = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(name.trim(), email.trim(), avatar_url || null, req.user.id);
    }

    const updatedUser = db.prepare('SELECT id, email, name, role, avatar_url, status FROM users WHERE id = ?').get(req.user.id);
    res.json({ user: updatedUser, message: 'Profile updated successfully' });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

export default router;
