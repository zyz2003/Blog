interface ArticleSeoTag {
  name?: string | null;
}

export function buildArticleSeoKeywords(
  keywords?: string | null,
  tags?: ArticleSeoTag[] | null
): string[] | undefined {
  const values = [
    ...(keywords || "").split(/[,，]/),
    ...(tags || []).map(tag => tag.name || ""),
  ]
    .map(value => value.trim())
    .filter(Boolean);

  const unique = Array.from(new Set(values));
  return unique.length > 0 ? unique : undefined;
}
