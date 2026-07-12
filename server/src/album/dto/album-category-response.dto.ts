/**
 * AlbumCategoryResponseDto — TypeScript interface matching Go AlbumCategoryDTO exactly.
 * Reference: pkg/domain/model/album_category.go AlbumCategoryDTO.
 * Per D-188: only id, name, description, displayOrder fields (no cover_url/sort/password).
 * Album categories use integer IDs (not Sqids) per D-183.
 */
export interface AlbumCategoryResponseDto {
  id: number;
  name: string;
  description: string;
  displayOrder: number;
}
