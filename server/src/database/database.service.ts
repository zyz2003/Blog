import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { drizzle, BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import Database from 'better-sqlite3';
import { existsSync, mkdirSync } from 'fs';
import { dirname } from 'path';
import * as schema from './schemas';

@Injectable()
export class DatabaseService implements OnModuleDestroy {
  private readonly sqlite: Database.Database;
  private readonly db: BetterSQLite3Database<typeof schema>;

  constructor(private readonly configService: ConfigService) {
    const dbPath = this.configService.get<string>('DB_PATH', 'data/blog.db');

    // Ensure data/ directory exists
    const dir = dirname(dbPath);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }

    // Create better-sqlite3 connection
    this.sqlite = new Database(dbPath);

    // Enable WAL mode for concurrent reads
    this.sqlite.pragma('journal_mode = WAL');

    // Set busy timeout to 5000ms for write contention
    this.sqlite.pragma('busy_timeout = 5000');

    // Enable foreign key enforcement
    this.sqlite.pragma('foreign_keys = ON');

    // Create drizzle instance with schema
    this.db = drizzle(this.sqlite, { schema });
  }

  getDb(): BetterSQLite3Database<typeof schema> {
    return this.db;
  }

  onModuleDestroy() {
    this.sqlite.close();
  }
}
