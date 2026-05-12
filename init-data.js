import Database from 'better-sqlite3';
import crypto from 'crypto';
import fs from 'fs';

// Ensure data directory exists
if (!fs.existsSync('./data')) {
  fs.mkdirSync('./data', { recursive: true });
}

const db = new Database('./data/app.db');
db.pragma('journal_mode = WAL');

// Check if data already seeded
const count = db.prepare('SELECT COUNT(*) as count FROM content').get();
if (count.count > 0) {
  console.log('Data already seeded, skipping...');
  db.close();
  process.exit(0);
}

// Password hashing helper
const hashPassword = (pwd) => {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(pwd, salt, 64).toString('hex');
  return salt + ':' + hash;
};

// Date helper - get ISO string for N days ago
const daysAgo = (days) => new Date(Date.now() - days * 86400000).toISOString();

// Insert all data in a transaction
const seedAll = db.transaction(() => {
  // ============ USERS ============
  const insertUser = db.prepare('INSERT INTO users (email, password_hash, created_at) VALUES (?, ?, ?)');
  
  const users = [
    { email: 'admin@streambox.app', password: 'admin123', created: daysAgo(30) },
    { email: 'demo@streambox.app', password: 'password123', created: daysAgo(25) },
    { email: 'maria.rossi@email.com', password: 'maria2024', created: daysAgo(15) }
  ];
  
  users.forEach(u => {
    insertUser.run(u.email, hashPassword(u.password), u.created);
  });
  
  const adminUser = db.prepare('SELECT id FROM users WHERE email = ?').get('admin@streambox.app');
  const demoUser = db.prepare('SELECT id FROM users WHERE email = ?').get('demo@streambox.app');
  const mariaUser = db.prepare('SELECT id FROM users WHERE email = ?').get('maria.rossi@email.com');

  // ============ CONTENT ============
  const insertContent = db.prepare(`
    INSERT INTO content (type, title, poster_url, backdrop_url, description, rating, year, genres, quality, duration, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const contentData = [
    // Movies
    {
      type: 'movie', title: 'Inception',
      poster_url: 'https://image.tmdb.org/t/p/w500/9gk7admal4zl67YrxIo2AO08qX8.jpg',
      backdrop_url: 'https://image.tmdb.org/t/p/original/s3TBrRGB1iav7gFOCNx3H31MoES.jpg',
      description: 'A thief who steals corporate secrets through dream-sharing technology is given the inverse task of planting an idea into the mind of a C.E.O.',
      rating: 8.8, year: 2010, genres: '["Sci-Fi", "Azione", "Thriller"]', quality: '4K', duration: 8880
    },
    {
      type: 'movie', title: 'Interstellar',
      poster_url: 'https://image.tmdb.org/t/p/w500/gEU2QniE6E77NI6lCU6MxlNBvIx.jpg',
      backdrop_url: 'https://image.tmdb.org/t/p/original/xJHokMbljvjADYdit5fK5VQsXEG.jpg',
      description: 'A team of explorers travel through a wormhole in space in an attempt to ensure humanity\'s survival as Earth becomes uninhabitable.',
      rating: 8.6, year: 2014, genres: '["Avventura", "Dramma", "Sci-Fi"]', quality: '4K', duration: 10140
    },
    {
      type: 'movie', title: 'The Dark Knight',
      poster_url: 'https://image.tmdb.org/t/p/w500/qJ2tW6WMUDux911BTUgMe1nSNmO.jpg',
      backdrop_url: 'https://image.tmdb.org/t/p/original/nMKdUUepR0i5zn0y1T4CsSB5ez.jpg',
      description: 'When the menace known as the Joker wreaks havoc and chaos on Gotham, Batman must accept one of the greatest psychological tests of his ability to fight injustice.',
      rating: 9.0, year: 2008, genres: '["Azione", "Crimine", "Dramma"]', quality: 'HD', duration: 9120
    },
    {
      type: 'movie', title: 'Pulp Fiction',
      poster_url: 'https://image.tmdb.org/t/p/w500/d5iIlFn5s0ImszYzBPb8JPIfbXD.jpg',
      backdrop_url: 'https://image.tmdb.org/t/p/original/9jR28Hij0d1JMceleYpKFFq7JmI.jpg',
      description: 'The lives of two mob hitmen, a boxer, a gangster and his wife, and a pair of diner bandits intertwine in four tales of violence and redemption.',
      rating: 8.9, year: 1994, genres: '["Crimine", "Dramma"]', quality: 'HD', duration: 9480
    },
    {
      type: 'movie', title: 'Parasite',
      poster_url: 'https://image.tmdb.org/t/p/w500/7IiTTgloJzvGI1TAYymCfbfl3vT.jpg',
      backdrop_url: 'https://image.tmdb.org/t/p/original/TU9NIjwzjoKPwQHoHshkFcQUCG8.jpg',
      description: 'Greed and class discrimination threaten the newly formed symbiotic relationship between the wealthy Park family and the destitute Kim clan.',
      rating: 8.5, year: 2019, genres: '["Commedia", "Thriller", "Dramma"]', quality: '4K', duration: 7680
    },
    {
      type: 'movie', title: 'Blade Runner 2049',
      poster_url: 'https://image.tmdb.org/t/p/w500/gajva2L0rPYkEWjzgFlBXCAVBE5.jpg',
      backdrop_url: 'https://image.tmdb.org/t/p/original/sAtoMqDVhNDQBc3QJL3RF6hlhGq.jpg',
      description: 'Young Blade Runner K\'s discovery of a long-buried secret leads him to track down former Blade Runner Rick Deckard, who\'s been missing for thirty years.',
      rating: 7.6, year: 2017, genres: '["Azione", "Dramma", "Sci-Fi"]', quality: '4K', duration: 10080
    },
    // Series
    {
      type: 'series', title: 'Breaking Bad',
      poster_url: 'https://image.tmdb.org/t/p/w500/ggFHVNu6YYI5L9pCfOacjizRGt.jpg',
      backdrop_url: 'https://image.tmdb.org/t/p/original/tsRy63Mu5cu8etL1X7ZLyf7UP1M.jpg',
      description: 'A high school chemistry teacher diagnosed with lung cancer turns to manufacturing and selling methamphetamine with a former student to secure his family\'s future.',
      rating: 9.5, year: 2008, genres: '["Crimine", "Dramma", "Thriller"]', quality: 'HD', duration: 2700
    },
    {
      type: 'series', title: 'Stranger Things',
      poster_url: 'https://image.tmdb.org/t/p/w49/RMreaIOfMlFqC29HSEfP3PM0Co.jpg',
      backdrop_url: 'https://image.tmdb.org/t/p/original/ekpMEKqLG734Fu8S7djWqAVk7e3.jpg',
      description: 'When a young boy disappears, his mother, a police chief, and his friends must confront terrifying supernatural forces in order to get him back.',
      rating: 8.7, year: 2016, genres: '["Dramma", "Fantasy", "Horror"]', quality: '4K', duration: 3000
    },
    {
      type: 'series', title: 'The Crown',
      poster_url: 'https://image.tmdb.org/t/p/w500/ryfmL3KWJlAjxqIsjoMeS4N6WHh.jpg',
      backdrop_url: 'https://image.tmdb.org/t/p/original/6mYS2iJ7J2IkMT6slDvY7iCztAF.jpg',
      description: 'Follows the political rivalries and romance of Queen Elizabeth II\'s reign and the events that shaped the second half of the twentieth century.',
      rating: 8.6, year: 2016, genres: '["Dramma", "Storia"]', quality: 'HD', duration: 3600
    },
    {
      type: 'series', title: 'Peaky Blinders',
      poster_url: 'https://image.tmdb.org/t/p/w500/vUUqzWaQS0GFwxsoowRfefBPZ2d.jpg',
      backdrop_url: 'https://image.tmdb.org/t/p/original/b7VNL3gMBe1GMs66Y5l8XhXBG5j.jpg',
      description: 'A gangster family epic set in 1900s England, centered on a gang who sew razor blades in the peaks of their caps, and their fierce boss Tommy Shelby.',
      rating: 8.8, year: 2013, genres: '["Crimine", "Dramma"]', quality: 'HD', duration: 3600
    },
    {
      type: 'series', title: 'The Mandalorian',
      poster_url: 'https://image.tmdb.org/t/p/w500/sWgxBvVcyPjO9UeS2i3Cx3vqJzu.jpg',
      backdrop_url: 'https://image.tmdb.org/t/p/original/9ijMGlJKqcslswW5z9Kg4Mf9gP5.jpg',
      description: 'A lone gunfighter makes his way through the galaxy in the era after the fall of the Empire.',
      rating: 8.3, year: 2019, genres: '["Azione", "Avventura", "Sci-Fi"]', quality: '4K', duration: 2400
    },
    // Anime
    {
      type: 'anime', title: 'Attack on Titan',
      poster_url: 'https://image.tmdb.org/t/p/w500/hTP1DtLGFamjfu8WqjnuQdP1n4i.jpg',
      backdrop_url: 'https://image.tmdb.org/t/p/original/8cHZ3we8b1pjM2eLq53Jk1JRnvD.jpg',
      description: 'After his hometown is destroyed and his mother is killed, young Eren Jaeger vows to cleanse the earth of the giant humanoid Titans that have brought humanity to the brink of extinction.',
      rating: 9.0, year: 2013, genres: '["Animazione", "Azione", "Avventura"]', quality: 'HD', duration: 1440
    },
    {
      type: 'anime', title: 'Death Note',
      poster_url: 'https://image.tmdb.org/t/p/w500/npOnUDZadGZzXKVDqE8eloNqCeO.jpg',
      backdrop_url: 'https://image.tmdb.org/t/p/original/jHKn3theMl6BxPgJ7EgBeVeDlS.jpg',
      description: 'An intelligent high school student goes on a secret crusade to eliminate criminals from the world after discovering a notebook capable of killing anyone whose name is written into it.',
      rating: 8.9, year: 2006, genres: '["Animazione", "Crimine", "Thriller"]', quality: 'HD', duration: 1380
    },
    {
      type: 'anime', title: 'One Piece',
      poster_url: 'https://image.tmdb.org/t/p/w500/cMD9Ygz11zjJzAovURpO75Qg7rT.jpg',
      backdrop_url: 'https://image.tmdb.org/t/p/original/nPp5Rm97HSbMZ5jInNXq6Iv147m.jpg',
      description: 'Monkey D. Luffy sets off on an adventure with his pirate crew in hopes of finding the greatest treasure ever, known as "One Piece."',
      rating: 8.7, year: 1999, genres: '["Animazione", "Azione", "Avventura"]', quality: 'SD', duration: 1440
    },
    {
      type: 'anime', title: 'Demon Slayer',
      poster_url: 'https://image.tmdb.org/t/p/w500/wrCwH6WOvXQvVuqBBKsUiIcwmJ4.jpg',
      backdrop_url: 'https://image.tmdb.org/t/p/original/xUfRdRjZhrqGQS3Y53GmPmoh1m0.jpg',
      description: 'A young boy becomes a demon slayer after his family is slaughtered and his sister is turned into a demon, seeking a cure for her condition.',
      rating: 8.6, year: 2019, genres: '["Animazione", "Azione", "Fantasy"]', quality: '4K', duration: 1380
    },
    {
      type: 'anime', title: 'Fullmetal Alchemist: Brotherhood',
      poster_url: 'https://image.tmdb.org/t/p/w500/93A50dB3AdHp0Lcp9JDFqff7KS.jpg',
      backdrop_url: 'https://image.tmdb.org/t/p/original/8KdHdO5XQmW7JxXpVKcNQnDhDxE.jpg',
      description: 'Two brothers search for a Philosopher\'s Stone after an unsuccessful attempt to revive their deceased mother through alchemy leaves them in damaged physical form.',
      rating: 9.1, year: 2009, genres: '["Animazione", "Azione", "Avventura"]', quality: 'HD', duration: 1440
    }
  ];

  contentData.forEach((c, i) => {
    insertContent.run(
      c.type, c.title, c.poster_url, c.backdrop_url, c.description,
      c.rating, c.year, c.genres, c.quality, c.duration, daysAgo(28 - i * 1.5)
    );
  });

  // ============ SEASONS & EPISODES ============
  const insertSeason = db.prepare('INSERT INTO seasons (content_id, season_number, title, created_at) VALUES (?, ?, ?, ?)');
  const insertEpisode = db.prepare('INSERT INTO episodes (season_id, episode_number, title, duration, video_url, thumbnail_url, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)');

  // Breaking Bad - 2 seasons
  const bbContent = db.prepare('SELECT id FROM content WHERE title = ?').get('Breaking Bad');
  if (bbContent) {
    const bbS1 = insertSeason.run(bbContent.id, 1, 'Season 1', daysAgo(25));
    const bbS2 = insertSeason.run(bbContent.id, 2, 'Season 2', daysAgo(24));

    const bbEpisodes = [
      { season_id: bbS1.lastInsertRowid, episodes: ['Pilot', 'Cat\'s in the Bag...', 'And the Bag\'s in the River', 'Cancer Man'] },
      { season_id: bbS2.lastInsertRowid, episodes: ['Seven Thirty-Seven', 'Grilled', 'Bit by a Dead Bee', 'Down'] }
    ];

    bbEpisodes.forEach(s => {
      s.episodes.forEach((title, i) => {
        insertEpisode.run(s.season_id, i + 1, title, 2700, `https://cdn.streambox.app/bb/s${bbEpisodes.indexOf(s) + 1}e${i + 1}.mp4`, `https://cdn.streambox.app/bb/thumb/s${bbEpisodes.indexOf(s) + 1}e${i + 1}.jpg`, daysAgo(24 - i * 0.5));
      });
    });
  }

  // Stranger Things - 2 seasons
  const stContent = db.prepare('SELECT id FROM content WHERE title = ?').get('Stranger Things');
  if (stContent) {
    const stS1 = insertSeason.run(stContent.id, 1, 'Season 1', daysAgo(22));
    const stS2 = insertSeason.run(stContent.id, 2, 'Season 2', daysAgo(21));

    const stEpisodes = [
      { season_id: stS1.lastInsertRowid, episodes: ['The Vanishing of Will Byers', 'The Weirdo on Maple Street', 'Holly, Jolly', 'The Body'] },
      { season_id: stS2.lastInsertRowid, episodes: ['MADMAX', 'Trick or Treat, Freak', 'The Pollywog', 'Will the Wise'] }
    ];

    stEpisodes.forEach(s => {
      s.episodes.forEach((title, i) => {
        insertEpisode.run(s.season_id, i + 1, title, 3000, `https://cdn.streambox.app/st/s${stEpisodes.indexOf(s) + 1}e${i + 1}.mp4`, `https://cdn.streambox.app/st/thumb/s${stEpisodes.indexOf(s) + 1}e${i + 1}.jpg`, daysAgo(21 - i * 0.5));
      });
    });
  }

  // The Crown - 2 seasons
  const crownContent = db.prepare('SELECT id FROM content WHERE title = ?').get('The Crown');
  if (crownContent) {
    const crownS1 = insertSeason.run(crownContent.id, 1, 'Season 1', daysAgo(20));
    const crownS2 = insertSeason.run(crownContent.id, 2, 'Season 2', daysAgo(19));

    const crownEpisodes = [
      { season_id: crownS1.lastInsertRowid, episodes: ['Wolferton Splash', 'Hyde Park Corner', 'Windsor', 'Act of God'] },
      { season_id: crownS2.lastInsertRowid, episodes: ['Misadventure', 'A Company of Men', 'Lisbon', 'Beryl'] }
    ];

    crownEpisodes.forEach(s => {
      s.episodes.forEach((title, i) => {
        insertEpisode.run(s.season_id, i + 1, title, 3600, `https://cdn.streambox.app/crown/s${crownEpisodes.indexOf(s) + 1}e${i + 1}.mp4`, `https://cdn.streambox.app/crown/thumb/s${crownEpisodes.indexOf(s) + 1}e${i + 1}.jpg`, daysAgo(19 - i * 0.5));
      });
    });
  }

  // Peaky Blinders - 2 seasons
  const pbContent = db.prepare('SELECT id FROM content WHERE title = ?').get('Peaky Blinders');
  if (pbContent) {
    const pbS1 = insertSeason.run(pbContent.id, 1, 'Season 1', daysAgo(18));
    const pbS2 = insertSeason.run(pbContent.id, 2, 'Season 2', daysAgo(17));

    const pbEpisodes = [
      { season_id: pbS1.lastInsertRowid, episodes: ['Episode 1', 'Episode 2', 'Episode 3', 'Episode 4'] },
      { season_id: pbS2.lastInsertRowid, episodes: ['Episode 1', 'Episode 2', 'Episode 3', 'Episode 4'] }
    ];

    pbEpisodes.forEach(s => {
      s.episodes.forEach((title, i) => {
        insertEpisode.run(s.season_id, i + 1, title, 3600, `https://cdn.streambox.app/pb/s${pbEpisodes.indexOf(s) + 1}e${i + 1}.mp4`, `https://cdn.streambox.app/pb/thumb/s${pbEpisodes.indexOf(s) + 1}e${i + 1}.jpg`, daysAgo(17 - i * 0.5));
      });
    });
  }

  // The Mandalorian - 2 seasons
  const mandoContent = db.prepare('SELECT id FROM content WHERE title = ?').get('The Mandalorian');
  if (mandoContent) {
    const mandoS1 = insertSeason.run(mandoContent.id, 1, 'Season 1', daysAgo(16));
    const mandoS2 = insertSeason.run(mandoContent.id, 2, 'Season 2', daysAgo(15));

    const mandoEpisodes = [
      { season_id: mandoS1.lastInsertRowid, episodes: ['Chapter 1: The Mandalorian', 'Chapter 2: The Child', 'Chapter 3: The Sin', 'Chapter 4: Sanctuary'] },
      { season_id: mandoS2.lastInsertRowid, episodes: ['Chapter 9: The Marshal', 'Chapter 10: The Passenger', 'Chapter 11: The Heiress', 'Chapter 12: The Siege'] }
    ];

    mandoEpisodes.forEach(s => {
      s.episodes.forEach((title, i) => {
        insertEpisode.run(s.season_id, i + 1, title, 2400, `https://cdn.streambox.app/mando/s${mandoEpisodes.indexOf(s) + 1}e${i + 1}.mp4`, `https://cdn.streambox.app/mando/thumb/s${mandoEpisodes.indexOf(s) + 1}e${i + 1}.jpg`, daysAgo(15 - i * 0.5));
      });
    });
  }

  // Attack on Titan - 2 seasons
  const aotContent = db.prepare('SELECT id FROM content WHERE title = ?').get('Attack on Titan');
  if (aotContent) {
    const aotS1 = insertSeason.run(aotContent.id, 1, 'Season 1', daysAgo(14));
    const aotS2 = insertSeason.run(aotContent.id, 2, 'Season 2', daysAgo(13));

    const aotEpisodes = [
      { season_id: aotS1.lastInsertRowid, episodes: ['To You, in 2000 Years', 'That Day', 'A Dim Light Amid Despair', 'The Night of the Closing Ceremony'] },
      { season_id: aotS2.lastInsertRowid, episodes: ['Beast Titan', 'I\'m Home', 'Southwestward', 'Soldier'] }
    ];

    aotEpisodes.forEach(s => {
      s.episodes.forEach((title, i) => {
        insertEpisode.run(s.season_id, i + 1, title, 1440, `https://cdn.streambox.app/aot/s${aotEpisodes.indexOf(s) + 1}e${i + 1}.mp4`, `https://cdn.streambox.app/aot/thumb/s${aotEpisodes.indexOf(s) + 1}e${i + 1}.jpg`, daysAgo(13 - i * 0.5));
      });
    });
  }

  // Death Note - 1 season
  const dnContent = db.prepare('SELECT id FROM content WHERE title = ?').get('Death Note');
  if (dnContent) {
    const dnS1 = insertSeason.run(dnContent.id, 1, 'Season 1', daysAgo(12));

    const dnEpisodes = ['Rebirth', 'Confrontation', 'Dealings', 'Pursuit'];
    dnEpisodes.forEach((title, i) => {
      insertEpisode.run(dnS1.lastInsertRowid, i + 1, title, 1380, `https://cdn.streambox.app/dn/s1e${i + 1}.mp4`, `https://cdn.streambox.app/dn/thumb/s1e${i + 1}.jpg`, daysAgo(12 - i * 0.5));
    });
  }

  // One Piece - 2 seasons
  const opContent = db.prepare('SELECT id FROM content WHERE title = ?').get('One Piece');
  if (opContent) {
    const opS1 = insertSeason.run(opContent.id, 1, 'East Blue', daysAgo(11));
    const opS2 = insertSeason.run(opContent.id, 2, 'Alabasta', daysAgo(10));

    const opEpisodes = [
      { season_id: opS1.lastInsertRowid, episodes: ['I\'m Luffy! The Man Who\'s Gonna Be King of the Pirates!', 'Enter the Great Swordsman! Pirate Hunter Roronoa Zoro!', 'Morgan Versus Luffy', 'Luffy\'s Past'] },
      { season_id: opS2.lastInsertRowid, episodes: ['Entering the Desert', 'The Sand Tempest', 'A Farewell to Arms', 'Reunion'] }
    ];

    opEpisodes.forEach(s => {
      s.episodes.forEach((title, i) => {
        insertEpisode.run(s.season_id, i + 1, title, 1440, `https://cdn.streambox.app/op/s${opEpisodes.indexOf(s) + 1}e${i + 1}.mp4`, `https://cdn.streambox.app/op/thumb/s${opEpisodes.indexOf(s) + 1}e${i + 1}.jpg`, daysAgo(10 - i * 0.5));
      });
    });
  }

  // Demon Slayer - 1 season
  const dsContent = db.prepare('SELECT id FROM content WHERE title = ?').get('Demon Slayer');
  if (dsContent) {
    const dsS1 = insertSeason.run(dsContent.id, 1, 'Season 1', daysAgo(9));

    const dsEpisodes = ['Cruelty', 'Trainer Sakonji Urokodaki', 'Sabito and Makomo', 'Final Selection'];
    dsEpisodes.forEach((title, i) => {
      insertEpisode.run(dsS1.lastInsertRowid, i + 1, title, 1380, `https://cdn.streambox.app/ds/s1e${i + 1}.mp4`, `https://cdn.streambox.app/ds/thumb/s1e${i + 1}.jpg`, daysAgo(9 - i * 0.5));
    });
  }

  // Fullmetal Alchemist: Brotherhood - 1 season
  const fmaContent = db.prepare('SELECT id FROM content WHERE title = ?').get('Fullmetal Alchemist: Brotherhood');
  if (fmaContent) {
    const fmaS1 = insertSeason.run(fmaContent.id, 1, 'Season 1', daysAgo(8));

    const fmaEpisodes = ['Fullmetal Alchemist', 'The First Day', 'City of Heresy', 'An Alchemist\'s Anguish'];
    fmaEpisodes.forEach((title, i) => {
      insertEpisode.run(fmaS1.lastInsertRowid, i + 1, title, 1440, `https://cdn.streambox.app/fma/s1e${i + 1}.mp4`, `https://cdn.streambox.app/fma/thumb/s1e${i + 1}.jpg`, daysAgo(8 - i * 0.5));
    });
  }

  // ============ EXTENSIONS ============
  const insertExtension = db.prepare('INSERT INTO extensions (name, description, url, enabled, created_at) VALUES (?, ?, ?, ?, ?)');

  const extensions = [
    { name: 'OpenSubtitles', desc: 'Community-driven subtitle provider with support for 50+ languages', url: 'https://api.opensubtitles.org', enabled: 1 },
    { name: 'TMDB Metadata', desc: 'The Movie Database integration for posters, backdrops, and detailed metadata', url: 'https://api.themoviedb.org', enabled: 1 },
    { name: 'StreamSource Alpha', desc: 'Primary video content delivery network with adaptive bitrate streaming', url: 'https://alpha.streamsource.net', enabled: 1 },
    { name: 'StreamSource Beta', desc: 'Backup video source with regional CDN for faster loading times', url: 'https://beta.streamsource.net', enabled: 0 },
    { name: 'SubDL', desc: 'Alternative subtitle source with extensive anime subtitle collection', url: 'https://api.subdl.com', enabled: 1 },
    { name: 'TVDB', desc: 'TheTVDB integration for episode guides and series metadata', url: 'https://api.thetvdb.com', enabled: 0 }
  ];

  extensions.forEach((ex, i) => {
    insertExtension.run(ex.name, ex.desc, ex.url, ex.enabled, daysAgo(27 - i));
  });

  // ============ FAVORITES ============
  const insertFavorite = db.prepare('INSERT OR IGNORE INTO favorites (user_id, content_id, created_at) VALUES (?, ?, ?)');

  // Admin favorites
  const inceptionContent = db.prepare('SELECT id FROM content WHERE title = ?').get('Inception');
  const darkKnightContent = db.prepare('SELECT id FROM content WHERE title = ?').get('The Dark Knight');
  const interstellarContent = db.prepare('SELECT id FROM content WHERE title = ?').get('Interstellar');

  if (adminUser && inceptionContent) insertFavorite.run(adminUser.id, inceptionContent.id, daysAgo(20));
  if (adminUser && darkKnightContent) insertFavorite.run(adminUser.id, darkKnightContent.id, daysAgo(18));
  if (adminUser && interstellarContent) insertFavorite.run(adminUser.id, interstellarContent.id, daysAgo(15));

  // Demo user favorites
  const bbFav = db.prepare('SELECT id FROM content WHERE title = ?').get('Breaking Bad');
  const aotFav = db.prepare('SELECT id FROM content WHERE title = ?').get('Attack on Titan');
  const parasiteContent = db.prepare('SELECT id FROM content WHERE title = ?').get('Parasite');
  const strangerThingsFav = db.prepare('SELECT id FROM content WHERE title = ?').get('Stranger Things');

  if (demoUser && bbFav) insertFavorite.run(demoUser.id, bbFav.id, daysAgo(22));
  if (demoUser && aotFav) insertFavorite.run(demoUser.id, aotFav.id, daysAgo(19));
  if (demoUser && parasiteContent) insertFavorite.run(demoUser.id, parasiteContent.id, daysAgo(12));
  if (demoUser && strangerThingsFav) insertFavorite.run(demoUser.id, strangerThingsFav.id, daysAgo(8));

  // Maria favorites
  const deathNoteFav = db.prepare('SELECT id FROM content WHERE title = ?').get('Death Note');
  const demonSlayerFav = db.prepare('SELECT id FROM content WHERE title = ?').get('Demon Slayer');
  const crownFav = db.prepare('SELECT id FROM content WHERE title = ?').get('The Crown');
  const pulpFictionFav = db.prepare('SELECT id FROM content WHERE title = ?').get('Pulp Fiction');

  if (mariaUser && deathNoteFav) insertFavorite.run(mariaUser.id, deathNoteFav.id, daysAgo(13));
  if (mariaUser && demonSlayerFav) insertFavorite.run(mariaUser.id, demonSlayerFav.id, daysAgo(10));
  if (mariaUser && crownFav) insertFavorite.run(mariaUser.id, crownFav.id, daysAgo(7));
  if (mariaUser && pulpFictionFav) insertFavorite.run(mariaUser.id, pulpFictionFav.id, daysAgo(4));

  // ============ WATCH HISTORY ============
  const insertHistory = db.prepare(`
    INSERT INTO watch_history (user_id, content_id, episode_id, progress, duration, last_watched_at, completed)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  // Helper to get episode
  const getEpisode = (contentTitle, seasonNum, epNum) => {
    return db.prepare(`
      SELECT e.id FROM episodes e
      JOIN seasons s ON e.season_id = s.id
      JOIN content c ON s.content_id = c.id
      WHERE c.title = ? AND s.season_number = ? AND e.episode_number = ?
    `).get(contentTitle, seasonNum, epNum);
  };

  // Admin watch history - movies
  if (adminUser && inceptionContent) {
    insertHistory.run(adminUser.id, inceptionContent.id, null, 8880, 8880, daysAgo(18), 1); // Completed
  }
  if (adminUser && interstellarContent) {
    insertHistory.run(adminUser.id, interstellarContent.id, null, 5670, 10140, daysAgo(5), 0); // In progress
  }

  // Demo user watch history - series
  if (demoUser && bbContent) {
    const bbEp1 = getEpisode('Breaking Bad', 1, 1);
    const bbEp2 = getEpisode('Breaking Bad', 1, 2);
    const bbEp3 = getEpisode('Breaking Bad', 1, 3);

    if (bbEp1) insertHistory.run(demoUser.id, bbContent.id, bbEp1.id, 2700, 2700, daysAgo(14), 1);
    if (bbEp2) insertHistory.run(demoUser.id, bbContent.id, bbEp2.id, 2700, 2700, daysAgo(12), 1);
    if (bbEp3) insertHistory.run(demoUser.id, bbContent.id, bbEp3.id, 1800, 2700, daysAgo(2), 0); // Currently watching
  }

  if (demoUser && strangerThingsFav) {
    const stEp1 = getEpisode('Stranger Things', 1, 1);
    const stEp2 = getEpisode('Stranger Things', 1, 2);

    if (stEp1) insertHistory.run(demoUser.id, strangerThingsFav.id, stEp1.id, 3000, 3000, daysAgo(10), 1);
    if (stEp2) insertHistory.run(demoUser.id, strangerThingsFav.id, stEp2.id, 2100, 3000, daysAgo(3), 0);
  }

  // Demo user - anime
  if (demoUser && aotFav) {
    const aotEp1 = getEpisode('Attack on Titan', 1, 1);
    if (aotEp1) insertHistory.run(demoUser.id, aotFav.id, aotEp1.id, 1440, 1440, daysAgo(7), 1);
  }

  // Maria watch history
  if (mariaUser && deathNoteFav) {
    const dnEp1 = getEpisode('Death Note', 1, 1);
    const dnEp2 = getEpisode('Death Note', 1, 2);

    if (dnEp1) insertHistory.run(mariaUser.id, deathNoteFav.id, dnEp1.id, 1380, 1380, daysAgo(9), 1);
    if (dnEp2) insertHistory.run(mariaUser.id, deathNoteFav.id, dnEp2.id, 900, 1380, daysAgo(1), 0);
  }

  if (mariaUser && demonSlayerFav) {
    const dsEp1 = getEpisode('Demon Slayer', 1, 1);
    if (dsEp1) insertHistory.run(mariaUser.id, demonSlayerFav.id, dsEp1.id, 1380, 1380, daysAgo(6), 1);
  }

  if (mariaUser && parasiteContent) {
    insertHistory.run(mariaUser.id, parasiteContent.id, null, 7680, 7680, daysAgo(4), 1);
  }

  // ============ SUBTITLES ============
  const insertSubtitle = db.prepare('INSERT INTO subtitles (episode_id, language, url, created_at) VALUES (?, ?, ?, ?)');

  // Add subtitles for some episodes
  const episodesForSubs = db.prepare('SELECT id FROM episodes LIMIT 20').all();
  const languages = ['English', 'Italiano', 'Español', 'Français'];

  episodesForSubs.forEach((ep, i) => {
    // Each episode gets 2-3 subtitle tracks
    const langs = languages.slice(0, 2 + (i % 2));
    langs.forEach((lang, j) => {
      const langCode = { 'English': 'en', 'Italiano': 'it', 'Español': 'es', 'Français': 'fr' }[lang];
      insertSubtitle.run(
        ep.id,
        lang,
        `https://cdn.streambox.app/subs/${langCode}/ep${ep.id}.vtt`,
        daysAgo(20 - i * 0.8)
      );
    });
  });
});

