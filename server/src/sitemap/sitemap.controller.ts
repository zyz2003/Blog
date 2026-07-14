import { Controller, Get, Res, Logger } from '@nestjs/common';
import { Public } from '../common/decorators/public.decorator';
import { SitemapService } from './sitemap.service';
import type { Response } from 'express';

@Public()
@Controller()
export class SitemapController {
  private readonly logger = new Logger(SitemapController.name);

  constructor(private readonly sitemapService: SitemapService) {}

  /**
   * GET /sitemap.xml — XML sitemap with all URL entries.
   * Matches Go GetSitemap (pkg/handler/sitemap/handler.go).
   * Uses @Res() to bypass global ResponseInterceptor for XML output.
   */
  @Get('sitemap.xml')
  async getSitemap(@Res() res: Response): Promise<void> {
    try {
      const urlSet = await this.sitemapService.generateSitemap();
      const xml = this.sitemapService.generateXML(urlSet);

      res.setHeader('Content-Type', 'text/xml; charset=utf-8');
      res.setHeader('Cache-Control', 'public, max-age=3600');
      res.setHeader('Last-Modified', new Date().toUTCString());
      res.send(xml);
    } catch (error) {
      this.logger.error('Sitemap generation failed', error);
      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      res.status(500).send('Sitemap generation failed');
    }
  }

  /**
   * GET /robots.txt — Robots exclusion file.
   * Matches Go GetRobots (pkg/handler/sitemap/handler.go).
   * Uses @Res() to bypass global ResponseInterceptor for plain text output.
   */
  @Get('robots.txt')
  getRobots(@Res() res: Response): void {
    try {
      const text = this.sitemapService.generateRobots();

      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      res.setHeader('Cache-Control', 'public, max-age=86400');
      res.send(text);
    } catch (error) {
      this.logger.error('Robots.txt generation failed', error);
      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      res.status(500).send('Robots.txt generation failed');
    }
  }
}
