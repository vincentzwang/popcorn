import Database from "better-sqlite3";
import path from "path";
import { SEED_MOVIES } from "./seed-movies";

const DB_PATH = path.join(process.cwd(), "popcorn.db");
let db: Database.Database;

function getDb(): Database.Database {
  if (!db) {
    db = new Database(DB_PATH);
    db.pragma("journal_mode = WAL");
    db.pragma("foreign_keys = ON");
    initSchema(db);
    seedMovies(db);
  }
  return db;
}

function initSchema(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      onboarded INTEGER NOT NULL DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS movies (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tmdb_id INTEGER UNIQUE NOT NULL,
      title TEXT NOT NULL,
      poster_path TEXT,
      backdrop_path TEXT,
      release_year INTEGER,
      overview TEXT,
      director TEXT,
      runtime INTEGER,
      genres TEXT,
      streaming TEXT
    );

    CREATE TABLE IF NOT EXISTS user_movies (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      movie_id INTEGER NOT NULL REFERENCES movies(id),
      tier TEXT NOT NULL CHECK(tier IN ('liked','fine','disliked')),
      position INTEGER NOT NULL DEFAULT 0,
      score REAL,
      review TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(user_id, movie_id)
    );

    CREATE TABLE IF NOT EXISTS comparisons (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      winner_um_id INTEGER NOT NULL REFERENCES user_movies(id) ON DELETE CASCADE,
      loser_um_id INTEGER NOT NULL REFERENCES user_movies(id) ON DELETE CASCADE,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS follows (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      follower_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      following_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(follower_id, following_id)
    );

    CREATE TABLE IF NOT EXISTS watchlist (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      movie_id INTEGER NOT NULL REFERENCES movies(id) ON DELETE CASCADE,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(user_id, movie_id)
    );

    CREATE TABLE IF NOT EXISTS comments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      movie_id INTEGER NOT NULL REFERENCES movies(id) ON DELETE CASCADE,
      body TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS ai_recommendations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE UNIQUE,
      tmdb_ids TEXT NOT NULL,
      rating_count INTEGER NOT NULL DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS watched_with (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_movie_id INTEGER NOT NULL REFERENCES user_movies(id) ON DELETE CASCADE UNIQUE,
      partner_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_watched_with_partner ON watched_with(partner_id);

    CREATE TABLE IF NOT EXISTS rating_likes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      liker_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      user_movie_id INTEGER NOT NULL REFERENCES user_movies(id) ON DELETE CASCADE,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(liker_id, user_movie_id)
    );

    CREATE TABLE IF NOT EXISTS rating_comments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      user_movie_id INTEGER NOT NULL REFERENCES user_movies(id) ON DELETE CASCADE,
      body TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS notifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      actor_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      actor_username TEXT NOT NULL,
      type TEXT NOT NULL CHECK(type IN ('follow','like','comment')),
      message TEXT NOT NULL,
      link TEXT,
      read INTEGER NOT NULL DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_notifs_user ON notifications(user_id, read);

    CREATE TABLE IF NOT EXISTS showtime_cache (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      cache_key TEXT UNIQUE NOT NULL,
      data TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_user_movies_user ON user_movies(user_id);
    CREATE INDEX IF NOT EXISTS idx_user_movies_tier ON user_movies(user_id, tier);
    CREATE INDEX IF NOT EXISTS idx_comparisons_user ON comparisons(user_id);
    CREATE INDEX IF NOT EXISTS idx_follows_follower ON follows(follower_id);
    CREATE INDEX IF NOT EXISTS idx_follows_following ON follows(following_id);
    CREATE INDEX IF NOT EXISTS idx_watchlist_user ON watchlist(user_id);
    CREATE INDEX IF NOT EXISTS idx_comments_movie ON comments(movie_id);
  `);

  // Non-destructive migrations for existing DBs
  // ai_recommendations: add reasoning column
  const aiCols = (db.prepare("PRAGMA table_info(ai_recommendations)").all() as { name: string }[]).map(c => c.name);
  if (!aiCols.includes("reasoning")) db.exec("ALTER TABLE ai_recommendations ADD COLUMN reasoning TEXT");

  const cols = (db.prepare("PRAGMA table_info(movies)").all() as { name: string }[]).map(c => c.name);
  if (!cols.includes("runtime"))   db.exec("ALTER TABLE movies ADD COLUMN runtime INTEGER");
  if (!cols.includes("genres"))    db.exec("ALTER TABLE movies ADD COLUMN genres TEXT");
  if (!cols.includes("streaming")) db.exec("ALTER TABLE movies ADD COLUMN streaming TEXT");

  const ucols = (db.prepare("PRAGMA table_info(users)").all() as { name: string }[]).map(c => c.name);
  if (!ucols.includes("onboarded")) db.exec("ALTER TABLE users ADD COLUMN onboarded INTEGER NOT NULL DEFAULT 0");
}

function seedMovies(db: Database.Database) {
  const count = (db.prepare("SELECT COUNT(*) as n FROM movies").get() as { n: number }).n;
  if (count > 0) return;
  const insert = db.prepare(`INSERT OR IGNORE INTO movies (tmdb_id,title,poster_path,backdrop_path,release_year,overview,director) VALUES (@tmdb_id,@title,@poster_path,@backdrop_path,@release_year,@overview,@director)`);
  const insertMany = db.transaction((movies: typeof SEED_MOVIES) => { for (const m of movies) insert.run(m); });
  insertMany(SEED_MOVIES);
}

export default getDb;
