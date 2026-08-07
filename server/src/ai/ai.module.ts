import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { SettingsModule } from '../settings/settings.module';
import { SearchModule } from '../search/search.module';
import { ArticleModule } from '../article/article.module';
import { AiSummaryController } from './ai-summary.controller';
import { AiChatController } from './ai-chat.controller';
import { AiWritingController } from './writing/ai-writing.controller';
import { ModelResolver } from './model/model-resolver.service';
import { SummaryAdapter } from './adapters/summary.adapter';
import { ChatService } from './chat.service';
import { ChatHistoryService } from './chat-history.service';
import { AiWritingService } from './writing/ai-writing.service';
import { ToolRegistry } from './tools/tool-registry';
import { ExternalToolService } from './tools/external/external-tool.service';
import { McpClientManager } from './tools/external/mcp-client-manager';

@Module({
  imports: [DatabaseModule, SettingsModule, SearchModule, ArticleModule],
  controllers: [AiSummaryController, AiChatController, AiWritingController],
  providers: [
    ModelResolver,
    ChatService,
    ChatHistoryService,
    AiWritingService,
    ToolRegistry,
    ExternalToolService,
    McpClientManager,
    { provide: 'ARTICLE_AI_PORT', useClass: SummaryAdapter },
  ],
  exports: ['ARTICLE_AI_PORT', ChatService, ChatHistoryService],
})
export class AiModule {}
