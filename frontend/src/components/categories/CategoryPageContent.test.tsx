import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CategoryPageContent } from "./CategoryPageContent";

const routerPush = vi.hoisted(() => vi.fn());
const categoryQuery = vi.hoisted(() => ({
  data: [] as Record<string, unknown>[],
  isLoading: false,
  isError: false,
}));
const storeState = vi.hoisted(() => ({
  siteConfig: {} as Record<string, unknown>,
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: routerPush }),
}));

vi.mock("@/hooks/queries", () => ({
  useCategories: () => categoryQuery,
}));

vi.mock("@/store/site-config-store", () => ({
  useSiteConfigStore: (selector: (state: typeof storeState) => unknown) => selector(storeState),
}));

describe("CategoryPageContent", () => {
  beforeEach(() => {
    routerPush.mockReset();
    categoryQuery.data = [
      {
        id: "cat-1",
        name: "效率工具",
        slug: "xlgj",
        count: 37,
      },
    ];
    categoryQuery.isLoading = false;
    categoryQuery.isError = false;
    storeState.siteConfig = {
      HOME_TOP: {
        category: [{ name: "效率工具", path: "/categories/xlgj/", isExternal: false }],
      },
      page: {
        one_image: {
          config: {
            categories: {
              enable: false,
            },
          },
        },
      },
    };
  });

  it("uses the category name route instead of HOME_TOP configured path", () => {
    render(<CategoryPageContent />);

    fireEvent.click(screen.getByRole("button", { name: "效率工具" }));

    expect(routerPush).toHaveBeenCalledWith(`/categories/${encodeURIComponent("效率工具")}/`);
  });
});
