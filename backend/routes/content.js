import express from 'express';
import db from '../db.js';

const router = express.Router();

// GET /api/content/trending - Get trending content
router.get('/trending', (req, res) => {
    try {
        const trending = db.prepare(`
            SELECT * FROM content 
            ORDER BY rating DESC, created_at DESC 
            LIMIT 20
        `).all();
        res.json({ success: true, data: trending });
    } catch (err) {
        console.error('Error fetching trending content:', err);
        res.status(500).json({ success: false, error: 'Failed to fetch trending content' });
    }
});

// GET /api/content/movies - Get movies
router.get('/movies', (req, res) => {
    try {
        const movies = db.prepare(`
            SELECT * FROM content 
            WHERE type = 'movie'
            ORDER BY rating DESC
        `).all();
        res.json({ success: true, data: movies });
    } catch (err) {
        console.error('Error fetching movies:', err);
        res.status(500).json({ success: false, error: 'Failed to fetch movies' });
    }
});

// GET /api/content/series - Get series
router.get('/series', (req, res) => {
    try {
        const series = db.prepare(`
            SELECT * FROM content 
            WHERE type = 'series'
            ORDER BY rating DESC
        `).all();
        res.json({ success: true, data: series });
    } catch (err) {
        console.error('Error fetching series:', err);
        res.status(500).json({ success: false, error: 'Failed to fetch series' });
    }
});

// GET /api/content/anime - Get anime
router.get('/anime', (req, res) => {
    try {
        const anime = db.prepare(`
            SELECT * FROM content 
            WHERE type = 'anime'
            ORDER BY rating DESC
        `).all();
        res.json({ success: true, data: anime });
    } catch (err) {
        console.error('Error fetching anime:', err);
        res.status(500).json({ success: false, error: 'Failed to fetch anime' });
    }
});

// GET /api/content/search - Search with filters
router.get('/search', (req, res) => {
    try {
        const { q, genre, year, quality } = req.query;
        
        let query = 'SELECT * FROM content WHERE 1=1';
        const params = [];
        
        if (q) {
            query += ' AND (title LIKE ? OR description LIKE ?)';
            params.push(`%${q}%`, `%${q}%`);
        }
        
        if (genre) {
            query += ' AND genres LIKE ?';
            params.push(`%${genre}%`);
        }
        
        if (year) {
            query += ' AND year = ?';
            params.push(parseInt(year));
        }
        
        if (quality) {
            query += ' AND quality = ?';
            params.push(quality);
        }
        
        query += ' ORDER BY rating DESC';
        
        const results = db.prepare(query).all(...params);
        res.json({ success: true, data: results });
    } catch (err) {
        console.error('Error searching content:', err);
        res.status(500).json({ success: false, error: 'Failed to search content' });
    }
});

// GET /api/content/:id - Get content detail with seasons/episodes
router.get('/:id', (req, res) => {
    try {
        const { id } = req.params;
        
        const content = db.prepare('SELECT * FROM content WHERE id = ?').get(id);
        
        if (!content) {
            return res.status(404).json({ success: false, error: 'Content not found' });
        }
        
        let seasons = [];
        let episodes = [];
        
        if (content.type === 'series' || content.type === 'anime') {
            seasons = db.prepare(`
                SELECT * FROM seasons 
                WHERE content_id = ?
                ORDER BY season_number ASC
            `).all(id);
            
            if (seasons.length > 0) {
                const seasonIds = seasons.map(s => s.id).join(',');
                episodes = db.prepare(`
                    SELECT * FROM episodes 
                    WHERE content_id = ? AND season_id IN (${seasonIds})
                    ORDER BY season_number ASC, episode_number ASC
                `).all(id);
            }
        }
        
        const result = {
            ...content,
            seasons,
            episodes
        };
        
        res.json({ success: true, data: result });
    } catch (err) {
        console.error('Error fetching content detail:', err);
        res.status(500).json({ success: false, error: 'Failed to fetch content detail' });
    }
});

export default router;