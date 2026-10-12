import katex from 'katex';
import 'katex/dist/katex.min.css';
import { useMemo } from 'react';

/** Render LaTeX safely (KaTeX with trust disabled); always LTR, even inside RTL pages. */
export function MathTex({ tex, block = false }: { tex: string; block?: boolean }) {
  const html = useMemo(() => {
    try {
      return katex.renderToString(tex, { throwOnError: false, displayMode: block, trust: false, strict: 'ignore', output: 'htmlAndMathml' });
    } catch {
      return null;
    }
  }, [tex, block]);
  if (html === null) return <code className="ltr">{tex}</code>;
  return <span className={block ? 'math-block' : 'ltr'} dir="ltr" dangerouslySetInnerHTML={{ __html: html }} />;
}
