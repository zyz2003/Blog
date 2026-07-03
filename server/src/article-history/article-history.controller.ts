import { Controller } from '@nestjs/common';
import { ArticleHistoryService } from './article-history.service';

/**
 * ArticleHistoryController — placeholder for Task 2.
 * Full endpoint implementation follows in Task 2.
 */
@Controller('articles/:articleId/history')
export class ArticleHistoryController {
  constructor(private readonly historyService: ArticleHistoryService) {}
}
