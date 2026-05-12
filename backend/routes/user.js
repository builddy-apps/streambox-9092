import express from 'express';
import db from '../db.js';
import {
  hashPassword,
  comparePassword,
  generateAuthTokens,
  verifyRefreshToken,
  deleteRefreshToken,
  storeRefreshToken,
  authenticate,
  rateLimiter
} from '../auth.js';

const router = express.Router();

// Create missing tables needed for auth and user preferences
db.exec(`
  CREATE TABLE IF NOT EXISTS refresh_tokens (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    token TEXT NOT NULL UNIQUE,
    expires_at TEXT NOT NULL,
    created_at DATETIME DEFAULT (datetime('now')),
    deleted_at TEXT,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS user_preferences (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL UNIQUE,
    preferences TEXT NOT NULL DEFAULT '{}',
    updated_at DATETIME DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );
`);

// POST /api/auth/register - Register new user
router.post('/auth/register', rateLimiter, (req, res) => {
  try {
    const { email, password } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        error: !email ? 'Email is required' : 'Password is required'
      });
    }
    
    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        error: 'Password must be at least 6 characters'
      });
    }
    
    const existingUser = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
    if (existingUser) {
      return res.status(409).json({
        success: false,
        error: 'Email already registered'
      });
    }
    
    const passwordHash = hashPassword(password);
    const insertUser = db.prepare('INSERT INTO users (email, password_hash) VALUES (?, ?)');
    const result = insertUser.run(email, passwordHash);
    
    const user = db.prepare('SELECT id, email, created_at FROM users WHERE id = ?').get(result.lastInsertRowid);
    const { accessToken, refreshToken } = generateAuthTokens(user);
    storeRefreshToken(user.id, refreshToken);
    
    res.json({
      success: true,
      data: { user, accessToken, refreshToken }
    });
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create account'
    });
  }
});

// POST /api/auth/login - Login user
router.post('/auth/login', rateLimiter, (req, res) => {
  try {
    const { email, password } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        error: 'Email and password are required'
      });
    }
    
    const user = db.prepare('SELECT id, email, password_hash FROM users WHERE email = ?').get(email);
    if (!user || !comparePassword(password, user.password_hash)) {
      return res.status(401).json({
        success: false,
        error: 'Invalid email or password'
      });
    }
    
    const userData = { id: user.id, email: user.email };
    const { accessToken, refreshToken } = generateAuthTokens(userData);
    storeRefreshToken(user.id, refreshToken);
    
    res.json({
      success: true,
      data: { user: userData, accessToken, refreshToken }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      error: 'Login failed'
    });
  }
});

// POST /api/auth/refresh - Refresh access token
router.post('/auth/refresh', (req, res) => {
  try {
    const { refreshToken } = req.body;
    
    if (!refreshToken) {
      return res.status(400).json({
        success: false,
        error: 'Refresh token is required'
      });
    }
    
    const userId = verifyRefreshToken(refreshToken);
    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'Invalid or expired refresh token'
      });
    }
    
    const user = db.prepare('SELECT id, email FROM users WHERE id = ?').get(userId);
    if (!user) {
      return res.status(401).json({
        success: false,
        error: 'User not found'
      });
    }
    
    const tokens = generateAuthTokens(user);
    deleteRefreshToken(refreshToken);
    storeRefreshToken(user.id, tokens.refreshToken);
    
    res.json({
      success: true,
      data: tokens
    });
  } catch (error) {
    console.error('Refresh error:', error);
    res.status(500).json({
      success: false,
      error: 'Token refresh failed'
    });
  }
});

// POST /api/auth/logout - Logout user
router.post('/auth/logout', authenticate, (req, res) => {
  try {
    const { refreshToken } = req.body;
    if (refreshToken) deleteRefreshToken(refreshToken);
    res.json({
      success: true,
      data: { message: 'Logged out successfully' }
    });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({
      success: false,
      error: 'Logout failed'
    });
  }
});

// GET /api/user/me - Get current user profile
router.get('/user/me', authenticate, (req, res) => {
  try {
    const user = db.prepare('SELECT id, email, created_at FROM users WHERE id = ?').get(req.user.userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }
    res.json({
      success: true,
      data: { user }
    });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch user'
    });
  }
});

// GET /api/user/favorites - Get user's favorites
router.get('/user/favorites', authenticate, (req, res) => {
  try {
    const favorites = db.prepare(`
      SELECT c.id, c.type, c.title, c.poster_url, c.backdrop_url, 
             c.description, c.rating, c.year, c.genres, c.quality, c.duration,
             f.created_at as added_at
      FROM favorites f
      JOIN content c ON f.content_id = c.id
      WHERE f.user_id = ?
      ORDER BY f.created_at DESC
    `).all(req.user.userId);
    
    res.json({
      success: true,
      data: { favorites }
    });
  } catch (error) {
    console.error('Get favorites error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch favorites'
    });
  }
});

// POST /api/user/favorites - Add content to favorites
router.post('/user/favorites', authenticate, (req, res) => {
  try {
    const { contentId } = req.body;
    
    if (!contentId) {
      return res.status(400).json({
        success: false,
        error: 'Content ID is required'
      });
    }
    
    const content = db.prepare('SELECT id FROM content WHERE id = ?').get(contentId);
    if (!content) {
      return res.status(404).json({
        success: false,
        error: 'Content not found'
      });
    }
    
    db.prepare('INSERT OR IGNORE INTO favorites (user_id, content_id) VALUES (?, ?)').run(req.user.userId, contentId);
    res.json({
      success: true,
      data: { message: 'Added to favorites' }
    });
  } catch (error) {
    console.error('Add favorite error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to add favorite'
    });
  }
});

