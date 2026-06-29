import { describe, expect, it } from "vitest";
import { getKeysByCategory } from "./setting-descriptors";
import { KEY_DISABLE_RIGHT_MENU } from "./setting-keys";

describe("setting-descriptors appearance-page", () => {
  it("包含全站关闭右键菜单开关", () => {
    expect(getKeysByCategory("appearance-page")).toContainEqual({
      backendKey: KEY_DISABLE_RIGHT_MENU,
      type: "boolean",
      defaultValue: "false",
    });
  });
});
