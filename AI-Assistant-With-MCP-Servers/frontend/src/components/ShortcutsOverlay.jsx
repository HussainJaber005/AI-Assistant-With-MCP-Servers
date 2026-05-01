// =====================================================================
// ShortcutsOverlay.jsx
// نافذة منبثقة تعرض كل اختصارات لوحة المفاتيح
// تظهر عند الضغط على "?" — وتُغلق بـ Esc أو النقر خارجها
// =====================================================================

import { useEffect } from "react";

// قائمة الاختصارات مجمّعة في فئات
// كل عنصر: [الاختصار، الوصف]
const GROUPS = [
  {
    label: "Navigate",
    items: [
      ["⌘ / Ctrl + K",  "Open command palette"],
      ["?",              "Show this shortcuts panel"],
      ["Esc",            "Close palette / exit fullscreen"],
    ],
  },
  {
    label: "Panels",
    items: [
      ["⌘ / Ctrl + B",   "Toggle Brief panel"],
      ["⌘ / Ctrl + \\",  "Toggle Source panel"],
      ["Drag divider",   "Resize panels"],
    ],
  },
  {
    label: "Brief",
    items: [
      ["⌘ / Ctrl + ⏎",  "Send brief"],
      ["Click a pill",   "Toggle selection"],
    ],
  },
  {
    label: "Drafts",
    items: [
      ["Double-click",   "Rename inline"],
      ["Hover",          "Show edit / delete actions"],
    ],
  },
];

// المكوّن الرئيسي
// open: هل النافذة مفتوحة؟
// onClose: دالة تُستدعى للإغلاق
export function ShortcutsOverlay({ open, onClose }) {
  // عند فتح النافذة، نستمع للضغط على Escape لإغلاقها
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  // إذا كانت مغلقة لا نُصيّر شيئًا
  if (!open) return null;

  return (
    // الخلفية المعتمة — النقر عليها يُغلق النافذة
    <div className="fixed inset-0 z-[55] flex items-center justify-center px-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/55 backdrop-blur-sm" />
      {/* صندوق الاختصارات نفسه */}
      <div
        className="relative w-full max-w-md bg-bg-elev border border-line-strong rounded-xl shadow-canvas"
        onClick={(e) => e.stopPropagation()}
      >
        {/* رأس الصندوق — العنوان + زر الإغلاق */}
        <div className="px-4 py-3 border-b border-line flex items-center justify-between">
          <h3 className="font-display font-semibold text-[15px] text-ink">Keyboard shortcuts</h3>
          <button onClick={onClose} className="btn-ghost text-[11px]">Esc</button>
        </div>

        {/* عرض الاختصارات مجمّعة حسب الفئات */}
        <div className="p-4 space-y-5">
          {GROUPS.map((g) => (
            <div key={g.label}>
              {/* اسم الفئة */}
              <div className="meta text-ink-muted mb-2">{g.label}</div>
              <div className="space-y-1.5">
                {/* قائمة الاختصارات داخل الفئة */}
                {g.items.map(([keys, desc]) => (
                  <div key={keys} className="flex items-center justify-between text-[13px]">
                    <span className="text-ink">{desc}</span>
                    <kbd className="chip font-mono">{keys}</kbd>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
