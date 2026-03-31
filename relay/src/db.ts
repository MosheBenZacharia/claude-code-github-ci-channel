import { Database } from 'bun:sqlite'
import { mkdirSync } from 'node:fs'
import { dirname } from 'node:path'

let db: Database

export function initDatabase(path: string): Database {
  mkdirSync(dirname(path), { recursive: true })
  db = new Database(path, { create: true })
  db.exec('PRAGMA journal_mode = WAL')
  db.exec('PRAGMA foreign_keys = ON')

  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id             TEXT PRIMARY KEY,
      github_user_id TEXT UNIQUE NOT NULL,
      github_login   TEXT NOT NULL,
      webhook_secret TEXT NOT NULL,
      created_at     INTEGER NOT NULL
    )
  `)

  db.exec(`
    CREATE TABLE IF NOT EXISTS client_tokens (
      token_hash  TEXT PRIMARY KEY,
      user_id     TEXT NOT NULL REFERENCES users(id),
      created_at  INTEGER NOT NULL,
      last_seen   INTEGER,
      revoked_at  INTEGER
    )
  `)

  return db
}

export function getDb(): Database {
  return db
}