// DELETE /api/user/favorites/:contentId - Remove from favorites
router.delete('/user/favorites/:contentId', authenticate, (req, res) => {
  try {
    const contentId = parseInt(req.params.contentId);
    
    if (isNaN(contentId)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid content ID'
      });
    }
    
    const result = db.prepare('DELETE FROM favorites WHERE user_id = ? AND content_id = ?').run(req.user.userId, contentId);
    if (result.changes === 0) {
      return res.status(404).json({
        success: false,
        error: 'Favorite not found'
      });
    }
    
    res.json({
      success: true,
      data: { message: 'Removed from favorites' }
    });
  } catch (error) {
    console.error('Remove favorite error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to remove favorite'
    });
  }
});

// GET /api/user/history - Get watch history
router.get('/user/history', authenticate, (req, res) => {
  try {
    const history = db.prepare(`
      SELECT 
        wh.id, wh.progress, wh.duration, wh.last_watched_at, wh.completed,
        c.id as content_id, c.type, c.title, c.poster_url, c.backdrop_url,
        c.description, c.rating, c.year, c.genres, c.quality,
        e.id as episode_id, e.episode_number, e.title as episode_title,
        e.thumbnail_url
      FROM watch_history wh
      JOIN content c ON wh.content_id = c.id
      LEFT JOIN episodes e ON wh.episode_id = e.id
      WHERE wh.user_id = ?
      ORDER BY wh.last_watched_at DESC
    `).all(req.user.userId);
    
    res.json({
      success: true,
      data: { history }
    });
  } catch (error) {
    console.error('Get history error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch history'
    });
  }
});

// POST /api/user/history - Update watch history with progress
router.post('/user/history', authenticate, (req, res) => {
  try {
    const { contentId, episodeId, progress, duration, completed } = req.body;
    
    if (!contentId) {
      return res.status(400).json({
        success: false,
        error: 'Content ID is required'
      });
    }
    
    const content = db.prepare('SELECT id FROM content WHERE id = ?').get(contentId);
    if (!content) {
      return res.status(404).json({
        success: false,
        error: 'Content not found'
      });
    }
    
    if (episodeId) {
      const episode = db.prepare('SELECT id FROM episodes WHERE id = ?').get(episodeId);
      if (!episode) {
        return res.status(404).json({
          success: false,
          error: 'Episode not found'
        });
      }
    }
    
    let isCompleted = completed || 0;
    if (progress && duration && !completed) {
      isCompleted = progress >= duration * 0.9 ? 1 : 0;
    }
    
    const existing = db.prepare(`
      SELECT id FROM watch_history 
      WHERE user_id = ? AND content_id = ? AND (episode_id = ? OR (episode_id IS NULL AND ? IS NULL))
    `).get(req.user.userId, contentId, episodeId || null, episodeId || null);
    
    if (existing) {
      db.prepare(`
        UPDATE watch_history 
        SET progress = ?, duration = ?, completed = ?, last_watched_at = datetime('now')
        WHERE id = ?
      `).run(progress || 0, duration || null, isCompleted, existing.id);
    } else {
      db.prepare(`
        INSERT INTO watch_history (user_id, content_id, episode_id, progress, duration, completed, last_watched_at)
        VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
      `).run(req.user.userId, contentId, episodeId || null, progress || 0, duration || null, isCompleted);
    }
    
    res.json({
      success: true,
      data: { message: 'Watch history updated' }
    });
  } catch (error) {
    console.error('Update history error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update history'
    });
  }
});

// DELETE /api/user/history/:contentId - Remove from watch history
router.delete('/user/history/:contentId', authenticate, (req, res) => {
  try {
    const contentId = parseInt(req.params.contentId);
    
    if (isNaN(contentId)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid content ID'
      });
    }
    
    const result = db.prepare('DELETE FROM watch_history WHERE user_id = ? AND content_id = ?').run(req.user.userId, contentId);
    if (result.changes === 0) {
      return res.status(404).json({
        success: false,
        error: 'History entry not found'
      });
    }
    
    res.json({
      success: true,
      data: { message: 'Removed from history' }
    });
  } catch (error) {
    console.error('Remove history error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to remove from history'
    });
  }
});

// GET /api/user/preferences - Get user preferences
router.get('/user/preferences', authenticate, (req, res) => {
  try {
    const prefs = db.prepare('SELECT preferences FROM user_preferences WHERE user_id = ?').get(req.user.userId);
    let preferences = prefs ? JSON.parse(prefs.preferences) : {};
    res.json({
      success: true,
      data: { preferences }
    });
  } catch (error) {
    console.error('Get preferences error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch preferences'
    });
  }
});

// PUT /api/user/preferences - Update user preferences
router.put('/user/preferences', authenticate, (req, res) => {
  try {
    const { preferences } = req.body;
    
    if (!preferences || typeof preferences !== 'object') {
      return res.status(400).json({
        success: false,
        error: 'Invalid preferences object'
      });
    }
    
    const prefsJson = JSON.stringify(preferences);
    db.prepare(`
      INSERT INTO user_preferences (user_id, preferences, updated_at)
      VALUES (?, ?, datetime('now'))
      ON CONFLICT(user_id) DO UPDATE SET
        preferences = excluded.preferences,
        updated_at = excluded.updated_at
    `).run(req.user.userId, prefsJson);
    
    res.json({
      success: true,
      data: { preferences }
    });
  } catch (error) {
    console.error('Update preferences error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update preferences'
    });
  }
});

export default router;