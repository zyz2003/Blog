import { describe, expect, it } from "vitest";
import { shouldUseSiteRightMenu } from "./right-menu-policy";

describe("shouldUseSiteRightMenu", () => {
  it("桌面普通页面默认使用本站右键菜单", () => {
    expect(
      shouldUseSiteRightMenu({
        localEnabled: true,
        siteDisabled: false,
        pathname: "/posts/demo",
        viewportWidth: 1280,
      })
    ).toBe(true);
  });

  it("全站关闭右键菜单时不再使用本站右键菜单", () => {
    expect(
      shouldUseSiteRightMenu({
        localEnabled: true,
        siteDisabled: true,
        pathname: "/posts/demo",
        viewportWidth: 1280,
      })
    ).toBe(false);
  });

  it("保留本地关闭、文档页和移动端的原有禁用条件", () => {
    expect(
      shouldUseSiteRightMenu({
        localEnabled: false,
        siteDisabled: false,
        pathname: "/posts/demo",
        viewportWidth: 1280,
      })
    ).toBe(false);
    expect(
      shouldUseSiteRightMenu({
        localEnabled: true,
        siteDisabled: false,
        pathname: "/doc/guide",
        viewportWidth: 1280,
      })
    ).toBe(false);
    expect(
      shouldUseSiteRightMenu({
        localEnabled: true,
        siteDisabled: false,
        pathname: "/posts/demo",
        viewportWidth: 767,
      })
    ).toBe(false);
  });
});
