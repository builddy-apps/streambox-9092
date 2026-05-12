import express from 'express';
import db from '../db.js';
import { hashPassword, verifyPassword, generateAuthTokens, authenticateToken } from '../auth.js';

const router = express.Router();

// POST /api/auth/register
router.post('/auth/register', async (req, res) => {
    try {
        const { email, password, name } = req.body;

        if (!email || !password) {
            return res.status(400).json({ success: false, error: 'Email and password are required' });
        }

        if (password.length < 6) {
            return res.status(400).json({ success: false, error: 'Password must be at least 6 characters' });
        }

        const existingUser = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
        if (existingUser) {
            return res.status(409).json({ success: false, error: 'Email already registered' });
        }

        const passwordHash = await hashPassword(password);

        const stmt = db.prepare(`
            INSERT INTO users (email, password_hash, name)
            VALUES (?, ?, ?)
        `);
        const result = stmt.run(email, passwordHash, name || null);

        const tokens = generateAuthTokens(result.lastInsertRowid);

        res.status(201).json({
            success: true,
            data: {
                userId: result.lastInsertRowid,
                email,
                name: name || null,
                ...tokens
            }
        });
    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({ success: false, error: 'Registration failed' });
    }
});

// POST /api/auth/login
router.post('/auth/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ success: false, error: 'Email and password are required' });
        }

        const user = db.prepare('SELECT id, password_hash FROM users WHERE email = ?').get(email);
        if (!user) {
            return res.status(401).json({ success: false, error: 'Invalid credentials' });
        }

        const isValidPassword = await verifyPassword(password, user.password_hash);
        if (!isValidPassword) {
            return res.status(401).json({ success: false, error: 'Invalid credentials' });
        }

        const tokens = generateAuthTokens(user.id);
        const userInfo = db.prepare('SELECT id, email, name FROM users WHERE id = ?').get(user.id);

        res.json({
            success: true,
            data: {
                ...userInfo,
                ...tokens
            }
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ success: false, error: 'Login failed' });
    }
});

// POST /api/auth/refresh
router.post('/auth/refresh', (req, res) => {
    try {
        const { refreshToken } = req.body;

        if (!refreshToken) {
            return res.status(400).json({ success: false, error: 'Refresh token is required' });
        }

        const tokenRecord = db.prepare('SELECT * FROM refresh_tokens WHERE token = ?').get(refreshToken);
        if (!tokenRecord) {
            return res.status(401).json({ success: false, error: 'Invalid refresh token' });
        }

        const expiresAt = new Date(tokenRecord.expires_at);
        if (expiresAt <= new Date()) {
            return res.status(401).json({ success: false, error: 'Refresh token expired' });
        }

        const newTokens = generateAuthTokens(tokenRecord.user_id);

        res.json({
            success: true,
            data: newTokens
        });
    } catch (error) {
        console.error('Token refresh error:', error);
        res.status(500).json({ success: false, error: 'Token refresh failed' });
    }
});

// GET /api/user/favorites
router.get('/user/favorites', authenticateToken, (req, res) => {
    try {
        const favorites = db.prepare(`
            SELECT c.* FROM favorites f
            JOIN content c ON f.content_id = c.id
            WHERE f.user_id = ?
            ORDER BY f.created_at DESC
        `).all(req.user.id);

        res.json({ success: true, data: favorites });
    } catch (error) {
        console.error('Error fetching favorites:', error);
        res.status(500).json({ success: false, error: 'Failed to fetch favorites' });
    }
});

// POST /api/user/favorites
router.post('/user/favorites', authenticateToken, (req, res) => {
    try {
        const { contentId } = req.body;

        if (!contentId) {
            return res.status(400).json({ success: false, error: 'Content ID is required' });
        }

        const existingFavorite = db.prepare(
            'SELECT id FROM favorites WHERE user_id = ? AND content_id = ?'
        ).get(req.user.id, contentId);

        if (existingFavorite) {
            return res.status(409).json({ success: false, error: 'Content already in favorites' });
        }

        const stmt = db.prepare(
            'INSERT INTO favorites (user_id, content_id) VALUES (?, ?)'
        );
        const result = stmt.run(req.user.id, contentId);

        res.status(201).json({
            success: true,
            data: { id: result.lastInsertRowid }
        });
    } catch (error) {
        console.error('Error adding favorite:', error);
        res.status(500).json({ success: false, error: 'Failed to add favorite' });
    }
});

// DELETE /api/user/favorites/:id
router.delete('/user/favorites/:id', authenticateToken, (req, res) => {
    try {
        const { id } = req.params;

        const stmt = db.prepare(
            'DELETE FROM favorites WHERE id = ? AND user_id = ?'
        );
        const result = stmt.run(id, req.user.id);

        if (result.changes === 0) {
            return res.status(404).json({ success: false, error: 'Favorite not found' });
        }

        res.json({ success: true });
    } catch (error) {
        console.error('Error removing favorite:', error);
        res.status(500).json({ success: false, error: 'Failed to remove favorite' });
    }
});

