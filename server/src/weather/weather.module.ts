import { Module } from '@nestjs/common';
import { SettingsModule } from '../settings/settings.module';
import { GeoIPService } from './geoip.service';
import { WeatherController } from './weather.controller';

/**
 * WeatherModule — provides IP geolocation endpoint and GeoIPService.
 *
 * Per D-143: GeoIPService is exported for CommentModule to inject into
 * CommentService.lookupIPLocation (replacing the @Optional() HTTP fallback).
 * Per D-144: Default coordinates from sidebar.weather.rectangle setting.
 */
@Module({
  imports: [SettingsModule],
  controllers: [WeatherController],
  providers: [GeoIPService],
  exports: [GeoIPService],
})
export class WeatherModule {}
