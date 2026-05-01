// =====================================================================
// SourceView.jsx
// عارض الكود المصدري مع تلوين الـ syntax + أرقام الأسطر
// لماذا؟ لعرض ملف HTML المولّد بشكل واضح ومنسّق داخل الواجهة
// مميزاته:
//   - يقسّم HTML إلى أجزاء: html / style / script
//   - كل جزء يُلوَّن باللغة الخاصة به (HTML للـtags، CSS داخل style، JS داخل script)
// =====================================================================

import { useMemo } from "react";
// مكتبة highlight.js لتلوين الكود — نستورد فقط اللغات التي نحتاجها
import hljs from "highlight.js/lib/core";
import xml from "highlight.js/lib/languages/xml";        // XML/HTML
import css from "highlight.js/lib/languages/css";
import javascript from "highlight.js/lib/languages/javascript";
import "highlight.js/styles/atom-one-dark.css";          // ثيم التلوين الداكن

// تسجيل اللغات في hljs (HTML يعتبر xml من ناحية التلوين)
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
  // تقسيم المصدر إلى أجزاء — useMemo يحفظ النتيجة ولا يعيد الحساب إلا لو تغيّر source
  const segments = useMemo(() => splitMixedSource(source || ""), [source]);

  // عدّاد الأسطر — يبدأ من 1 ويزيد عبر كل الأجزاء
  let lineNo = 1;

  return (
    <div className="font-mono text-[11.5px] leading-[1.55] text-ink">
      {segments.map((seg, i) => {
        // تلوين الجزء بلغته
        const html = hljs.highlight(seg.text, { language: seg.lang, ignoreIllegals: true }).value;
        const lines = html.split("\n");
        // بناء كل سطر مع رقمه
        const rows = lines.map((ln, j) => {
          const n = lineNo++;
          return (
            <div key={`${i}-${j}`} className="flex hover:bg-bg-hover/30">
              {/* عمود رقم السطر (اختياري) */}
              {showLineNumbers && (
                <span
                  className="select-none text-right pr-3 pl-2 text-ink-faint tabular-nums shrink-0 border-r border-line/60"
                  style={{ width: "3.5em" }}
                >
                  {n}
                </span>
              )}
              {/* محتوى السطر — &nbsp; للأسطر الفارغة */}
              <span
                className="pl-3 pr-3 whitespace-pre flex-1"
                dangerouslySetInnerHTML={{ __html: ln || "&nbsp;" }}
              />
            </div>
          );
        });
        // إزالة السطر الفارغ الأخير الذي يضيفه hljs أحيانًا
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
 *
 * تشرح هذه الدالة كيف نقسّم الكود:
 * - أي جزء داخل <style>...</style> نعتبره CSS
 * - أي جزء داخل <script>...</script> نعتبره JavaScript
 * - الباقي HTML
 */
function splitMixedSource(src) {
  // regex يبحث عن وسوم style أو script ومحتواها
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

    // ما قبل الوسم → HTML
    if (start > last) segments.push({ text: src.slice(last, start), lang: "html" });
    // الوسم الافتتاحي → HTML
    segments.push({ text: openTag, lang: "html" });
    // المحتوى الداخلي → CSS أو JS حسب نوع الوسم
    segments.push({ text: inner, lang: tag === "style" ? "css" : "javascript" });
    // الوسم الإغلاقي → HTML
    segments.push({ text: `</${tag}>`, lang: "html" });
    last = closeStart + `</${tag}>`.length;
  }
  // ما تبقى بعد آخر وسم → HTML
  if (last < src.length) segments.push({ text: src.slice(last), lang: "html" });
  // إذا لم نجد أي وسم، نعتبر كل المصدر HTML واحدًا
  return segments.length ? segments : [{ text: src, lang: "html" }];
}
