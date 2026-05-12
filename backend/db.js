import fs from 'fs';
import Database from 'better-sqlite3';
import crypto from 'crypto';

// Ensure data directory exists
const dataDir = './data';
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const db = new Database('./data/app.db');
db.pragma('journal_mode = WAL');

// Schema Definition
const schema = `
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    created_at DATETIME DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS content (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    type TEXT NOT NULL CHECK(type IN ('movie', 'series', 'anime')),
    title TEXT NOT NULL,
    poster_url TEXT,
    backdrop_url TEXT,
    description TEXT,
    rating REAL,
    year INTEGER,
    genres TEXT,
    quality TEXT CHECK(quality IN ('4K', 'HD', 'SD')),
    duration INTEGER,
    created_at DATETIME DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS seasons (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    content_id INTEGER NOT NULL,
    season_number INTEGER NOT NULL,
    title TEXT,
    created_at DATETIME DEFAULT (datetime('now')),
    FOREIGN KEY (content_id) REFERENCES content(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS episodes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    season_id INTEGER NOT NULL,
    episode_number INTEGER NOT NULL,
    title TEXT,
    duration INTEGER,
    video_url TEXT,
    thumbnail_url TEXT,
    created_at DATETIME DEFAULT (datetime('now')),
    FOREIGN KEY (season_id) REFERENCES seasons(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS favorites (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    content_id INTEGER NOT NULL,
    created_at DATETIME DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (content_id) REFERENCES content(id) ON DELETE CASCADE,
    UNIQUE(user_id, content_id)
  );

  CREATE TABLE IF NOT EXISTS watch_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    content_id INTEGER NOT NULL,
    episode_id INTEGER,
    progress INTEGER DEFAULT 0,
    duration INTEGER,
    last_watched_at DATETIME DEFAULT (datetime('now')),
    completed INTEGER DEFAULT 0,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (content_id) REFERENCES content(id) ON DELETE CASCADE,
    FOREIGN KEY (episode_id) REFERENCES episodes(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS extensions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT,
    url TEXT,
    enabled INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS subtitles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    episode_id INTEGER NOT NULL,
    language TEXT NOT NULL,
    url TEXT,
    created_at DATETIME DEFAULT (datetime('now')),
    FOREIGN KEY (episode_id) REFERENCES episodes(id) ON DELETE CASCADE
  );
`;

db.exec(schema);

// Indexes for performance
db.exec(`
  CREATE INDEX IF NOT EXISTS idx_content_title ON content(title);
  CREATE INDEX IF NOT EXISTS idx_content_type ON content(type);
  CREATE INDEX IF NOT EXISTS idx_watch_history_user ON watch_history(user_id);
  CREATE INDEX IF NOT EXISTS idx_favorites_user ON favorites(user_id);
`);

// Seed Data
const hashPassword = (pwd) => {
  const salt = crypto.randomBytes(16).toString('hex');
  const derivedKey = crypto.scryptSync(pwd, salt, 64);
  return salt + ':' + derivedKey.toString('hex');
};

// Seed Users
const insertUser = db.prepare('INSERT OR IGNORE INTO users (email, password_hash) VALUES (?, ?)');
insertUser.run('demo@streambox.app', hashPassword('password123'));

// Seed Extensions
const insertExtension = db.prepare('INSERT INTO extensions (name, description, url, enabled) VALUES (?, ?, ?, ?)');
const extensions = [
  { name: 'OpenSubtitles', desc: 'Subtitles provider', url: 'https://api.opensubtitles.org', enabled: 1,
      description: ''
    },
  { name: 'TMDB', desc: 'Metadata provider', url: 'https://api.themoviedb.org', enabled: 1,
      description: ''
    },
  { name: 'StreamSource A', desc: 'Primary video server', url: 'https://cdn.example.com', enabled: 1,
      description: ''
    }
];
extensions.forEach(ex => insertExtension.run(ex.name, ex.desc, ex.url, ex.enabled));

