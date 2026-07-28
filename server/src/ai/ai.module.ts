import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { SettingsModule } from '../settings/settings.module';
import { SearchModule } from '../search/search.module';
import { ArticleModule } from '../article/article.module';
import { AiSummaryController } from './ai-summary.controller';
import { AiChatController } from './ai-chat.controller';
import { ModelResolver } from './model/model-resolver.service';
import { SummaryAdapter } from './adapters/summary.adapter';
import { ChatService } from './chat.service';
import { ArticleAiPort } from './ports/ai.port';
import { ChatHistoryService } from './chat-history.service';

@Module({
  imports: [DatabaseModule, SettingsModule, SearchModule, ArticleModule],
  controllers: [AiSummaryController, AiChatController],
  providers: [
    ModelResolver,
    ChatService,
    ChatHistoryService,
    { provide: 'ARTICLE_AI_PORT', useClass: SummaryAdapter },
  ],
  exports: ['ARTICLE_AI_PORT', ChatService, ChatHistoryService],
})
export class AiModule {}
