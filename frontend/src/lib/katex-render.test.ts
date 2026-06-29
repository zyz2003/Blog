import { describe, expect, it } from "vitest";
import { containsRawMathDelimiters, getKatexRenderTargets } from "@/lib/katex-render";

describe("katex render target detection", () => {
  it("detects raw math even when structured math nodes are present", () => {
    const container = document.createElement("div");
    container.innerHTML = `
      <span data-type="math-inline" data-latex="E=mc^2"></span>
      <p>历史正文里的原始公式 $a+b$ 也需要渲染。</p>
    `;

    const targets = getKatexRenderTargets(container);

    expect(targets.tiptapInlineElements).toHaveLength(1);
    expect(targets.hasRawMath).toBe(true);
    expect(targets.hasAnyTarget).toBe(true);
  });

  it("detects legacy md-editor math wrappers", () => {
    const container = document.createElement("div");
    container.innerHTML = `
      <span class="md-editor-katex-inline">x+y</span>
      <div class="md-editor-katex-block">a^2+b^2=c^2</div>
    `;

    const targets = getKatexRenderTargets(container);

    expect(targets.legacyInlineElements).toHaveLength(1);
    expect(targets.legacyBlockElements).toHaveLength(1);
    expect(targets.hasAnyTarget).toBe(true);
  });

  it("does not flag ordinary dollar text as math", () => {
    expect(containsRawMathDelimiters("价格是 $5，没有闭合公式。")).toBe(false);
    expect(containsRawMathDelimiters("普通正文没有公式。")).toBe(false);
  });
});
