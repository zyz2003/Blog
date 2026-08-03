import { describe, expect, it, vi } from "vitest";

vi.mock("@/components/home", () => ({
  HomePageContent: () => null,
}));

import { generateMetadata } from "./page";

describe("homepage metadata", () => {
  it("uses site name and subtitle as an absolute title", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => ({
          data: {
            APP_NAME: "安和鱼",
            SUB_TITLE: "生活明朗，万物可爱",
          },
        }),
      }))
    );

    const metadata = await generateMetadata();

    expect(metadata.title).toEqual({ absolute: "安和鱼 - 生活明朗，万物可爱" });
    expect(metadata.openGraph?.title).toBe("安和鱼 - 生活明朗，万物可爱");
    expect(metadata.twitter?.title).toBe("安和鱼 - 生活明朗，万物可爱");
  });
});
