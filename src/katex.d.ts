declare module "katex/contrib/auto-render" {
  import type { KatexOptions } from "katex";

  type Delimiter = {
    left: string;
    right: string;
    display?: boolean;
  };

  type AutoRenderOptions = KatexOptions & {
    delimiters?: Delimiter[];
    ignoredTags?: string[];
    ignoredClasses?: string[];
  };

  export default function renderMathInElement(el: HTMLElement, options?: AutoRenderOptions): void;
}
