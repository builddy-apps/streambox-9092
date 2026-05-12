import fs from 'fs';
import path from 'path';
import Database from 'better-sqlite3';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dataDir = path.join(__dirname, '../data');
if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
}

const db = new Database(path.join(dataDir, 'app.db'));
db.pragma('journal_mode = WAL');

const createTables = () => {
    db.exec(`
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            email TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            name TEXT,
            created_at TEXT DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS content (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            type TEXT NOT NULL,
            title TEXT NOT NULL,
            description TEXT,
            poster_url TEXT,
            backdrop_url TEXT,
            year INTEGER,
            rating REAL,
            quality TEXT,
            genres TEXT,
            duration INTEGER,
            video_url TEXT,
            created_at TEXT DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS seasons (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            content_id INTEGER NOT NULL,
            season_number INTEGER NOT NULL,
            title TEXT,
            created_at TEXT DEFAULT (datetime('now')),
            FOREIGN KEY (content_id) REFERENCES content(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS episodes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            content_id INTEGER NOT NULL,
            season_id INTEGER,
            episode_number INTEGER NOT NULL,
            title TEXT,
            video_url TEXT,
            duration INTEGER,
            created_at TEXT DEFAULT (datetime('now')),
            FOREIGN KEY (content_id) REFERENCES content(id) ON DELETE CASCADE,
            FOREIGN KEY (season_id) REFERENCES seasons(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS favorites (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            content_id INTEGER NOT NULL,
            created_at TEXT DEFAULT (datetime('now')),
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
            FOREIGN KEY (content_id) REFERENCES content(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS watch_history (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            content_id INTEGER NOT NULL,
            episode_id INTEGER,
            progress_seconds INTEGER DEFAULT 0,
            duration_seconds INTEGER,
            last_watched_at TEXT DEFAULT (datetime('now')),
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
            FOREIGN KEY (content_id) REFERENCES content(id) ON DELETE CASCADE,
            FOREIGN KEY (episode_id) REFERENCES episodes(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS extensions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT UNIQUE NOT NULL,
            description TEXT,
            enabled INTEGER DEFAULT 0,
            version TEXT,
            config_json TEXT,
            created_at TEXT DEFAULT (datetime('now'))
        );
    `);
};

