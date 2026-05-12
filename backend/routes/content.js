import express from 'express';
import db from '../db.js';
import { authenticate, optionalAuth } from '../auth.js';

const router = express.Router();

// Helper function to parse genres JSON string
function parseGenres(genresStr) {
  try {
    return JSON.parse(genresStr);
  } catch {
    return genresStr ? genresStr.split(',').map(g => g.trim()) : [];
  }
}

// Helper function to build content item with proper genre parsing
function buildContentItem(row) {
  return {
    ...row,
    genres: parseGenres(row.genres)
  };
}

// GET /api/content/continue-watching - Must come before /:id
router.get('/continue-watching', authenticate, (req, res) => {
  try {
    const userId = req.user.userId;
    const limit = Math.min(parseInt(req.query.limit) || 20, 50);
    const offset = Math.max(parseInt(req.query.offset) || 0, 0);
    
    const stmt = db.prepare(`
      SELECT c.*, 
        wh.progress, 
        wh.duration as watch_duration,
        wh.completed,
        wh.last_watched_at,
        wh.episode_id,
        s.season_number,
        ep.episode_number,
        ep.title as episode_title
      FROM watch_history wh
      JOIN content c ON wh.content_id = c.id
      LEFT JOIN episodes ep ON wh.episode_id = ep.id
      LEFT JOIN seasons s ON ep.season_id = s.id
      WHERE wh.user_id = ? AND wh.completed = 0
      ORDER BY wh.last_watched_at DESC
      LIMIT ? OFFSET ?
    `);
    
    const rows = stmt.all(userId, limit, offset);
    
    const items = rows.map(row => {
      const item = buildContentItem(row);
      item.watch_progress = {
        progress: row.progress,
        duration: row.watch_duration,
        completed: !!row.completed,
        last_watched_at: row.last_watched_at
      };
      if (row.episode_id) {
        item.current_episode = {
          id: row.episode_id,
          season_number: row.season_number,
          episode_number: row.episode_number,
          title: row.episode_title
        };
      }
      return item;
    });
    
    res.json({ success: true, data: items });
  } catch (error) {
    console.error('Error fetching continue watching:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch continue watching' });
  }
});

// GET /api/content/trending
router.get('/trending', optionalAuth, (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 20, 50);
    const offset = Math.max(parseInt(req.query.offset) || 0, 0);
    
    const stmt = db.prepare(`
      SELECT * FROM content
      ORDER BY rating DESC, created_at DESC
      LIMIT ? OFFSET ?
    `);
    
    const rows = stmt.all(limit, offset);
    const items = rows.map(buildContentItem);
    
    res.json({ success: true, data: items });
  } catch (error) {
    console.error('Error fetching trending content:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch trending content' });
  }
});

// GET /api/content/popular
router.get('/popular', optionalAuth, (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 20, 50);
    const offset = Math.max(parseInt(req.query.offset) || 0, 0);
    
    const stmt = db.prepare(`
      SELECT * FROM content
      ORDER BY rating DESC, year DESC
      LIMIT ? OFFSET ?
    `);
    
    const rows = stmt.all(limit, offset);
    const items = rows.map(buildContentItem);
    
    res.json({ success: true, data: items });
  } catch (error) {
    console.error('Error fetching popular content:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch popular content' });
  }
});

// GET /api/content/series
router.get('/series', optionalAuth, (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 20, 50);
    const offset = Math.max(parseInt(req.query.offset) || 0, 0);
    
    const stmt = db.prepare(`
      SELECT * FROM content
      WHERE type = 'series'
      ORDER BY rating DESC, year DESC
      LIMIT ? OFFSET ?
    `);
    
    const rows = stmt.all(limit, offset);
    const items = rows.map(buildContentItem);
    
    res.json({ success: true, data: items });
  } catch (error) {
    console.error('Error fetching series:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch series' });
  }
});

// GET /api/content/anime
router.get('/anime', optionalAuth, (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 20, 50);
    const offset = Math.max(parseInt(req.query.offset) || 0, 0);
    
    const stmt = db.prepare(`
      SELECT * FROM content
      WHERE type = 'anime'
      ORDER BY rating DESC, year DESC
      LIMIT ? OFFSET ?
    `);
    
    const rows = stmt.all(limit, offset);
    const items = rows.map(buildContentItem);
    
    res.json({ success: true, data: items });
  } catch (error) {
    console.error('Error fetching anime:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch anime' });
  }
});

