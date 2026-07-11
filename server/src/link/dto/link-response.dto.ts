import { LinkCategoryResponseDto } from './link-category-response.dto';
import { LinkTagResponseDto } from './link-tag-response.dto';

/**
 * LinkResponseDto — matches Go LinkDTO JSON fields exactly.
 * Per D-179: tag is a single object (not array), matching Go backend's current implementation.
 */
export class LinkResponseDto {
  id: number;
  name: string;
  url: string;
  rss_url?: string;
  logo: string;
  description: string;
  status: string;
  siteshot?: string;
  email?: string;
  type?: string;
  original_url?: string;
  update_reason?: string;
  sort_order: number;
  skip_health_check: boolean;
  category: LinkCategoryResponseDto | null;
  tag: LinkTagResponseDto | null;
}