const seedData = () => {
    const contentCount = db.prepare('SELECT COUNT(*) as count FROM content').get();
    if (contentCount.count > 0) return;

    const insertContent = db.prepare(`
        INSERT OR IGNORE INTO content (type, title, description, poster_url, backdrop_url, year, rating, quality, genres, duration, video_url)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const insertSeason = db.prepare(`
        INSERT OR IGNORE INTO seasons (content_id, season_number, title)
        VALUES (?, ?, ?)
    `);

    const insertEpisode = db.prepare(`
        INSERT OR IGNORE INTO episodes (content_id, season_id, episode_number, title, video_url, duration)
        VALUES (?, ?, ?, ?, ?, ?)
    `);

    const insertExtension = db.prepare(`
        INSERT OR IGNORE INTO extensions (name, description, enabled, version, config_json)
        VALUES (?, ?, ?, ?, ?)
    `);

    const movies = [
        {
            type: 'movie', title: 'Cyber Chronicles', description: 'A neon-soaked journey through a dystopian future.', 
            poster_url: '/posters/cyber.jpg', backdrop_url: '/backdrops/cyber.jpg', year: 2024, rating: 8.5, quality: '4K', 
            genres: 'Sci-Fi,Action', duration: 7200, video_url: '/videos/cyber.mp4'
        },
        {
            type: 'movie', title: 'The Last Horizon', description: 'An epic space opera exploring the edge of the universe.', 
            poster_url: '/posters/horizon.jpg', backdrop_url: '/backdrops/horizon.jpg', year: 2023, rating: 9.0, quality: '4K', 
            genres: 'Sci-Fi,Drama', duration: 8400, video_url: '/videos/horizon.mp4'
        },
        {
            type: 'movie', title: 'Shadow Protocol', description: 'A spy thriller with twists at every corner.', 
            poster_url: '/posters/shadow.jpg', backdrop_url: '/backdrops/shadow.jpg', year: 2022, rating: 7.8, quality: 'HD', 
            genres: 'Action,Thriller', duration: 6600, video_url: '/videos/shadow.mp4'
        },
        {
            type: 'movie', title: 'Whispers in the Wind', description: 'A haunting mystery in the Scottish Highlands.', 
            poster_url: '/posters/whispers.jpg', backdrop_url: '/backdrops/whispers.jpg', year: 2024, rating: 8.2, quality: 'HD', 
            genres: 'Mystery,Drama', duration: 6000, video_url: '/videos/whispers.mp4'
        }
    ];

    const series = [
        {
            type: 'series', title: 'Neon Nights', description: 'Detectives hunting rogue androids in 2088.', 
            poster_url: '/posters/neon.jpg', backdrop_url: '/backdrops/neon.jpg', year: 2024, rating: 8.8, quality: '4K', 
            genres: 'Sci-Fi,Crime'
        },
        {
            type: 'series', title: 'Cosmic Voyage', description: 'A crew explores uncharted galaxies.', 
            poster_url: '/posters/cosmic.jpg', backdrop_url: '/backdrops/cosmic.jpg', year: 2023, rating: 8.1, quality: 'HD', 
            genres: 'Sci-Fi,Adventure'
        }
    ];

    const anime = [
        {
            type: 'anime', title: 'Spirit Hunter', description: 'A young exorcist battles ancient spirits.', 
            poster_url: '/posters/spirit.jpg', backdrop_url: '/backdrops/spirit.jpg', year: 2024, rating: 9.2, quality: '4K', 
            genres: 'Action,Supernatural'
        },
        {
            type: 'anime', title: 'Mech Warriors', description: 'Giant robots defend Earth from invasion.', 
            poster_url: '/posters/mech.jpg', backdrop_url: '/backdrops/mech.jpg', year: 2023, rating: 8.5, quality: 'HD', 
            genres: 'Action,Mecha'
        }
    ];

    const extensions = [
        { name: 'SubsPlus', description: 'Enhanced subtitle downloader for multiple languages.', enabled: 1, version: '1.2.0', config_json: '{"languages":["en","es","fr"]}' },
        { name: 'StreamEnhancer', description: 'Improves video quality buffering for slow connections.', enabled: 0, version: '2.0.1', config_json: '{"buffer_size":512}' },
        { name: 'TrailerHub', description: 'Automatically fetches latest trailers.', enabled: 1, version: '0.9.5', config_json: '{}' }
    ];

    const insertMany = db.transaction((items) => {
        for (const item of items) insertContent.run(item.type, item.title, item.description, item.poster_url, item.backdrop_url, item.year, item.rating, item.quality, item.genres, item.duration || null, item.video_url || null);
    });

    insertMany(movies);
    insertMany(series);
    insertMany(anime);

    extensions.forEach(ext => {
        insertExtension.run(ext.name, ext.description, ext.enabled, ext.version, ext.config_json);
    });

    const seriesIds = db.prepare('SELECT id FROM content WHERE type = ?').all('series');
    const animeIds = db.prepare('SELECT id FROM content WHERE type = ?').all('anime');

    seriesIds.forEach(s => {
        const seasonId = insertSeason.run(s.id, 1, 'Season 1').lastInsertRowid;
        insertEpisode.run(s.id, seasonId, 1, 'Pilot', '/videos/s1e1.mp4', 2400);
        insertEpisode.run(s.id, seasonId, 2, 'The Awakening', '/videos/s1e2.mp4', 2400);
        insertEpisode.run(s.id, seasonId, 3, 'Hidden Truths', '/videos/s1e3.mp4', 2400);
    });

    animeIds.forEach(a => {
        const seasonId = insertSeason.run(a.id, 1, 'Season 1').lastInsertRowid;
        insertEpisode.run(a.id, seasonId, 1, 'Beginnings', '/videos/a1e1.mp4', 1440);
        insertEpisode.run(a.id, seasonId, 2, 'Power Up', '/videos/a1e2.mp4', 1440);
        insertEpisode.run(a.id, seasonId, 3, 'The Rival', '/videos/a1e3.mp4', 1440);
    });
};

createTables();
seedData();

export default db;