import { Controller, Get, Req, Res, Logger } from '@nestjs/common';
import { Public } from '../common/decorators/public.decorator';
import { RssService } from './rss.service';
import type { Request, Response } from 'express';

@Public()
@Controller()
export class RssController {
  private readonly logger = new Logger(RssController.name);

  constructor(private readonly rssService: RssService) {}

  /**
   * GET /rss.xml — RSS 2.0 feed with Content-Type application/rss+xml.
   * Matches Go GetRSSFeed for /rss.xml path.
   * Uses @Res() to bypass global ResponseInterceptor (per D-216).
   */
  @Get('rss.xml')
  getRSSFeed(@Req() req: Request, @Res() res: Response): void {
    this.handleFeedRequest(req, res, 'application/rss+xml; charset=utf-8');
  }

  /**
   * GET /feed.xml — Same as /rss.xml, same Content-Type.
   * Matches Go GetRSSFeed for /feed.xml path.
   */
  @Get('feed.xml')
  getFeedXml(@Req() req: Request, @Res() res: Response): void {
    this.handleFeedRequest(req, res, 'application/rss+xml; charset=utf-8');
  }

  /**
   * GET /atom.xml — Same RSS 2.0 XML content, but Content-Type application/atom+xml.
   * Matches Go GetRSSFeed for /atom.xml path.
   */
  @Get('atom.xml')
  getAtomXml(@Req() req: Request, @Res() res: Response): void {
    this.handleFeedRequest(req, res, 'application/atom+xml; charset=utf-8');
  }

  /**
   * Common handler for all three RSS endpoints.
   * Generates feed, builds XML, sets headers, sends response.
   * On error: returns text/plain with 500 status (matches Go error handling).
   */
  private async handleFeedRequest(
    req: Request,
    res: Response,
    contentType: string,
  ): Promise<void> {
    try {
      const baseURL = this.rssService.getBaseURL(req);
      const feed = await this.rssService.generateFeed({
        itemCount: 20,
        baseURL,
        buildTime: new Date(),
      });
      const xml = this.rssService.generateXML(feed);

      res.setHeader('Content-Type', contentType);
      res.setHeader('Cache-Control', 'public, max-age=3600');
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('Last-Modified', new Date().toUTCString());
      res.send(xml);
    } catch (error) {
      this.logger.error('RSS feed generation failed', error);
      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      res.status(500).send('RSS feed generation failed');
    }
  }
}
