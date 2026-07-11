import { Inject, Injectable } from '@nestjs/common';
import { DRIZZLE } from '../database/database.module';
import { visitorLogs } from '../database/schemas/visitor-log.schema';
import { visitorStats } from '../database/schemas/visitor-stat.schema';
import { urlStats } from '../database/schemas/url-stat.schema';
import { eq, and, gte, lte, desc, sql } from 'drizzle-orm';

/**
 * Get China timezone (UTC+8) day boundaries as Unix timestamps.
 * Matches Go backend: start of day = 00:00:00+08:00, end of day = 23:59:59+08:00.
 * Returns [startTimestamp, endTimestamp] in seconds.
 */
function getChinaDayBounds(date: Date): [number, number] {
  // Format date as YYYY-MM-DD in China timezone
  const chinaOffset = 8 * 60 * 60 * 1000;
  const chinaTime = new Date(date.getTime() + chinaOffset);
  const dateStr = chinaTime.toISOString().slice(0, 10); // YYYY-MM-DD

  // Start of day in China: YYYY-MM-DDT00:00:00+08:00
  const startMs = new Date(`${dateStr}T00:00:00+08:00`).getTime() / 1000;
  // End of day in China: YYYY-MM-DDT23:59:59+08:00
  const endMs = new Date(`${dateStr}T23:59:59+08:00`).getTime() / 1000;

  return [Math.floor(startMs), Math.floor(endMs)];
}

export interface CreateLogParams {
  visitorId: string;
  sessionId?: string | null;
  ipAddress: string;
  userAgent?: string | null;
  referer?: string | null;
  urlPath: string;
  country?: string | null;
  region?: string | null;
  city?: string | null;
  browser?: string | null;
  os?: string | null;
  device?: string | null;
  duration: number;
  isBounce: boolean;
}

@Injectable()
export class StatisticsRepository {
  constructor(@Inject(DRIZZLE) private readonly db: any) {}

  /**
   * Insert a visitor_logs record. Returns inserted record.
   */
  async createLog(params: CreateLogParams) {
    const [log] = await this.db
      .insert(visitorLogs)
      .values(params)
      .returning();
    return log;
  }

  /**
   * Count rows in visitor_logs where createdAt falls within the given date (China timezone day boundary).
   * Uses sql template for raw SQL per D-167.
   */
  async countTotalViews(date: Date): Promise<number> {
    const [startTs, endTs] = getChinaDayBounds(date);
    const result = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(visitorLogs)
      .where(
        and(
          gte(visitorLogs.createdAt, sql`${startTs}`),
          lte(visitorLogs.createdAt, sql`${endTs}`),
        ),
      );

    return result[0]?.count ?? 0;
  }

  /**
   * Count distinct visitorId in visitor_logs for the given date (China timezone).
   * Uses sql template for raw SQL per D-167.
   */
  async countUniqueVisitors(date: Date): Promise<number> {
    const [startTs, endTs] = getChinaDayBounds(date);
    const result = await this.db
      .select({ count: sql<number>`count(distinct ${visitorLogs.visitorId})` })
      .from(visitorLogs)
      .where(
        and(
          gte(visitorLogs.createdAt, sql`${startTs}`),
          lte(visitorLogs.createdAt, sql`${endTs}`),
        ),
      );

    return result[0]?.count ?? 0;
  }

  /**
   * Query visitor_stats where date matches. Returns row or undefined.
   */
  async getVisitorStatsByDate(date: Date) {
    const [row] = await this.db
      .select()
      .from(visitorStats)
      .where(eq(visitorStats.date, date));
    return row ?? undefined;
  }

  /**
   * Query visitor_stats where date is between startDate and endDate.
   * Returns array of rows. Used for month/year aggregation.
   */
  async getVisitorStatsByDateRange(startDate: Date, endDate: Date) {
    return this.db
      .select()
      .from(visitorStats)
      .where(
        and(
          gte(visitorStats.date, startDate),
          lte(visitorStats.date, endDate),
        ),
      );
  }

  /**
   * Create or update visitor_stats for a date.
   * If exists: increment totalViews+1, uniqueVisitors+(isUnique?1:0), pageViews+1, bounceCount+(isBounce?1:0).
   * If not exists: insert new row with initial values.
   * Uses Drizzle sql template for atomic increment per D-167.
   */
  async upsertVisitorStats(date: Date, isUnique: boolean, isBounce: boolean): Promise<void> {
    const existing = await this.getVisitorStatsByDate(date);

    if (existing) {
      // Atomic increment using sql template
      await this.db
        .update(visitorStats)
        .set({
          totalViews: sql`${visitorStats.totalViews} + 1`,
          uniqueVisitors: sql`${visitorStats.uniqueVisitors} + ${isUnique ? 1 : 0}`,
          pageViews: sql`${visitorStats.pageViews} + 1`,
          bounceCount: sql`${visitorStats.bounceCount} + ${isBounce ? 1 : 0}`,
          updatedAt: new Date(),
        })
        .where(eq(visitorStats.id, existing.id));
    } else {
      await this.db
        .insert(visitorStats)
        .values({
          date,
          totalViews: 1,
          uniqueVisitors: isUnique ? 1 : 0,
          pageViews: 1,
          bounceCount: isBounce ? 1 : 0,
        })
        .returning();
    }
  }

