import { Module } from '@nestjs/common';
import { CommonModule } from '../common/common.module';
import { SettingsModule } from '../settings/settings.module';
import { MusicController } from './music.controller';
import { MusicService } from './music.service';

/**
 * MusicModule — matches Go music module.
 * Provides MusicService (metings API proxy + caching) and MusicController.
 *
 * Imports:
 * - CommonModule: provides MemoryCache for playlist caching
 * - SettingsModule: provides SettingsService for API config (music.api.base_url, music.player.playlist_id)
 */
@Module({
  imports: [CommonModule, SettingsModule],
  controllers: [MusicController],
  providers: [MusicService],
  exports: [MusicService],
})
export class MusicModule {}
