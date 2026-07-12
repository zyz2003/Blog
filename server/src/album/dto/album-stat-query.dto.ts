import { IsIn, IsString } from 'class-validator';

/**
 * AlbumStatQueryDto — matches Go UpdateAlbumStat query parameter exactly.
 * Reference: pkg/handler/album/handler.go UpdateAlbumStat.
 * type must be "view" or "download" to increment the corresponding counter.
 */
export class AlbumStatQueryDto {
  @IsString()
  @IsIn(['view', 'download'])
  type: string;
}
