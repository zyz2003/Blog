/**
 * Import comments result DTO.
 * Matches Go ImportResult: { total_count, success_count, skipped_count, failed_count, error_messages }.
 * Frontend ImportCommentsResult uses: { imported, skipped, errors }.
 * We return both shapes for compatibility.
 */
export class ImportCommentsResultDto {
  total_count: number;
  success_count: number;
  skipped_count: number;
  failed_count: number;
  error_messages: string[];

  // Frontend-compatible aliases
  imported: number;
  skipped: number;
  errors: string[];
}
