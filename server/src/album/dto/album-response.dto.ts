/**
 * AlbumResponseDto — TypeScript interface matching Go AlbumResponse structure exactly.
 * Reference: pkg/handler/album/handler.go inline struct.
 * Albums use integer IDs (not Sqids) per D-183.
 * All JSON keys use snake_case matching Go JSON tags.
 */
export interface AlbumResponseDto {
  id: number;
  categoryId: number | null;
  imageUrl: string;
  bigImageUrl: string;
  downloadUrl: string;
  thumbParam: string;
  bigParam: string;
  tags: string;
  viewCount: number;
  downloadCount: number;
  fileSize: number;
  format: string;
  aspectRatio: string;
  created_at: string;
  updated_at: string;
  published_at: string | null;
  width: number;
  height: number;
  widthAndHeight: string;
  displayOrder: number;
  title: string;
  description: string;
  location: string;
}

/**
 * Album list response matching Go GetAlbums response structure.
 */
export interface AlbumListResponseDto {
  list: AlbumResponseDto[];
  total: number;
  pageNum: number;
  pageSize: number;
}
