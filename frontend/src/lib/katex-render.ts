export interface KatexRenderTargets {
  legacyInlineElements: Element[];
  legacyBlockElements: Element[];
  tiptapInlineElements: Element[];
  tiptapBlockElements: Element[];
  hasRawMath: boolean;
  hasAnyTarget: boolean;
}

const RAW_MATH_PATTERNS = [
  /\$\$[\s\S]+?\$\$/,
  /\\\[[\s\S]+?\\\]/,
  /\\\([\s\S]+?\\\)/,
  /\$[^\s$](?:[^$\n]*[^\s$])?\$(?!\$)/,
];

export function containsRawMathDelimiters(text: string): boolean {
  return RAW_MATH_PATTERNS.some(pattern => pattern.test(text));
}

export function getKatexRenderTargets(root: Element | DocumentFragment): KatexRenderTargets {
  const legacyInlineElements = Array.from(root.querySelectorAll(".md-editor-katex-inline:not([data-processed])"));
  const legacyBlockElements = Array.from(root.querySelectorAll(".md-editor-katex-block:not([data-processed])"));
  const tiptapBlockElements = Array.from(
    root.querySelectorAll("[data-type='math-block'][data-latex]:not([data-processed])")
  );
  const tiptapInlineElements = Array.from(
    root.querySelectorAll("[data-type='math-inline'][data-latex]:not([data-processed])")
  );
  const hasRawMath = containsRawMathDelimiters(root.textContent || "");
  const hasAnyTarget =
    legacyInlineElements.length > 0 ||
    legacyBlockElements.length > 0 ||
    tiptapBlockElements.length > 0 ||
    tiptapInlineElements.length > 0 ||
    hasRawMath;

  return {
    legacyInlineElements,
    legacyBlockElements,
    tiptapInlineElements,
    tiptapBlockElements,
    hasRawMath,
    hasAnyTarget,
  };
}

export async function renderKatexInElement(root: HTMLElement): Promise<void> {
  const targets = getKatexRenderTargets(root);
  if (!targets.hasAnyTarget) return;

  await import("katex/dist/katex.min.css");
  const katex = await import("katex").then(m => m.default);

  const renderElement = (element: Element, displayMode: boolean, latex: string, warnLabel: string) => {
    if (!latex) return;
    try {
      katex.render(latex, element as HTMLElement, {
        throwOnError: false,
        displayMode,
      });
      element.setAttribute("data-processed", "true");
    } catch (err) {
      console.warn(`${warnLabel}失败:`, err);
    }
  };

  targets.legacyInlineElements.forEach(element => {
    renderElement(element, false, element.textContent || "", "KaTeX 行内公式渲染");
  });

  targets.legacyBlockElements.forEach(element => {
    renderElement(element, true, element.textContent || "", "KaTeX 块级公式渲染");
  });

  targets.tiptapBlockElements.forEach(element => {
    renderElement(element, true, element.getAttribute("data-latex") || "", "KaTeX TipTap 块级公式渲染");
  });

  targets.tiptapInlineElements.forEach(element => {
    renderElement(element, false, element.getAttribute("data-latex") || "", "KaTeX TipTap 行内公式渲染");
  });

  if (targets.hasRawMath) {
    try {
      const renderMathInElement = await import("katex/contrib/auto-render").then(m => m.default);
      renderMathInElement(root, {
        delimiters: [
          { left: "$$", right: "$$", display: true },
          { left: "$", right: "$", display: false },
          { left: "\\[", right: "\\]", display: true },
          { left: "\\(", right: "\\)", display: false },
        ],
        throwOnError: false,
      });
    } catch (err) {
      console.warn("KaTeX auto-render 失败:", err);
    }
  }
}
