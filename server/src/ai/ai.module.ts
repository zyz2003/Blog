import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { SettingsModule } from '../settings/settings.module';
import { AiSummaryController } from './ai-summary.controller';
import { ModelResolver } from './model/model-resolver.service';
import { SummaryAdapter } from './adapters/summary.adapter';
import { ArticleAiPort } from './ports/ai.port';

@Module({
  imports: [DatabaseModule, SettingsModule],
  controllers: [AiSummaryController],
  providers: [
    ModelResolver,
    { provide: 'ARTICLE_AI_PORT', useClass: SummaryAdapter },
  ],
  exports: ['ARTICLE_AI_PORT'],
})
export class AiModule {}