// Execute the seeding
seedAll();

// Get counts for summary
const userCount = db.prepare('SELECT COUNT(*) as count FROM users').get().count;
const contentCount = db.prepare('SELECT COUNT(*) as count FROM content').get().count;
const seasonCount = db.prepare('SELECT COUNT(*) as count FROM seasons').get().count;
const episodeCount = db.prepare('SELECT COUNT(*) as count FROM episodes').get().count;
const favoriteCount = db.prepare('SELECT COUNT(*) as count FROM favorites').get().count;
const historyCount = db.prepare('SELECT COUNT(*) as count FROM watch_history').get().count;
const extensionCount = db.prepare('SELECT COUNT(*) as count FROM extensions').get().count;
const subtitleCount = db.prepare('SELECT COUNT(*) as count FROM subtitles').get().count;

db.close();

console.log('StreamBox database seeded successfully!');
console.log('====================================');
console.log(`Seeded: ${userCount} users, ${contentCount} content items, ${seasonCount} seasons, ${episodeCount} episodes`);
console.log(`        ${favoriteCount} favorites, ${historyCount} watch history entries, ${extensionCount} extensions, ${subtitleCount} subtitles`);
console.log('');
console.log('Demo credentials:');
console.log('  admin@streambox.app / admin123');
console.log('  demo@streambox.app / password123');
console.log('  maria.rossi@email.com / maria2024');