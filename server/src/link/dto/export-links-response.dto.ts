/**
 * ExportLinkItem — matches Go ImportLinkItem for export format.
 * Used in ExportLinksResponse.
 */
export class ExportLinkItem {
  name: string;
  url: string;
  rss_url?: string;
  logo?: string;
  description?: string;
  siteshot?: string;
  email?: string;
  category_name?: string;
  tag_name?: string;
  tag_color?: string;
  status?: string;
}

/**
 * ExportLinksResponseDto — matches Go ExportLinksResponse JSON fields exactly.
 */
export class ExportLinksResponseDto {
  links: ExportLinkItem[];
  total: number;
}
