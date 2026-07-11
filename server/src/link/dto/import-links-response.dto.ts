import { LinkResponseDto } from './link-response.dto';
import { ImportLinkItemDto } from './import-links-request.dto';

/**
 * ImportLinkFailure — matches Go ImportLinkFailure JSON fields exactly.
 */
export class ImportLinkFailure {
  link: ImportLinkItemDto;
  reason: string;
}

/**
 * ImportLinkSkipped — matches Go ImportLinkSkipped JSON fields exactly.
 */
export class ImportLinkSkipped {
  link: ImportLinkItemDto;
  reason: string;
}

/**
 * ImportLinksResponseDto — matches Go ImportLinksResponse JSON fields exactly.
 */
export class ImportLinksResponseDto {
  total: number;
  success: number;
  failed: number;
  skipped: number;
  success_list: LinkResponseDto[];
  failed_list: ImportLinkFailure[];
  skipped_list: ImportLinkSkipped[];
}
