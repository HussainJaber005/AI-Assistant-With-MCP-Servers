import { useMemo } from "react";
import hljs from "highlight.js/lib/core";
import xml from "highlight.js/lib/languages/xml";
import css from "highlight.js/lib/languages/css";
import javascript from "highlight.js/lib/languages/javascript";
import "highlight.js/styles/atom-one-dark.css";

hljs.registerLanguage("xml", xml);
hljs.registerLanguage("html", xml);
hljs.registerLanguage("css", css);
hljs.registerLanguage("js", javascript);
hljs.registerLanguage("javascript", javascript);

/**
 * Renders a source string with syntax highlighting + optional line numbers.
 * Splits the HTML input into segments (html / style block / script block)
 * so each is highlighted in its own language — cleaner than hljs auto-detect
 * on a mixed HTML doc.
 */
export function SourceView({ source, showLineNumbers = true }) {
  const segments = useMemo(() => splitMixedSource(source || ""), [source]);

  let lineNo = 1;

  return (
    <div className="font-mono text-[11.5px] leading-[1.55] text-ink">
      {segments.map((seg, i) => {
        const html = hljs.highlight(seg.text, { language: seg.lang, ignoreIllegals: true }).value;
        const lines = html.split("\n");
        const rows = lines.map((ln, j) => {
          const n = lineNo++;
          return (
            <div key={`${i}-${j}`} className="flex hover:bg-bg-hover/30">
              {showLineNumbers && (
                <span
                  className="select-none text-right pr-3 pl-2 text-ink-faint tabular-nums shrink-0 border-r border-line/60"
                  style={{ width: "3.5em" }}
                >
                  {n}
                </span>
              )}
              <span
                className="pl-3 pr-3 whitespace-pre flex-1"
                dangerouslySetInnerHTML={{ __html: ln || "&nbsp;" }}
              />
            </div>
          );
        });
        // Pop the trailing empty line hljs adds after split if content ends on \n
        if (lines.length && lines[lines.length - 1] === "") {
          rows.pop();
          lineNo--;
        }
        return <div key={i}>{rows}</div>;
      })}
    </div>
  );
}

/**
 * Split mixed HTML source into segments of { text, lang }.
 * - <style>...</style> → css
 * - <script>...</script> → javascript
 * - everything else → html
 */
function splitMixedSource(src) {
  const re = /<(style|script)(\s[^>]*)?>([\s\S]*?)<\/\1>/gi;
  const segments = [];
  let last = 0;
  let m;
  while ((m = re.exec(src)) !== null) {
    const [fullMatch, tag, attrs = "", inner] = m;
    const start = m.index;
    const openTag = `<${tag}${attrs || ""}>`;
    const openEnd = start + openTag.length;
    const closeStart = openEnd + inner.length;

    if (start > last) segments.push({ text: src.slice(last, start), lang: "html" });
    segments.push({ text: openTag, lang: "html" });
    segments.push({ text: inner, lang: tag === "style" ? "css" : "javascript" });
    segments.push({ text: `</${tag}>`, lang: "html" });
    last = closeStart + `</${tag}>`.length;
  }
  if (last < src.length) segments.push({ text: src.slice(last), lang: "html" });
  return segments.length ? segments : [{ text: src, lang: "html" }];
}