// Seed Content
const insertContent = db.prepare(`
  INSERT INTO content (type, title, poster_url, backdrop_url, description, rating, year, genres, quality, duration) 
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

const contents = [
  {
    type: 'movie',
    title: 'Inception',
    poster: 'https://image.tmdb.org/t/p/w500/9gk7admal4zl67YrxIo2AO08qX8.jpg',
    backdrop: 'https://image.tmdb.org/t/p/original/s3TBrRGB1iav7gFOCNx3H31MoES.jpg',
    desc: 'A thief who steals corporate secrets through dream-sharing technology.',
    rating: 8.8,
    year: 2010,
    genres: '["Sci-Fi", "Action", "Thriller"]',
    quality: '4K',
    duration: 8280
  },
  {
    type: 'series',
    title: 'Breaking Bad',
    poster: 'https://image.tmdb.org/t/p/w500/ggFHVNu6YYI5L9pCfOacjizRGt.jpg',
    backdrop: 'https://image.tmdb.org/t/p/original/tsRy63Mu5cu8etL1X7ZLyf7UP1M.jpg',
    desc: 'A high school chemistry teacher turned methamphetamine manufacturer.',
    rating: 9.5,
    year: 2008,
    genres: '["Crime", "Drama", "Thriller"]',
    quality: 'HD',
    duration: 2700
  },
  {
    type: 'anime',
    title: 'Attack on Titan',
    poster: 'https://image.tmdb.org/t/p/w500/xHrfH39tVcAFyMvLqJt3gJAjmv1.jpg',
    backdrop: 'https://image.tmdb.org/t/p/original/8cHZ3we8b1pjM2eLq53Jk1JRnvD.jpg',
    desc: 'Humanity fights for survival against giant humanoid Titans.',
    rating: 9.0,
    year: 2013,
    genres: '["Animation", "Action", "Adventure"]',
    quality: 'HD',
    duration: 1440
  },
  {
    type: 'movie',
    title: 'Interstellar',
    poster: 'https://image.tmdb.org/t/p/w500/gEU2QniE6E77NI6lCU6MxlNBvIx.jpg',
    backdrop: 'https://image.tmdb.org/t/p/original/xJHokMbljvjADYdit5fK5VQsXEG.jpg',
    desc: 'A team of explorers travel through a wormhole in space.',
    rating: 8.6,
    year: 2014,
    genres: '["Adventure", "Drama", "Sci-Fi"]',
    quality: '4K',
    duration: 9744
  }
];

contents.forEach(c => insertContent.run(c.type, c.title, c.poster, c.backdrop, c.desc, c.rating, c.year, c.genres, c.quality, c.duration));

// Seed Seasons & Episodes (Breaking Bad)
const bbContent = db.prepare('SELECT id FROM content WHERE title = ?').get('Breaking Bad');
if (bbContent) {
  const insertSeason = db.prepare('INSERT INTO seasons (content_id, season_number, title) VALUES (?, ?, ?)');
  const s1 = insertSeason.run(bbContent.id, 1, 'Season 1');
  
  const insertEp = db.prepare('INSERT INTO episodes (season_id, episode_number, title, duration, video_url, thumbnail_url) VALUES (?, ?, ?, ?, ?, ?)');
  insertEp.run(s1.lastInsertRowid, 1, 'Pilot', 2700, 'https://example.com/vid1.mp4', 'https://example.com/thumb1.jpg');
  insertEp.run(s1.lastInsertRowid, 2, 'Cat\'s in the Bag...', 2700, 'https://example.com/vid2.mp4', 'https://example.com/thumb2.jpg');
}

// Seed Seasons & Episodes (Attack on Titan)
const aotContent = db.prepare('SELECT id FROM content WHERE title = ?').get('Attack on Titan');
if (aotContent) {
  const insertSeason = db.prepare('INSERT INTO seasons (content_id, season_number, title) VALUES (?, ?, ?)');
  const s1 = insertSeason.run(aotContent.id, 1, 'Season 1');
  
  const insertEp = db.prepare('INSERT INTO episodes (season_id, episode_number, title, duration, video_url, thumbnail_url) VALUES (?, ?, ?, ?, ?, ?)');
  insertEp.run(s1.lastInsertRowid, 1, 'To You, in 2000 Years', 1440, 'https://example.com/aot1.mp4', 'https://example.com/aotthumb1.jpg');
}

// Seed Subtitles
const insertSub = db.prepare('INSERT INTO subtitles (episode_id, language, url) VALUES (?, ?, ?)');
const ep1 = db.prepare('SELECT id FROM episodes LIMIT 1').get();
if (ep1) {
  insertSub.run(ep1.id, 'English', 'https://example.com/subs/en.vtt');
  insertSub.run(ep1.id, 'Italian', 'https://example.com/subs/it.vtt');
}

// Seed Watch History & Favorites for demo user
const demoUser = db.prepare('SELECT id FROM users WHERE email = ?').get('demo@streambox.app');
if (demoUser) {
  const insertFav = db.prepare('INSERT OR IGNORE INTO favorites (user_id, content_id) VALUES (?, ?)');
  const incContent = db.prepare('SELECT id FROM content WHERE title = ?').get('Inception');
  if (incContent) insertFav.run(demoUser.id, incContent.id);

  const insertHistory = db.prepare(`
    INSERT INTO watch_history (user_id, content_id, episode_id, progress, duration, completed) 
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  const bbEp = db.prepare('SELECT e.id FROM episodes e JOIN seasons s ON e.season_id = s.id JOIN content c ON s.content_id = c.id WHERE c.title = ? LIMIT 1').get('Breaking Bad');
  if (bbEp && bbContent) {
    insertHistory.run(demoUser.id, bbContent.id, bbEp.id, 1200, 2700, 0);
  }
}

export default db;