// GET /api/content/movies
router.get('/movies', optionalAuth, (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 20, 50);
    const offset = Math.max(parseInt(req.query.offset) || 0, 0);
    
    const stmt = db.prepare(`
      SELECT * FROM content
      WHERE type = 'movie'
      ORDER BY rating DESC, year DESC
      LIMIT ? OFFSET ?
    `);
    
    const rows = stmt.all(limit, offset);
    const items = rows.map(buildContentItem);
    
    res.json({ success: true, data: items });
  } catch (error) {
    console.error('Error fetching movies:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch movies' });
  }
});

// GET /api/content/search - Search with filters
router.get('/search', optionalAuth, (req, res) => {
  try {
    const { q, genre, year, quality, type } = req.query;
    const limit = Math.min(parseInt(req.query.limit) || 20, 50);
    const offset = Math.max(parseInt(req.query.offset) || 0, 0);
    
    let query = 'SELECT * FROM content WHERE 1=1';
    const params = [];
    
    if (q) {
      query += ' AND title LIKE ?';
      params.push(`%${q}%`);
    }
    
    if (genre) {
      query += ' AND genres LIKE ?';
      params.push(`%"${genre}"%`);
    }
    
    if (year) {
      query += ' AND year = ?';
      params.push(parseInt(year));
    }
    
    if (quality) {
      query += ' AND quality = ?';
      params.push(quality);
    }
    
    if (type) {
      query += ' AND type = ?';
      params.push(type);
    }
    
    query += ' ORDER BY rating DESC, year DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);
    
    const stmt = db.prepare(query);
    const rows = stmt.all(...params);
    const items = rows.map(buildContentItem);
    
    res.json({ success: true, data: items });
  } catch (error) {
    console.error('Error searching content:', error);
    res.status(500).json({ success: false, error: 'Failed to search content' });
  }
});

// GET /api/content/:id - Content detail with seasons and episodes
router.get('/:id', optionalAuth, (req, res) => {
  try {
    const { id } = req.params;
    
    const contentStmt = db.prepare('SELECT * FROM content WHERE id = ?');
    const content = contentStmt.get(id);
    
    if (!content) {
      return res.status(404).json({ success: false, error: 'Content not found' });
    }
    
    const contentItem = buildContentItem(content);
    
    // Get seasons and episodes for series/anime
    if (content.type === 'series' || content.type === 'anime') {
      const seasonsStmt = db.prepare(`
        SELECT s.*, 
          (SELECT COUNT(*) FROM episodes WHERE season_id = s.id) as episode_count
        FROM seasons s
        WHERE s.content_id = ?
        ORDER BY s.season_number ASC
      `);
      const seasons = seasonsStmt.all(id);
      
      // Get episodes for each season
      const seasonsWithEpisodes = seasons.map(season => {
        const episodesStmt = db.prepare(`
          SELECT * FROM episodes
          WHERE season_id = ?
          ORDER BY episode_number ASC
        `);
        const episodes = episodesStmt.all(season.id);
        return { ...season, episodes };
      });
      
      contentItem.seasons = seasonsWithEpisodes;
    }
    
    // Get user-specific data if authenticated
    if (req.user) {
      const userId = req.user.userId;
      
      // Check if favorited
      const favStmt = db.prepare('SELECT id FROM favorites WHERE user_id = ? AND content_id = ?');
      const isFav = favStmt.get(userId, id);
      contentItem.is_favorite = !!isFav;
      
      // Get watch history
      const historyStmt = db.prepare(`
        SELECT * FROM watch_history
        WHERE user_id = ? AND content_id = ?
        ORDER BY last_watched_at DESC
        LIMIT 1
      `);
      const history = historyStmt.get(userId, id);
      if (history) {
        contentItem.watch_progress = {
          progress: history.progress,
          duration: history.duration,
          completed: !!history.completed,
          last_watched_at: history.last_watched_at
        };
      }
    }
    
    res.json({ success: true, data: contentItem });
  } catch (error) {
    console.error('Error fetching content detail:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch content detail' });
  }
});

export default router;