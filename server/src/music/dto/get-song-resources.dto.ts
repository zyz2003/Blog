import { IsString, IsNotEmpty } from 'class-validator';

/**
 * GetSongResourcesDto — matches Go GetSongResourcesRequest.
 * Reference: pkg/handler/music/handler.go GetSongResources.
 *
 * neteaseId is the Netease Cloud Music song ID (6-12 digit numeric string).
 * Validated further in MusicService with regex ^\d{6,12}$ per D-209.
 */
export class GetSongResourcesDto {
  @IsString()
  @IsNotEmpty()
  neteaseId: string;
}
