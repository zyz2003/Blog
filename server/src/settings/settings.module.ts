import { Global, Module } from '@nestjs/common';
import { SettingsService } from './settings.service';
import { SettingsController, SiteConfigController } from './settings.controller';

@Global()
@Module({
  providers: [
    SettingsService,
  ],
  controllers: [SettingsController, SiteConfigController],
  exports: [SettingsService],
})
export class SettingsModule {}
