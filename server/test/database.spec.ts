import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import Database from 'better-sqlite3';
import { existsSync, mkdirSync, rmSync } from 'fs';
import { dirname, join } from 'path';

describe('Database Connection and PRAGMA Verification', () => {
  const testDbPath = join(process.cwd(), 'data', 'test-pragmas.db');
  let db: Database.Database;

  beforeAll(() => {
    // Ensure data/ directory exists
    const dir = dirname(testDbPath);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
    db = new Database(testDbPath);
  });

  afterAll(() => {
    if (db) db.close();
    // Clean up test database
    if (existsSync(testDbPath)) {
      rmSync(testDbPath, { force: true });
    }
    // Also clean up WAL files
    const walPath = testDbPath + '-wal';
    const shmPath = testDbPath + '-shm';
    if (existsSync(walPath)) rmSync(walPath, { force: true });
    if (existsSync(shmPath)) rmSync(shmPath, { force: true });
  });

  it('should create data/ directory if it does not exist', () => {
    const dataDir = join(process.cwd(), 'data');
    expect(existsSync(dataDir)).toBe(true);
  });

  it('should connect to SQLite database', () => {
    expect(db).toBeDefined();
    // Simple query to verify connection works
    const result = db.prepare('SELECT 1 as value').get() as { value: number };
    expect(result.value).toBe(1);
  });

  it('should enable WAL journal mode', () => {
    db.pragma('journal_mode = WAL');
    const result = db.pragma('journal_mode', { simple: true });
    expect(result).toBe('wal');
  });

  it('should set busy_timeout to 5000ms', () => {
    db.pragma('busy_timeout = 5000');
    const result = db.pragma('busy_timeout', { simple: true });
    expect(result).toBe(5000);
  });

  it('should enable foreign key enforcement', () => {
    db.pragma('foreign_keys = ON');
    const result = db.pragma('foreign_keys', { simple: true });
    expect(result).toBe(1);
  });
});

describe('Production Database PRAGMA Verification', () => {
  const prodDbPath = join(process.cwd(), 'data', 'anheyu.db');
  let db: Database.Database;

  beforeAll(() => {
    if (!existsSync(prodDbPath)) {
      throw new Error(`Production database not found at ${prodDbPath}. Run drizzle-kit push first.`);
    }
    db = new Database(prodDbPath);
  });

  afterAll(() => {
    if (db) db.close();
  });

  it('should have WAL mode enabled on production database', () => {
    const result = db.pragma('journal_mode', { simple: true });
    expect(result).toBe('wal');
  });

  it('should have busy_timeout=5000 on production database', () => {
    const result = db.pragma('busy_timeout', { simple: true });
    expect(result).toBe(5000);
  });

  it('should have foreign_keys=ON on production database', () => {
    const result = db.pragma('foreign_keys', { simple: true });
    expect(result).toBe(1);
  });
});
