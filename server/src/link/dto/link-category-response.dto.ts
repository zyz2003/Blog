/**
 * LinkCategoryResponseDto — matches Go LinkCategoryDTO JSON fields exactly.
 * Per D-178: public links are grouped by category, so this DTO includes a links array.
 */
export class LinkCategoryResponseDto {
  id: number;
  name: string;
  style: string;
  description: string;
  links?: any[];
}
