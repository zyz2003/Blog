import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { vi } from "vitest";
import { articleApi } from "@/lib/api/article";
import PostCategoryTagManager from "./PostCategoryTagManager";

const modalProps: Record<string, unknown>[] = [];
const queryData = vi.hoisted(() => ({
  categories: [] as Record<string, unknown>[],
  tags: [] as Record<string, unknown>[],
}));
const articleApiMocks = vi.hoisted(() => ({
  createCategory: vi.fn(),
  updateCategory: vi.fn(),
  deleteCategory: vi.fn(),
  createTag: vi.fn(),
  updateTag: vi.fn(),
  deleteTag: vi.fn(),
}));

const makeCategory = (overrides: Record<string, unknown> = {}) => ({
  id: "cat-1",
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
  name: "效率工具",
  slug: "xlgj",
  description: "",
  count: 1,
  is_series: false,
  sort_order: 0,
  ...overrides,
});

const makeTag = (overrides: Record<string, unknown> = {}) => ({
  id: "tag-1",
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
  name: "常用工具",
  slug: "tools",
  count: 1,
  ...overrides,
});

vi.mock("@tanstack/react-query", () => ({
  useQueryClient: () => ({
    invalidateQueries: vi.fn(),
  }),
}));

vi.mock("@/hooks/queries/use-articles", () => ({
  useCategories: () => ({
    data: queryData.categories,
  }),
  useTags: () => ({
    data: queryData.tags,
  }),
}));

vi.mock("@/lib/api/article", () => ({
  articleApi: articleApiMocks,
}));

vi.mock("@/components/ui/form-input", () => ({
  FormInput: ({
    label,
    value,
    onValueChange,
    placeholder,
    description,
  }: {
    label?: string;
    value?: string;
    onValueChange?: (value: string) => void;
    placeholder?: string;
    description?: React.ReactNode;
  }) => (
    <label>
      <span>{label}</span>
      <input
        aria-label={label}
        value={value ?? ""}
        placeholder={placeholder}
        onChange={event => onValueChange?.(event.currentTarget.value)}
      />
      {description && <span>{description}</span>}
    </label>
  ),
}));

vi.mock("@heroui/react", () => ({
  addToast: vi.fn(),
  Modal: ({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>) => {
    modalProps.push(props);
    return <div data-testid="modal">{children}</div>;
  },
  ModalContent: ({
    children,
    className,
  }: {
    children: React.ReactNode | ((onClose: () => void) => React.ReactNode);
    className?: string;
  }) => <section className={className}>{typeof children === "function" ? children(vi.fn()) : children}</section>,
  ModalHeader: ({ children, className }: React.PropsWithChildren<{ className?: string }>) => (
    <header className={className}>{children}</header>
  ),
  ModalBody: ({ children, className }: React.PropsWithChildren<{ className?: string }>) => (
    <main className={className}>{children}</main>
  ),
  Tabs: ({ children }: React.PropsWithChildren<Record<string, unknown>>) => <div>{children}</div>,
  Tab: ({ children, title }: React.PropsWithChildren<{ title: React.ReactNode }>) => (
    <section>
      <h2>{title}</h2>
      {children}
    </section>
  ),
  Button: ({
    children,
    onPress,
    isIconOnly,
    isDisabled,
    startContent,
    ...props
  }: React.PropsWithChildren<
    { onPress?: () => void; isIconOnly?: boolean; isDisabled?: boolean; startContent?: React.ReactNode } & Record<
      string,
      unknown
    >
  >) => (
    <button
      type="button"
      aria-label={isIconOnly ? "icon button" : undefined}
      disabled={isDisabled}
      onClick={onPress}
      {...props}
    >
      {startContent}
      {children}
    </button>
  ),
}));

describe("PostCategoryTagManager", () => {
  beforeEach(() => {
    modalProps.length = 0;
    queryData.categories = [];
    queryData.tags = Array.from({ length: 48 }, (_, index) =>
      makeTag({
        id: `tag-${index}`,
        name: `标签 ${index + 1}`,
        slug: `tag-${index + 1}`,
        count: index,
      })
    );
    Object.values(articleApiMocks).forEach(mock => mock.mockReset());
  });

  it("uses inside modal scrolling when the tag list is long", () => {
    render(<PostCategoryTagManager isOpen onClose={vi.fn()} />);

    expect(screen.getByText("标签 (48)")).toBeInTheDocument();
    expect(modalProps[0]).toMatchObject({
      isOpen: true,
      size: "2xl",
      scrollBehavior: "inside",
    });
  });

  it("sends an empty category slug when clearing it", async () => {
    queryData.categories = [makeCategory()];
    queryData.tags = [];

    render(<PostCategoryTagManager isOpen onClose={vi.fn()} />);

    fireEvent.click(screen.getAllByRole("button", { name: "icon button" })[0]);
    fireEvent.change(screen.getByLabelText("Slug"), { target: { value: "" } });
    fireEvent.click(screen.getByRole("button", { name: "保存" }));

    await waitFor(() => expect(articleApi.updateCategory).toHaveBeenCalledTimes(1));
    expect(articleApi.updateCategory).toHaveBeenCalledWith("cat-1", {
      name: "效率工具",
      slug: "",
    });
  });

  it("sends an empty tag slug when clearing it", async () => {
    queryData.categories = [];
    queryData.tags = [makeTag()];

    render(<PostCategoryTagManager isOpen onClose={vi.fn()} />);

    fireEvent.click(screen.getAllByRole("button", { name: "icon button" })[0]);
    fireEvent.change(screen.getByLabelText("Slug"), { target: { value: "" } });
    fireEvent.click(screen.getByRole("button", { name: "保存" }));

    await waitFor(() => expect(articleApi.updateTag).toHaveBeenCalledTimes(1));
    expect(articleApi.updateTag).toHaveBeenCalledWith("tag-1", {
      name: "常用工具",
      slug: "",
    });
  });
});
