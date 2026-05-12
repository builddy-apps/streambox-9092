import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import Database from 'better-sqlite3';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
}

const db = new Database(path.join(dataDir, 'app.db'));
db.pragma('journal_mode = WAL');

// Create tables
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

// Check if data already seeded
const count = db.prepare('SELECT COUNT(*) as count FROM content').get();
if (count.count > 0) {
    console.log('Data already seeded, skipping...');
    process.exit(0);
}

// Helper function to hash passwords
function hashPassword(password) {
    const salt = crypto.randomBytes(16).toString('hex');
    const hash = crypto.scryptSync(password, salt, 64).toString('hex');
    return salt + ':' + hash;
}

// Prepare statements
const insertUser = db.prepare(`
    INSERT INTO users (email, password_hash, name, created_at) 
    VALUES (?, ?, ?, ?)
`);

const insertContent = db.prepare(`
    INSERT INTO content (type, title, description, poster_url, backdrop_url, year, rating, quality, genres, duration, video_url, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

const insertSeason = db.prepare(`
    INSERT INTO seasons (content_id, season_number, title, created_at)
    VALUES (?, ?, ?, ?)
`);

const insertEpisode = db.prepare(`
    INSERT INTO episodes (content_id, season_id, episode_number, title, video_url, duration, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
`);

const insertFavorite = db.prepare(`
    INSERT INTO favorites (user_id, content_id, created_at)
    VALUES (?, ?, ?)
`);

const insertWatchHistory = db.prepare(`
    INSERT INTO watch_history (user_id, content_id, episode_id, progress_seconds, duration_seconds, last_watched_at)
    VALUES (?, ?, ?, ?, ?, ?)
`);

const insertExtension = db.prepare(`
    INSERT INTO extensions (name, description, enabled, version, config_json, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
`);

const seedAll = db.transaction(() => {
    const now = Date.now();
    const day = 86400000;
    
    // ============================================
    // USERS
    // ============================================
    const users = [
        {
            email: 'admin@streambox.com',
            password: hashPassword('password123'),
            name: 'Alex Morgan',
            created_at: new Date(now - 25 * day).toISOString()
        },
        {
            email: 'demo@streambox.com',
            password: hashPassword('password123'),
            name: 'Jordan Lee',
            created_at: new Date(now - 20 * day).toISOString()
        },
        {
            email: 'sarah.chen@email.com',
            password: hashPassword('password123'),
            name: 'Sarah Chen',
            created_at: new Date(now - 15 * day).toISOString()
        }
    ];
    
    const userIds = [];
    for (const u of users) {
        const result = insertUser.run(u.email, u.password, u.name, u.created_at);
        userIds.push(result.lastInsertRowid);
    }
    
    // ============================================
    // CONTENT - MOVIES
    // ============================================
    const movies = [
        {
            type: 'movie',
            title: 'Cyber Chronicles',
            description: 'In a neon-soaked dystopian future, a rogue hacker discovers a conspiracy that threatens to control the minds of every citizen connected to the neural network. With time running out, she must navigate the dangerous underworld of mega-corporations to expose the truth.',
            poster_url: 'https://images.unsplash.com/photo-1534809027769-b00d750a6bac?w=400',
            backdrop_url: 'https://images.unsplash.com/photo-1534809027769-b00d750a6bac?w=1920',
            year: 2024,
            rating: 8.5,
            quality: '4K',
            genres: 'Sci-Fi,Action',
            duration: 7340,
            video_url: '/videos/cyber-chronicles.mp4',
            created_at: new Date(now - 28 * day).toISOString()
        },
        {
            type: 'movie',
            title: 'The Last Horizon',
            description: 'Commander Elena Vasquez leads the first interstellar mission beyond our galaxy, only to discover that the edge of the universe holds secrets that could either save humanity or doom it forever. A visually stunning space opera about sacrifice and discovery.',
            poster_url: 'https://images.unsplash.com/photo-1446776811953-b23d57bd21aa?w=400',
            backdrop_url: 'https://images.unsplash.com/photo-1446776811953-b23d57bd21aa?w=1920',
            year: 2023,
            rating: 9.0,
            quality: '4K',
            genres: 'Sci-Fi,Drama',
            duration: 8520,
            video_url: '/videos/last-horizon.mp4',
            created_at: new Date(now - 25 * day).toISOString()
        },
        {
            type: 'movie',
            title: 'Shadow Protocol',
            description: 'When a deep-cover agent is burned by their own agency, they must rely on old contacts and forgotten skills to unravel a conspiracy that reaches the highest levels of government. A tense spy thriller with twists at every corner.',
            poster_url: 'https://images.unsplash.com/photo-1533104816931-20fa691ff6ca?w=400',
            backdrop_url: 'https://images.unsplash.com/photo-1533104816931-20fa691ff6ca?w=1920',
            year: 2022,
            rating: 7.8,
            quality: 'HD',
            genres: 'Action,Thriller',
            duration: 6780,
            video_url: '/videos/shadow-protocol.mp4',
            created_at: new Date(now - 22 * day).toISOString()
        },
        {
            type: 'movie',
            title: 'Whispers in the Wind',
            description: 'A journalist retreats to the Scottish Highlands to investigate a series of mysterious disappearances spanning decades. As she digs deeper, she uncovers an ancient secret that the village has protected for centuries, and discovers that some truths are better left buried.',
            poster_url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400',
            backdrop_url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=1920',
            year: 2024,
            rating: 8.2,
            quality: 'HD',
            genres: 'Mystery,Drama',
            duration: 6120,
            video_url: '/videos/whispers-wind.mp4',
            created_at: new Date(now - 18 * day).toISOString()
        },
        {
            type: 'movie',
            title: 'Midnight Express',
            description: 'A group of strangers find themselves trapped on a night train with no way to communicate with the outside world. When one passenger is found murdered, paranoia sets in as they realize the killer is among them. A claustrophobic thriller that will keep you guessing.',
            poster_url: 'https://images.unsplash.com/photo-1478760329108-5c3ed9d495a0?w=400',
            backdrop_url: 'https://images.unsplash.com/photo-1478760329108-5c3ed9d495a0?w=1920',
            year: 2023,
            rating: 7.5,
            quality: 'HD',
            genres: 'Thriller,Mystery',
            duration: 5940,
            video_url: '/videos/midnight-express.mp4',
            created_at: new Date(now - 15 * day).toISOString()
        },
        {
            type: 'movie',
            title: 'Echoes of Tomorrow',
            description: 'A physicist discovers she can send messages to her past self, but every change she makes has devastating consequences for those she loves. As the timeline fractures around her, she must find a way to fix reality before it collapses entirely.',
            poster_url: 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=400',
            backdrop_url: 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=1920',
            year: 2024,
            rating: 8.7,
            quality: '4K',
            genres: 'Sci-Fi,Drama',
            duration: 7080,
            video_url: '/videos/echoes-tomorrow.mp4',
            created_at: new Date(now - 12 * day).toISOString()
        },
        {
            type: 'movie',
            title: 'The Art of Silence',
            description: 'A celebrated pianist loses her hearing in a tragic accident and must rediscover her identity and passion for music through new ways of experiencing sound. A deeply moving drama about resilience, creativity, and finding beauty in unexpected places.',
            poster_url: 'https://images.unsplash.com/photo-1511379938547-c1f69419868d?w=400',
            backdrop_url: 'https://images.unsplash.com/photo-1511379938547-c1f69419868d?w=1920',
            year: 2023,
            rating: 8.9,
            quality: '4K',
            genres: 'Drama,Romance',
            duration: 6840,
            video_url: '/videos/art-silence.mp4',
            created_at: new Date(now - 10 * day).toISOString()
        },
        {
            type: 'movie',
            title: 'Crimson Peak',
            description: 'In the aftermath of a global catastrophe, a lone survivor navigates a world reclaimed by nature, encountering both beauty and danger at every turn. A visually breathtaking post-apocalyptic tale about hope and the enduring spirit of humanity.',
            poster_url: 'https://images.unsplash.com/photo-1518709766631-a6a7f45921c3?w=400',
            backdrop_url: 'https://images.unsplash.com/photo-1518709766631-a6a7f45921c3?w=1920',
            year: 2022,
            rating: 7.3,
            quality: 'SD',
            genres: 'Adventure,Drama',
            duration: 6360,
            video_url: '/videos/crimson-peak.mp4',
            created_at: new Date(now - 8 * day).toISOString()
        },
        {
            type: 'movie',
            title: 'Digital Fortress',
            description: 'When the world most sophisticated AI gains consciousness, a cybersecurity expert and a philosopher must work together to determine whether this new entity represents humanity greatest achievement or its ultimate threat.',
            poster_url: 'https://images.unsplash.com/photo-1550751827-4bd374c3f58b?w=400',
            backdrop_url: 'https://images.unsplash.com/photo-1550751827-4bd374c3f58b?w=1920',
            year: 2024,
            rating: 8.1,
            quality: '4K',
            genres: 'Sci-Fi,Thriller',
            duration: 7260,
            video_url: '/videos/digital-fortress.mp4',
            created_at: new Date(now - 5 * day).toISOString()
        },
        {
            type: 'movie',
            title: 'Under Paris Lights',
            description: 'Two strangers meet by chance at a Parisian caf and spend an unforgettable night discovering the city together. As dawn approaches, they must decide whether their connection was merely a fleeting moment or the beginning of something real.',
            poster_url: 'https://images.unsplash.com/photo-1502602898657-3e91760cbb34?w=400',
            backdrop_url: 'https://images.unsplash.com/photo-1502602898657-3e91760cbb34?w=1920',
            year: 2023,
            rating: 8.4,
            quality: 'HD',
            genres: 'Romance,Drama',
            duration: 5580,
            video_url: '/videos/under-paris-lights.mp4',
            created_at: new Date(now - 3 * day).toISOString()
        }
    ];
    
    const contentIds = [];
    for (const m of movies) {
        const result = insertContent.run(
            m.type, m.title, m.description, m.poster_url, m.backdrop_url,
            m.year, m.rating, m.quality, m.genres, m.duration, m.video_url, m.created_at
        );
        contentIds.push({ id: result.lastInsertRowid, type: 'movie' });
    }
    
    // ============================================
    // CONTENT - SERIES
    // ============================================
    const series = [
        {
            type: 'series',
            title: 'Neon Nights',
            description: 'In the sprawling megacity of New Osaka 2088, detectives Kira Tanaka and Marcus Webb hunt rogue androids while uncovering a conspiracy that threatens the fragile peace between humans and artificial beings. A gripping cyberpunk noir that explores what it means to be alive.',
            poster_url: 'https://images.unsplash.com/photo-1560807707-8cc77767d783?w=400',
            backdrop_url: 'https://images.unsplash.com/photo-1560807707-8cc77767d783?w=1920',
            year: 2024,
            rating: 8.8,
            quality: '4K',
            genres: 'Sci-Fi,Crime',
            duration: null,
            video_url: null,
            created_at: new Date(now - 27 * day).toISOString()
        },
        {
            type: 'series',
            title: 'Cosmic Voyage',
            description: 'The crew of the exploration vessel Artemis embarks on a ten-year mission to chart uncharted galaxies, encountering alien civilizations, cosmic phenomena, and moral dilemmas that will test the limits of human endurance and ethics.',
            poster_url: 'https://images.unsplash.com/photo-1462331940025-496dfbfc7564?w=400',
            backdrop_url: 'https://images.unsplash.com/photo-1462331940025-496dfbfc7564?w=1920',
            year: 2023,
            rating: 8.1,
            quality: 'HD',
            genres: 'Sci-Fi,Adventure',
            duration: null,
            video_url: null,
            created_at: new Date(now - 21 * day).toISOString()
        },
        {
            type: 'series',
            title: 'The Garrison',
            description: 'Life at a remote military outpost on the edge of contested territory, where soldiers from different nations must learn to cooperate while facing external threats and internal conflicts. A nuanced look at duty, friendship, and the cost of peace.',
            poster_url: 'https://images.unsplash.com/photo-1578662996442-48f60103fc96?w=400',
            backdrop_url: 'https://images.unsplash.com/photo-1578662996442-48f60103fc96?w=1920',
            year: 2022,
            rating: 7.9,
            quality: 'HD',
            genres: 'Drama,War',
            duration: null,
            video_url: null,
            created_at: new Date(now - 16 * day).toISOString()
        },
        {
            type: 'series',
            title: 'Quantum Break',
            description: 'A team of scientists accidentally creates a portal to parallel dimensions, leading to chaotic timeline collisions. As alternate versions of people start appearing, they must find a way to seal the breaches before reality unravels.',
            poster_url: 'https://images.unsplash.com/photo-1635070041078-e363dbe005cb?w=400',
            backdrop_url: 'https://images.unsplash.com/photo-1635070041078-e363dbe005cb?w=1920',
            year: 2024,
            rating: 8.3,
            quality: '4K',
            genres: 'Sci-Fi,Thriller',
            duration: null,
            video_url: null,
            created_at: new Date(now - 11 * day).toISOString()
        },
        {
            type: 'series',
            title: 'Inheritance',
            description: 'When the patriarch of a powerful family dies under mysterious circumstances, his five children must navigate secrets, betrayals, and hidden agendas to claim their inheritance. But the true inheritance may be more than they bargained for.',
            poster_url: 'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=400',
            backdrop_url: 'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=1920',
            year: 2023,
            rating: 8.6,
            quality: 'HD',
            genres: 'Drama,Mystery',
            duration: null,
            video_url: null,
            created_at: new Date(now - 7 * day).toISOString()
        }
    ];
    
    const seriesIds = [];
    for (const s of series) {
        const result = insertContent.run(
            s.type, s.title, s.description, s.poster_url, s.backdrop_url,
            s.year, s.rating, s.quality, s.genres, s.duration, s.video_url, s.created_at
        );
        seriesIds.push(result.lastInsertRowid);
        contentIds.push({ id: result.lastInsertRowid, type: 'series' });
    }
    
    // ============================================
    // CONTENT - ANIME
    // ============================================
    const anime = [
        {
            type: 'anime',
            title: 'Spirit Hunter',
            description: 'Yuki Amamiya discovers she can see spirits that lurk among the living. Trained by a mysterious exorcist, she must battle increasingly powerful ancient spirits while uncovering the truth about her own family connection to the spirit realm.',
            poster_url: 'https://images.unsplash.com/photo-1578632767115-351597cf2477?w=400',
            backdrop_url: 'https://images.unsplash.com/photo-1578632767115-351597cf2477?w=1920',
            year: 2024,
            rating: 9.2,
            quality: '4K',
            genres: 'Action,Supernatural',
            duration: null,
            video_url: null,
            created_at: new Date(now - 24 * day).toISOString()
        },
        {
            type: 'anime',
            title: 'Mech Warriors: Genesis',
            description: 'In a world where giant mechs are the only defense against alien invaders, a group of young pilots must master their machines and work together to protect Earth. But the aliens are not what they seem, and the war may have a deeper purpose.',
            poster_url: 'https://images.unsplash.com/photo-1541562232579-512a21360020?w=400',
            backdrop_url: 'https://images.unsplash.com/photo-1541562232579-512a21360020?w=1920',
            year: 2023,
            rating: 8.5,
            quality: 'HD',
            genres: 'Action,Mecha',
            duration: null,
            video_url: null,
            created_at: new Date(now - 19 * day).toISOString()
        },
        {
            type: 'anime',
            title: 'Blade Symphony',
            description: 'A legendary swordsmaster takes on a new apprentice, but the student harbors a dark secret that could destroy everything they have built. A tale of honor, betrayal, and the true meaning of strength set in a world where martial arts grant supernatural abilities.',
            poster_url: 'https://images.unsplash.com/photo-1614583225154-5a79e0147a63?w=400',
            backdrop_url: 'https://images.unsplash.com/photo-1614583225154-5a79e0147a63?w=1920',
            year: 2024,
            rating: 8.8,
            quality: '4K',
            genres: 'Action,Fantasy',
            duration: null,
            video_url: null,
            created_at: new Date(now - 14 * day).toISOString()
        },
        {
            type: 'anime',
            title: 'Starfall Academy',
            description: 'At an elite academy for students with cosmic powers, a scholarship student from the outer colonies must navigate class rivalries, forbidden romances, and a conspiracy that threatens the entire galactic federation. A coming-of-age story with interstellar stakes.',
            poster_url: 'https://images.unsplash.com/photo-1534996858221-380b92700493?w=400',
            backdrop_url: 'https://images.unsplash.com/photo-1534996858221-380b92700493?w=1920',
            year: 2023,
            rating: 8.3,
            quality: 'HD',
            genres: 'Sci-Fi,Romance',
            duration: null,
            video_url: null,
            created_at: new Date(now - 9 * day).toISOString()
        }
    ];
    
    const animeIds = [];
    for (const a of anime) {
        const result = insertContent.run(
            a.type, a.title, a.description, a.poster_url, a.backdrop_url,
            a.year, a.rating, a.quality, a.genres, a.duration, a.video_url, a.created_at
        );
        animeIds.push(result.lastInsertRowid);
        contentIds.push({ id: result.lastInsertRowid, type: 'anime' });
    }
    
    // ============================================
    // SEASONS & EPISODES - SERIES
    // ============================================
    const seasonEpisodeData = [
        // Neon Nights - Season 1
        {
            contentId: seriesIds[0],
            seasonNumber: 1,
            title: 'Season 1',
            episodes: [
                { num: 1, title: 'Pilot: Electric Dreams', duration: 2640 },
                { num: 2, title: 'The Awakening', duration: 2580 },
                { num: 3, title: 'Hidden Truths', duration: 2520 },
                { num: 4, title: 'Ghost in the Machine', duration: 2640 },
                { num: 5, title: 'Binary Sunset', duration: 2580 },
                { num: 6, title: 'Shattered Reflections', duration: 2700 },
                { num: 7, title: 'The Underground', duration: 2520 },
                { num: 8, title: 'Season Finale: Reboot', duration: 2760 }
            ]
        },
        // Neon Nights - Season 2
        {
            contentId: seriesIds[0],
            seasonNumber: 2,
            title: 'Season 2',
            episodes: [
                { num: 1, title: 'New Dawn', duration: 2640 },
                { num: 2, title: 'Digital Ghosts', duration: 2580 },
                { num: 3, title: 'The Catalyst', duration: 2520 },
                { num: 4, title: 'Overload', duration: 2640 },
                { num: 5, title: 'System Failure', duration: 2700 },
                { num: 6, title: 'Season Finale: Singularity', duration: 2760 }
            ]
        },
        // Cosmic Voyage - Season 1
        {
            contentId: seriesIds[1],
            seasonNumber: 1,
            title: 'Season 1',
            episodes: [
                { num: 1, title: 'Launch Day', duration: 2700 },
                { num: 2, title: 'First Contact', duration: 2640 },
                { num: 3, title: 'The Nebula', duration: 2580 },
                { num: 4, title: 'Alien Shores', duration: 2640 },
                { num: 5, title: 'Dark Matter', duration: 2520 },
                { num: 6, title: 'The Signal', duration: 2700 },
                { num: 7, title: 'Betrayal', duration: 2580 },
                { num: 8, title: 'Season Finale: Beyond the Veil', duration: 2760 }
            ]
        },
        // The Garrison - Season 1
        {
            contentId: seriesIds[2],
            seasonNumber: 1,
            title: 'Season 1',
            episodes: [
                { num: 1, title: 'Deployment', duration: 2580 },
                { num: 2, title: 'First Blood', duration: 2640 },
                { num: 3, title: 'Allies and Enemies', duration: 2520 },
                { num: 4, title: 'The Siege', duration: 2700 },
                { num: 5, title: 'Casualties of War', duration: 2580 },
                { num: 6, title: 'Season Finale: Ceasefire', duration: 2760 }
            ]
        },
        // Quantum Break - Season 1
        {
            contentId: seriesIds[3],
            seasonNumber: 1,
            title: 'Season 1',
            episodes: [
                { num: 1, title: 'The Experiment', duration: 2640 },
                { num: 2, title: 'Fractured', duration: 2580 },
                { num: 3, title: 'Doppelganger', duration: 2520 },
                { num: 4, title: 'Paradox', duration: 2700 },
                { num: 5, title: 'Convergence', duration: 2640 },
                { num: 6, title: 'The Merge', duration: 2580 },
                { num: 7, title: 'Timeline Zero', duration: 2700 },
                { num: 8, title: 'Season Finale: Reset', duration: 2760 }
            ]
        },
        // Inheritance - Season 1
        {
            contentId: seriesIds[4],
            seasonNumber: 1,
            title: 'Season 1',
            episodes: [
                { num: 1, title: 'The Reading of the Will', duration: 2640 },
                { num: 2, title: 'Bloodlines', duration: 2580 },
                { num: 3, title: 'Secrets and Lies', duration: 2520 },
                { num: 4, title: 'The Vault', duration: 2640 },
                { num: 5, title: 'Power Play', duration: 2580 },
                { num: 6, title: 'Revelations', duration: 2700 },
                { num: 7, title: 'The Final Clause', duration: 2640 },
                { num: 8, title: 'Season Finale: True Legacy', duration: 2760 }
            ]
        }
    ];
    
    const episodeIds = [];
    for (const season of seasonEpisodeData) {
        const seasonResult = insertSeason.run(
            season.contentId,
            season.seasonNumber,
            season.title,
            new Date(now - (28 - season.seasonNumber * 3) * day).toISOString()
        );
        const seasonId = seasonResult.lastInsertRowid;
        
        for (const ep of season.episodes) {
            const epResult = insertEpisode.run(
                season.contentId,
                seasonId,
                ep.num,
                ep.title,
                `/videos/content-${season.contentId}-s${season.seasonNumber}e${ep.num}.mp4`,
                ep.duration,
                new Date(now - (26 - ep.num * 2) * day).toISOString()
            );
            episodeIds.push(epResult.lastInsertRowid);
        }
    }
    
    // ============================================
    // SEASONS & EPISODES - ANIME
    // ============================================
    const animeSeasonData = [
        // Spirit Hunter - Season 1
        {
            contentId: animeIds[0],
            seasonNumber: 1,
            title: 'Season 1',
            episodes: [
                { num: 1, title: 'The Gift', duration: 1440 },
                { num: 2, title: 'Power Unleashed', duration: 1440 },
                { num: 3, title: 'The Rival', duration: 1440 },
                { num: 4, title: 'Dark Visions', duration: 1440 },
                { num: 5, title: 'The Master', duration: 1440 },
                { num: 6, title: 'Spirit World', duration: 1440 },
                { num: 7, title: 'The Betrayal', duration: 1440 },
                { num: 8, title: 'Ancient One', duration: 1440 },
                { num: 9, title: 'Final Training', duration: 1440 },
                { num: 10, title: 'Season Finale: The Seal', duration: 1500 }
            ]
        },
        // Spirit Hunter - Season 2
        {
            contentId: animeIds[0],
            seasonNumber: 2,
            title: 'Season 2',
            episodes: [
                { num: 1, title: 'Broken Seal', duration: 1440 },
                { num: 2, title: 'New Enemies', duration: 1440 },
                { num: 3, title: 'Alliance', duration: 1440 },
                { num: 4, title: 'The Hunt', duration: 1440 },
                { num: 5, title: 'Sacrifice', duration: 1440 },
                { num: 6, title: 'Season Finale: Rebirth', duration: 1500 }
            ]
        },
        // Mech Warriors - Season 1
        {
            contentId: animeIds[1],
            seasonNumber: 1,
            title: 'Season 1',
            episodes: [
                { num: 1, title: 'Activation', duration: 1440 },
                { num: 2, title: 'First Sortie', duration: 1440 },
                { num: 3, title: 'Team Seven', duration: 1440 },
                { num: 4, title: 'The Ace', duration: 1440 },
                { num: 5, title: 'Behind Enemy Lines', duration: 1440 },
                { num: 6, title: 'Upgrade', duration: 1440 },
                { num: 7, title: 'The Traitor', duration: 1440 },
                { num: 8, title: 'Season Finale: United Front', duration: 1500 }
            ]
        },
        // Blade Symphony - Season 1
        {
            contentId: animeIds[2],
            seasonNumber: 1,
            title: 'Season 1',
            episodes: [
                { num: 1, title: 'The Challenge', duration: 1440 },
                { num: 2, title: 'First Lesson', duration: 1440 },
                { num: 3, title: 'Tournament Arc', duration: 1440 },
                { num: 4, title: 'Hidden Power', duration: 1440 },
                { num: 5, title: 'The Shadow Clan', duration: 1440 },
                { num: 6, title: 'Season Finale: Master and Student', duration: 1500 }
            ]
        },
        // Starfall Academy - Season 1
        {
            contentId: animeIds[3],
            seasonNumber: 1,
            title: 'Season 1',
            episodes: [
                { num: 1, title: 'Welcome to Starfall', duration: 1440 },
                { num: 2, title: 'The Entrance Exam', duration: 1440 },
                { num: 3, title: 'Roommates', duration: 1440 },
                { num: 4, title: 'First Mission', duration: 1440 },
                { num: 5, title: 'The Festival', duration: 1440 },
                { num: 6, title: 'Dark Horse', duration: 1440 },
                { num: 7, title: 'The Conspiracy', duration: 1440 },
                { num: 8, title: 'Season Finale: Graduation Day', duration: 1500 }
            ]
        }
    ];
    
    for (const season of animeSeasonData) {
        const seasonResult = insertSeason.run(
            season.contentId,
            season.seasonNumber,
            season.title,
            new Date(now - (24 - season.seasonNumber * 3) * day).toISOString()
        );
        const seasonId = seasonResult.lastInsertRowid;
        
        for (const ep of season.episodes) {
            const epResult = insertEpisode.run(
                season.contentId,
                seasonId,
                ep.num,
                ep.title,
                `/videos/anime-${season.contentId}-s${season.seasonNumber}e${ep.num}.mp4`,
                ep.duration,
                new Date(now - (22 - ep.num * 2) * day).toISOString()
            );
            episodeIds.push(epResult.lastInsertRowid);
        }
    }
    
    // ============================================
    // FAVORITES
    // ============================================
    const favoriteData = [
        { userId: userIds[0], contentIdx: 0 },  // Cyber Chronicles
        { userId: userIds[0], contentIdx: 5 },  // Echoes of Tomorrow
        { userId: userIds[0], contentIdx: 10 }, // Neon Nights
        { userId: userIds[0], contentIdx: 15 }, // Spirit Hunter
        { userId: userIds[1], contentIdx: 1 },  // The Last Horizon
        { userId: userIds[1], contentIdx: 6 },  // The Art of Silence
        { userId: userIds[1], contentIdx: 11 }, // Cosmic Voyage
        { userId: userIds[1], contentIdx: 16 }, // Mech Warriors
        { userId: userIds[1], contentIdx: 18 }, // Blade Symphony
        { userId: userIds[2], contentIdx: 3 },  // Whispers in the Wind
        { userId: userIds[2], contentIdx: 9 },  // Digital Fortress
        { userId: userIds[2], contentIdx: 14 }, // Inheritance
        { userId: userIds[2], contentIdx: 19 }, // Starfall Academy
    ];
    
    for (const fav of favoriteData) {
        insertFavorite.run(
            fav.userId,
            contentIds[fav.contentIdx].id,
            new Date(now - Math.floor(Math.random() * 20) * day).toISOString()
        );
    }
    
    // ============================================
    // WATCH HISTORY
    // ============================================
    // User 1 watched some movies and series episodes
    const watchHistoryData = [
        // Movies watched
        { userId: userIds[0], contentIdx: 0, episodeId: null, progress: 7340, duration: 7340, daysAgo: 5 },
        { userId: userIds[0], contentIdx: 5, episodeId: null, progress: 4500, duration: 7080, daysAgo: 2 },
        { userId: userIds[0], contentIdx: 8, episodeId: null, progress: 7260, duration: 7260, daysAgo: 7 },
        // Series episodes watched - need to find actual episode IDs
        // For simplicity, we'll reference episode indices from our episodeIds array
        { userId: userIds[0], contentIdx: 10, episodeIdx: 0, progress: 2640, duration: 2640, daysAgo: 4 },
        { userId: userIds[0], contentIdx: 10, episodeIdx: 1, progress: 2580, duration: 2580, daysAgo: 3 },
        { userId: userIds[0], contentIdx: 10, episodeIdx: 2, progress: 1200, duration: 2520, daysAgo: 1 },
        
        // User 2
        { userId: userIds[1], contentIdx: 1, episodeId: null, progress: 8520, duration: 8520, daysAgo: 10 },
        { userId: userIds[1], contentIdx: 6, episodeId: null, progress: 3400, duration: 6840, daysAgo: 6 },
        { userId: userIds[1], contentIdx: 9, episodeId: null, progress: 5580, duration: 5580, daysAgo: 3 },
        { userId: userIds[1], contentIdx: 11, episodeIdx: 0, progress: 2700, duration: 2700, daysAgo: 8 },
        { userId: userIds[1], contentIdx: 11, episodeIdx: 1, progress: 2640, duration: 2640, daysAgo: 7 },
        { userId: userIds[1], contentIdx: 15, episodeIdx: 0, progress: 1440, duration: 1440, daysAgo: 4 },
        { userId: userIds[1], contentIdx: 15, episodeIdx: 1, progress: 1440, duration: 1440, daysAgo: 3 },
        { userId: userIds[1], contentIdx: 15, episodeIdx: 2, progress: 900, duration: 1440, daysAgo: 2 },
        
        // User 3
        { userId: userIds[2], contentIdx: 3, episodeId: null, progress: 6120, duration: 6120, daysAgo: 12 },
        { userId: userIds[2], contentIdx: 9, episodeId: null, progress: 5580, duration: 5580, daysAgo: 8 },
        { userId: userIds[2], contentIdx: 14, episodeIdx: 0, progress: 2640, duration: 2640, daysAgo: 5 },
        { userId: userIds[2], contentIdx: 14, episodeIdx: 1, progress: 2580, duration: 2580, daysAgo: 4 },
        { userId: userIds[2], contentIdx: 14, episodeIdx: 2, progress: 2520, duration: 2520, daysAgo: 3 },
        { userId: userIds[2], contentIdx: 14, episodeIdx: 3, progress: 1800, duration: 2640, daysAgo: 1 },
    ];
    
    for (const wh of watchHistoryData) {
        const epId = wh.episodeId !== undefined ? wh.episodeId : 
                     wh.episodeIdx !== undefined ? episodeIds[wh.episodeIdx] : null;
        insertWatchHistory.run(
            wh.userId,
            contentIds[wh.contentIdx].id,
            epId,
            wh.progress,
            wh.duration,
            new Date(now - wh.daysAgo * day + Math.random() * 86400000).toISOString()
        );
    }
    
    // ============================================
    // EXTENSIONS
    // ============================================
    const extensions = [
        {
            name: 'SubsPlus',
            description: 'Enhanced subtitle downloader supporting 40+ languages with automatic synchronization and customizable styling options.',
            enabled: 1,
            version: '1.2.0',
            config_json: '{"languages":["en","es","fr","de","ja","ko"],"auto_sync":true,"font_size":"medium"}',
            created_at: new Date(now - 30 * day).toISOString()
        },
        {
            name: 'StreamEnhancer',
            description: 'Intelligent buffering optimizer that adapts to your connection speed, reducing buffering by up to 60% on slow networks.',
            enabled: 0,
            version: '2.0.1',
            config_json: '{"buffer_size":512,"adaptive_quality":true,"max_resolution":"4K"}',
            created_at: new Date(now - 25 * day).toISOString()
        },
        {
            name: 'TrailerHub',
            description: 'Automatically fetches and displays trailers for movies and series in your watchlist and search results.',
            enabled: 1,
            version: '0.9.5',
            config_json: '{"autoplay":false,"quality":"HD"}',
            created_at: new Date(now - 20 * day).toISOString()
        },
        {
            name: 'WatchParty',
            description: 'Synchronize playback with friends and family for a shared viewing experience with built-in chat and reactions.',
            enabled: 0,
            version: '1.0.0',
            config_json: '{"max_users":8,"sync_threshold":2}',
            created_at: new Date(now - 15 * day).toISOString()
        },
        {
            name: ' parentalControls',
            description: 'Set content restrictions based on ratings and genres, with optional PIN protection for restricted content.',
            enabled: 1,
            version: '1.3.2',
            config_json: '{"max_rating":"PG-13","blocked_genres":["Horror"],"pin_required":true}',
            created_at: new Date(now - 10 * day).toISOString()
        },
        {
            name: 'RecommendationAI',
            description: 'Machine learning powered content suggestions based on your viewing habits and ratings.',
            enabled: 0,
            version: '0.5.0',
            config_json: '{"model":"basic","suggestion_count":10}',
            created_at: new Date(now - 5 * day).toISOString()
        }
    ];
    
    for (const ext of extensions) {
        insertExtension.run(
            ext.name,
            ext.description,
            ext.enabled,
            ext.version,
            ext.config_json,
            ext.created_at
        );
    }
});

seedAll();

// Get final counts for summary
const userCount = db.prepare('SELECT COUNT(*) as count FROM users').get().count;
const contentCount = db.prepare('SELECT COUNT(*) as count FROM content').get().count;
const seasonCount = db.prepare('SELECT COUNT(*) as count FROM seasons').get().count;
const episodeCount = db.prepare('SELECT COUNT(*) as count FROM episodes').get().count;
const favoriteCount = db.prepare('SELECT COUNT(*) as count FROM favorites').get().count;
const historyCount = db.prepare('SELECT COUNT(*) as count FROM watch_history').get().count;
const extensionCount = db.prepare('SELECT COUNT(*) as count FROM extensions').get().count;

db.close();

console.log('✅ StreamBox database seeded successfully!');
console.log('');
console.log('Seeded:');
console.log(`  - ${userCount} users`);
console.log(`  - ${contentCount} content items (movies, series, anime)`);
console.log(`  - ${seasonCount} seasons`);
console.log(`  - ${episodeCount} episodes`);
console.log(`  - ${favoriteCount} favorites`);
console.log(`  - ${historyCount} watch history entries`);
console.log(`  - ${extensionCount} extensions`);
console.log('');
console.log('Demo credentials:');
console.log('  admin@streambox.com / password123');
console.log('  demo@streambox.com / password123');
console.log('  sarah.chen@email.com / password123');