// GET /api/user/history
router.get('/user/history', authenticateToken, (req, res) => {
    try {
        const history = db.prepare(`
            SELECT c.*, wh.progress, wh.completed, wh.created_at as watched_at, 
                   s.title as season_title, e.title as episode_title, 
                   e.episode_number, e.season_id
            FROM watch_history wh
            LEFT JOIN content c ON wh.content_id = c.id OR (wh.episode_id IS NOT NULL AND wh.content_id = (SELECT content_id FROM episodes WHERE id = wh.episode_id))
            LEFT JOIN episodes e ON wh.episode_id = e.id
            LEFT JOIN seasons s ON e.season_id = s.id
            WHERE wh.user_id = ?
            ORDER BY wh.created_at DESC
        `).all(req.user.id);

        res.json({ success: true, data: history });
    } catch (error) {
        console.error('Error fetching history:', error);
        res.status(500).json({ success: false, error: 'Failed to fetch history' });
    }
});

// GET /api/user/continue-watching
router.get('/user/continue-watching', authenticateToken, (req, res) => {
    try {
        const continueWatching = db.prepare(`
            SELECT c.*, wh.progress, wh.completed, wh.created_at as watched_at,
                   s.title as season_title, e.title as episode_title, 
                   e.episode_number, e.season_id
            FROM watch_history wh
            LEFT JOIN content c ON wh.content_id = c.id OR (wh.episode_id IS NOT NULL AND wh.content_id = (SELECT content_id FROM episodes WHERE id = wh.episode_id))
            LEFT JOIN episodes e ON wh.episode_id = e.id
            LEFT JOIN seasons s ON e.season_id = s.id
            WHERE wh.user_id = ? AND wh.completed = 0
            ORDER BY wh.created_at DESC
            LIMIT 20
        `).all(req.user.id);

        res.json({ success: true, data: continueWatching });
    } catch (error) {
        console.error('Error fetching continue watching:', error);
        res.status(500).json({ success: false, error: 'Failed to fetch continue watching' });
    }
});

// POST /api/user/progress
router.post('/user/progress', authenticateToken, (req, res) => {
    try {
        const { contentId, episodeId, progress, completed } = req.body;

        if (!contentId || progress === undefined) {
            return res.status(400).json({ 
                success: false, 
                error: 'Content ID and progress are required' 
            });
        }

        const existingRecord = db.prepare(`
            SELECT id FROM watch_history 
            WHERE user_id = ? AND content_id = ? AND (episode_id IS NULL OR episode_id = ?)
        `).get(req.user.id, contentId, episodeId || null);

        if (existingRecord) {
            const stmt = db.prepare(`
                UPDATE watch_history 
                SET progress = ?, completed = ?, created_at = datetime('now')
                WHERE id = ?
            `);
            stmt.run(progress, completed ? 1 : 0, existingRecord.id);
        } else {
            const stmt = db.prepare(`
                INSERT INTO watch_history (user_id, content_id, episode_id, progress, completed)
                VALUES (?, ?, ?, ?, ?)
            `);
            stmt.run(req.user.id, contentId, episodeId || null, progress, completed ? 1 : 0);
        }

        res.json({ success: true });
    } catch (error) {
        console.error('Error updating progress:', error);
        res.status(500).json({ success: false, error: 'Failed to update progress' });
    }
});

// GET /api/user/extensions
router.get('/user/extensions', authenticateToken, (req, res) => {
    try {
        const extensions = db.prepare(`
            SELECT * FROM extensions
            ORDER BY name
        `).all();

        res.json({ success: true, data: extensions });
    } catch (error) {
        console.error('Error fetching extensions:', error);
        res.status(500).json({ success: false, error: 'Failed to fetch extensions' });
    }
});

// PUT /api/user/extensions/:id
router.put('/user/extensions/:id', authenticateToken, (req, res) => {
    try {
        const { id } = req.params;
        const { enabled } = req.body;

        if (enabled === undefined) {
            return res.status(400).json({ 
                success: false, 
                error: 'Enabled status is required' 
            });
        }

        const stmt = db.prepare(`
            UPDATE extensions
            SET enabled = ?
            WHERE id = ?
        `);
        const result = stmt.run(enabled ? 1 : 0, id);

        if (result.changes === 0) {
            return res.status(404).json({ success: false, error: 'Extension not found' });
        }

        res.json({ success: true });
    } catch (error) {
        console.error('Error updating extension:', error);
        res.status(500).json({ success: false, error: 'Failed to update extension' });
    }
});

// POST /api/user/logout
router.post('/user/logout', authenticateToken, (req, res) => {
    try {
        const { refreshToken } = req.body;
        
        if (refreshToken) {
            const stmt = db.prepare(
                'DELETE FROM refresh_tokens WHERE token = ?'
            );
            stmt.run(refreshToken);
        }

        res.json({ success: true });
    } catch (error) {
        console.error('Logout error:', error);
        res.status(500).json({ success: false, error: 'Logout failed' });
    }
});

export default router;