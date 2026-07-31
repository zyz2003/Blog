import { Module } from '@nestjs/common';
import { SettingsModule } from '../settings/settings.module';
import { GeoIPService } from './geoip.service';
import { WeatherService } from './weather.service';
import { WeatherController } from './weather.controller';

/**
 * WeatherModule - provides IP geolocation + weather proxy endpoints.
 *
 * Per D-143: GeoIPService is exported for CommentModule to inject into
 * CommentService.lookupIPLocation (replacing the @Optional() HTTP fallback).
 * Per D-144: Default coordinates from sidebar.weather.rectangle setting.
 *
 * WeatherService: 和风天气代理，持有私有 qweather_key，前端不直连和风。
 */
@Module({
  imports: [SettingsModule],
  controllers: [WeatherController],
  providers: [GeoIPService, WeatherService],
  exports: [GeoIPService],
})
export class WeatherModule {}
