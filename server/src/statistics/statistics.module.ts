import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { WeatherModule } from '../weather/weather.module';
import { SettingsModule } from '../settings/settings.module';
import { StatisticsController } from './statistics.controller';
import { StatisticsService } from './statistics.service';
import { StatisticsRepository } from './statistics.repository';
import { UAParserService } from './ua-parser';
import { VisitorDedupService } from './visitor-dedup';

/**
 * StatisticsModule — wires all statistics-related controllers, services, and dependencies.
 *
 * Imports:
 * - DatabaseModule: provides DRIZZLE injection token for DB queries
 * - WeatherModule: provides GeoIPService for IP geolocation per D-164
 * - SettingsModule: provides SettingsService (also @Global, but explicit import for clarity)
 *
 * Provides:
 * - StatisticsRepository: Drizzle query methods for visitor_logs, visitor_stats, url_stats
 * - UAParserService: UA parsing with MD5-keyed 12h TTL cache per D-165
 * - VisitorDedupService: in-memory visitor dedup with TTL per D-161
 * - StatisticsService: 7 business methods per D-160 through D-169
 * - StatisticsController: 7 endpoints (2 public + 5 admin) per D-169
 *
 * Exports:
 * - StatisticsService: for potential future use by other modules
 */
@Module({
  imports: [DatabaseModule, WeatherModule, SettingsModule],
  controllers: [StatisticsController],
  providers: [
    StatisticsRepository,
    UAParserService,
    VisitorDedupService,
    StatisticsService,
  ],
  exports: [StatisticsService],
})
export class StatisticsModule {}
