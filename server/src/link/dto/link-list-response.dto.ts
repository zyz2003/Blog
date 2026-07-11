import { LinkResponseDto } from './link-response.dto';

/**
 * LinkListResponseDto — matches Go LinkListResponse JSON fields exactly.
 */
export class LinkListResponseDto {
  list: LinkResponseDto[];
  total: number;
  page: number;
  pageSize: number;
}
