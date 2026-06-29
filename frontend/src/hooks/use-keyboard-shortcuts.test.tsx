import { act, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useKeyboardShortcuts } from "./use-keyboard-shortcuts";

const routerPush = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: routerPush }),
}));

vi.mock("next-themes", () => ({
  useTheme: () => ({ theme: "light", setTheme: vi.fn() }),
}));

vi.mock("@heroui/react", () => ({
  addToast: vi.fn(),
}));

function KeyboardShortcutsHost() {
  useKeyboardShortcuts();
  return null;
}

describe("useKeyboardShortcuts", () => {
  afterEach(() => {
    routerPush.mockClear();
  });

  it("按 Shift+L 跳转到友链页实际路由", () => {
    render(<KeyboardShortcutsHost />);

    act(() => {
      document.body.dispatchEvent(new KeyboardEvent("keydown", { key: "Shift", bubbles: true }));
      document.body.dispatchEvent(new KeyboardEvent("keydown", { key: "l", bubbles: true }));
    });

    expect(routerPush).toHaveBeenCalledWith("/link");
  });
});
