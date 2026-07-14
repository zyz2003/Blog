import { Global, Module } from '@nestjs/common';
import { SettingsModule } from '../settings/settings.module';
import { EmailService } from './email.service';

/**
 * EmailModule provides EmailService for SMTP email sending.
 * Per D-206: EmailService reads SMTP config from SettingsService,
 * silently skips when SMTP is not configured.
 *
 * SettingsModule is @Global but imported explicitly for clarity.
 * EmailModule is @Global so SubscriberModule and other consumers
 * can inject EmailService without importing EmailModule directly.
 */
@Global()
@Module({
  imports: [SettingsModule],
  providers: [EmailService],
  exports: [EmailService],
})
export class EmailModule {}
