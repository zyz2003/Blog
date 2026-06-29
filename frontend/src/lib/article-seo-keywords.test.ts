import { describe, expect, it } from "vitest";
import { buildArticleSeoKeywords } from "./article-seo-keywords";

describe("buildArticleSeoKeywords", () => {
  it("merges manual keywords and tag names without duplicates", () => {
    const keywords = buildArticleSeoKeywords("Next.js, SEO，博客", [
      { name: "SEO" },
      { name: "TypeScript" },
      { name: " " },
    ]);

    expect(keywords).toEqual(["Next.js", "SEO", "博客", "TypeScript"]);
  });

  it("returns undefined when no manual keywords or tag names exist", () => {
    expect(buildArticleSeoKeywords("", [])).toBeUndefined();
  });
});
