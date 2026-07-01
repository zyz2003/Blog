import { Global, Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { SettingsService } from './settings.service';
import { SettingsController, SiteConfigController } from './settings.controller';

@Global()
@Module({
  imports: [DatabaseModule],
  providers: [
    SettingsService,
  ],
  controllers: [SettingsController, SiteConfigController],
  exports: [SettingsService],
})
export class SettingsModule {}
