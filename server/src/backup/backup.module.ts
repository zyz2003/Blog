import { Module } from '@nestjs/common';
import { SettingsModule } from '../settings/settings.module';
import { BackupService } from './backup.service';

@Module({
  imports: [SettingsModule],
  providers: [BackupService],
  exports: [BackupService],
})
export class BackupModule {}
