import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { SettingsModule } from '../settings/settings.module';
import { LinkController } from './link.controller';
import { LinkService } from './link.service';
import { LinkRepository } from './link.repository';
import { LinkApplyRateLimiter } from './link-apply-rate-limiter';

/**
 * LinkModule — wires all friend link-related controllers, services, and dependencies.
 *
 * Imports:
 * - DatabaseModule: provides DRIZZLE injection token for DB queries
 * - SettingsModule: provides SettingsService for dynamic config reading
 *
 * Providers:
 * - LinkRepository: Drizzle query methods for link/category/tag/pivot CRUD
 * - LinkService: business logic for all link operations
 * - LinkApplyRateLimiter: IP-dimension rate limiting per D-171
 * - LinkController: all public + admin endpoints
 *
 * Exports:
 * - LinkService: for potential future use by other modules
 */
@Module({
  imports: [DatabaseModule, SettingsModule],
  controllers: [LinkController],
  providers: [LinkService, LinkRepository, LinkApplyRateLimiter],
  exports: [LinkService],
})
export class LinkModule {}
