import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import FriendFormModal from "@/components/admin/friends/FriendFormModal";
import type { LinkItem } from "@/types/friends";

const updateLinkMock = vi.hoisted(() => vi.fn());
const createLinkMock = vi.hoisted(() => vi.fn());

vi.mock("@heroui/react", () => ({
  addToast: vi.fn(),
  ModalBody: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  ModalFooter: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Button: ({
    children,
    onPress,
  }: {
    children: React.ReactNode;
    onPress?: () => void;
    isLoading?: boolean;
  }) => (
    <button type="button" onClick={onPress}>
      {children}
    </button>
  ),
  Switch: () => <button type="button">switch</button>,
  Chip: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
  Input: ({
    label,
    value,
    onValueChange,
    type = "text",
  }: {
    label: string;
    value?: string;
    onValueChange?: (value: string) => void;
    type?: string;
  }) => (
    <label>
      {label}
      <input type={type} aria-label={label} value={value ?? ""} onChange={e => onValueChange?.(e.target.value)} />
    </label>
  ),
  Textarea: ({
    label,
    value,
    onValueChange,
  }: {
    label: string;
    value?: string;
    onValueChange?: (value: string) => void;
  }) => (
    <label>
      {label}
      <textarea aria-label={label} value={value ?? ""} onChange={e => onValueChange?.(e.target.value)} />
    </label>
  ),
  Select: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SelectItem: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock("@/components/admin/AdminDialog", () => ({
  AdminDialog: ({ isOpen, children }: { isOpen: boolean; children: React.ReactNode }) =>
    isOpen ? <div>{children}</div> : null,
}));

vi.mock("@/components/ui/form-color-picker", () => ({
  FormColorPicker: () => <div data-testid="color-picker" />,
}));

vi.mock("@/hooks/queries/use-friends", () => ({
  useLinkCategories: () => ({ data: [{ id: 2, name: "默认分类", style: "list", description: "" }] }),
  useLinkTags: () => ({ data: [] }),
  useCreateLink: () => ({ mutateAsync: createLinkMock, isPending: false }),
  useUpdateLink: () => ({ mutateAsync: updateLinkMock, isPending: false }),
  useCreateCategory: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useCreateTag: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));

const editItem: LinkItem = {
  id: 7,
  name: "示例站点",
  url: "https://site.example",
  rss_url: "https://site.example/custom-feed.xml",
  logo: "https://site.example/logo.png",
  description: "一个示例站点",
  status: "APPROVED",
  siteshot: "https://site.example/shot.png",
  sort_order: 0,
  skip_health_check: false,
  email: "owner@example.com",
  category: { id: 2, name: "默认分类", style: "list", description: "" },
  tag: null,
};

describe("FriendFormModal custom RSS", () => {
  beforeEach(() => {
    updateLinkMock.mockReset();
    createLinkMock.mockReset();
    updateLinkMock.mockResolvedValue(editItem);
  });

  it("编辑友链时回填并提交 rss_url", async () => {
    render(<FriendFormModal isOpen onClose={vi.fn()} editItem={editItem} />);

    expect(screen.getByLabelText("RSS 地址（可选）")).toHaveValue(editItem.rss_url);
    fireEvent.click(screen.getByRole("button", { name: "保存修改" }));

    await waitFor(() => expect(updateLinkMock).toHaveBeenCalledTimes(1));
    expect(updateLinkMock).toHaveBeenCalledWith({
      id: editItem.id,
      data: expect.objectContaining({
        rss_url: editItem.rss_url,
      }),
    });
  });
});