  /**
   * Create or update url_stats for a URL path.
   * If exists: update totalViews+1, uniqueViews+(isUnique?1:0), bounceCount+(isBounce?1:0),
   *   recalculate avgDuration as weighted average, set lastVisitedAt=now.
   * If not exists: insert new row.
   * Uses Drizzle sql template for atomic operations per D-167.
   */
  async incrementUrlStats(
    urlPath: string,
    isUnique: boolean,
    duration: number,
    isBounce: boolean,
  ): Promise<void> {
    const [existing] = await this.db
      .select()
      .from(urlStats)
      .where(eq(urlStats.urlPath, urlPath));

    if (existing) {
      // Weighted average: (old_avg * old_count + new_duration) / (old_count + 1)
      const newTotalViews = existing.totalViews + 1;
      const newAvgDuration =
        (existing.avgDuration * existing.totalViews + duration) / newTotalViews;

      await this.db
        .update(urlStats)
        .set({
          totalViews: sql`${urlStats.totalViews} + 1`,
          uniqueViews: sql`${urlStats.uniqueViews} + ${isUnique ? 1 : 0}`,
          bounceCount: sql`${urlStats.bounceCount} + ${isBounce ? 1 : 0}`,
          avgDuration: newAvgDuration,
          lastVisitedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(urlStats.id, existing.id));
    } else {
      await this.db
        .insert(urlStats)
        .values({
          urlPath,
          totalViews: 1,
          uniqueViews: isUnique ? 1 : 0,
          bounceCount: isBounce ? 1 : 0,
          avgDuration: duration,
          lastVisitedAt: new Date(),
        })
        .returning();
    }
  }

  /**
   * Query url_stats ORDER BY total_views DESC LIMIT limit.
   * Uses Drizzle query builder (simple query per D-167).
   */
  async getTopPages(limit: number) {
    return this.db
      .select()
      .from(urlStats)
      .orderBy(desc(urlStats.totalViews))
      .limit(limit);
  }

  /**
   * Execute 6 GROUP BY queries on visitor_logs for the date range.
   * Each returns top N results per dimension.
   * Uses sql template tag for raw SQL per D-167.
   * Returns object with all 6 arrays.
   */
  async getVisitorAnalytics(startDate: Date, endDate: Date) {
    const [startTs, endTs] = getChinaDayBounds(startDate);
    // For endDate, we need end-of-day boundary
    const [, endTs2] = getChinaDayBounds(endDate);

    const dimensionQueries = [
      {
        key: 'top_browsers' as const,
        field: 'browser' as const,
        alias: 'name' as const,
      },
      {
        key: 'top_os' as const,
        field: 'os' as const,
        alias: 'name' as const,
      },
      {
        key: 'top_devices' as const,
        field: 'device' as const,
        alias: 'name' as const,
      },
      {
        key: 'top_cities' as const,
        field: 'city' as const,
        alias: 'name' as const,
      },
      {
        key: 'top_countries' as const,
        field: 'country' as const,
        alias: 'name' as const,
      },
      {
        key: 'top_referers' as const,
        field: 'referer' as const,
        alias: 'name' as const,
      },
    ];

    const results: Record<string, any[]> = {};

    for (const dim of dimensionQueries) {
      const query = sql`SELECT ${sql.identifier(dim.field)} as name, COUNT(*) as count
        FROM visitor_logs
        WHERE created_at >= ${startTs} AND created_at <= ${endTs2}
          AND ${sql.identifier(dim.field)} IS NOT NULL AND ${sql.identifier(dim.field)} != ''
        GROUP BY ${sql.identifier(dim.field)}
        ORDER BY count DESC
        LIMIT 10`;

      results[dim.key] = await this.db.all(query);
    }

    return {
      top_browsers: results.top_browsers,
      top_os: results.top_os,
      top_devices: results.top_devices,
      top_cities: results.top_cities,
      top_countries: results.top_countries,
      top_referers: results.top_referers,
    };
  }

  /**
   * Query visitor_logs with date range filter, paginated with offset/limit.
   * Returns { list, total }.
   * Uses Drizzle query builder per D-167.
   */
  async getVisitorLogsByTimeRange(
    startDate: Date,
    endDate: Date,
    page: number,
    pageSize: number,
  ) {
    const [startTs, endTs] = getChinaDayBounds(startDate);
    const [, endTs2] = getChinaDayBounds(endDate);

    const conditions = and(
      gte(visitorLogs.createdAt, sql`${startTs}`),
      lte(visitorLogs.createdAt, sql`${endTs2}`),
    );

    const [{ count: total }] = await this.db
      .select({ count: sql`count(*)` })
      .from(visitorLogs)
      .where(conditions);

    const list = await this.db
      .select()
      .from(visitorLogs)
      .where(conditions)
      .orderBy(desc(visitorLogs.createdAt))
      .limit(pageSize)
      .offset((page - 1) * pageSize);

    return { list, total };
  }
}
