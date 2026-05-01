// =====================================================================
// CommandPalette.jsx
// لوحة الأوامر السريعة (مستوحاة من Linear / Raycast / Spotlight)
// تُفتح بـ Cmd+K (أو Ctrl+K) وتسمح بـ:
//   - البحث الفوري في الملفات المولّدة
//   - تنفيذ الأوامر السريعة (إنشاء جديد، تحديث، تسجيل خروج…)
// =====================================================================

import { useEffect } from "react";
import { Command as CmdkRoot } from "cmdk";   // مكتبة بناء لوحة الأوامر
// أيقونات SVG محلية
import {
  Search,
  File as FileIcon,
  Plus,
  LogOut,
  PanelRight,
  RefreshCw,
  Trash,
  Keyboard,
} from "./icons";

/**
 * Linear/Raycast-style command palette.
 * Opens on Cmd/Ctrl+K. Fuzzy-searches drafts and app actions.
 */
export function CommandPalette({
  open, onOpenChange,        // حالة الفتح/الإغلاق
  files, metaMap,            // قائمة الملفات + بياناتها الإضافية
  onPickDraft, onDeleteDraft,// دوال عند اختيار/حذف ملف
  actions,                   // قائمة الأوامر السريعة [{ id, label, hint, icon, run }]
}) {
  // مستمع لاختصار Cmd/Ctrl+K — يبدّل حالة فتح/إغلاق اللوحة
  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();          // منع السلوك الافتراضي للمتصفح
        onOpenChange(!open);
      }
    };
    window.addEventListener("keydown", onKey);
    // تنظيف المستمع عند إزالة المكوّن
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onOpenChange]);

  // إذا كانت اللوحة مغلقة، لا نُصيّر شيئًا
  if (!open) return null;

  return (
    // طبقة الخلفية المعتمة — النقر عليها يُغلق اللوحة
    <div
      className="fixed inset-0 z-[60] flex items-start justify-center pt-[14vh] px-4"
      onClick={() => onOpenChange(false)}
    >
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      {/* صندوق اللوحة نفسه — stopPropagation يمنع إغلاقه عند النقر عليه */}
      <div
        className="relative w-full max-w-xl bg-bg-elev border border-line-strong rounded-xl shadow-canvas overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <CmdkRoot label="Command menu" className="flex flex-col">
          {/* صف البحث في الأعلى */}
          <div className="flex items-center gap-2 px-3 border-b border-line">
            <Search className="h-4 w-4 text-ink-subtle shrink-0" />
            <CmdkRoot.Input
              autoFocus
              placeholder="Type a command or draft name…"
              className="flex-1 h-11 bg-transparent text-[14px] text-ink placeholder:text-ink-faint focus:outline-none"
            />
            <kbd className="chip !text-[10px]">ESC</kbd>
          </div>

          {/* قائمة النتائج (الأوامر + الملفات) */}
          <CmdkRoot.List className="max-h-[380px] overflow-y-auto p-1.5">
            {/* رسالة "لا توجد نتائج" تظهر عندما لا يطابق البحث شيئًا */}
            <CmdkRoot.Empty className="py-10 text-center text-[13px] text-ink-subtle">
              No results.
            </CmdkRoot.Empty>

            {/* قسم الأوامر السريعة */}
            <CmdkRoot.Group heading="Actions" className="px-1 pt-1 pb-0.5 text-[11px] uppercase tracking-widelabel text-ink-subtle font-mono">
              {actions.map((a) => (
                <CmdkRoot.Item
                  key={a.id}
                  value={`action:${a.id} ${a.label} ${a.hint || ""}`}
                  onSelect={() => { a.run(); onOpenChange(false); }}
                  className="flex items-center gap-2.5 px-2.5 py-2 rounded-md text-[13px] text-ink-muted aria-selected:bg-bg-raised aria-selected:text-ink cursor-pointer"
                >
                  {a.icon || <Plus className="h-3.5 w-3.5 text-ink-subtle" />}
                  <span className="flex-1">{a.label}</span>
                  {a.hint && <span className="meta">{a.hint}</span>}
                </CmdkRoot.Item>
              ))}
            </CmdkRoot.Group>

            {/* قسم الملفات (Drafts) — يظهر فقط إذا كان عندنا ملفات */}
            {files && files.length > 0 && (
              <CmdkRoot.Group heading="Drafts" className="px-1 pt-2 pb-0.5 text-[11px] uppercase tracking-widelabel text-ink-subtle font-mono">
                {files.map((f) => {
                  // قراءة البيانات الإضافية للملف (الاسم الودود، الـ brief)
                  const m = (metaMap && metaMap[f.file_name]) || {};
                  const label = m.label || f.file_name;
                  return (
                    <CmdkRoot.Item
                      key={f.file_name}
                      value={`draft ${label} ${f.file_name} ${m.brief || ""}`}
                      onSelect={() => { onPickDraft(f.file_name); onOpenChange(false); }}
                      className="flex items-center gap-2.5 px-2.5 py-2 rounded-md text-[13px] text-ink-muted aria-selected:bg-bg-raised aria-selected:text-ink cursor-pointer"
                    >
                      <FileIcon className="h-3.5 w-3.5 text-ink-subtle" />
                      <span className="flex-1 truncate">{label}</span>
                      <span className="meta text-ink-faint truncate max-w-[180px]">
                        {m.brief ? m.brief.slice(0, 42) : f.file_name}
                      </span>
                    </CmdkRoot.Item>
                  );
                })}
              </CmdkRoot.Group>
            )}
          </CmdkRoot.List>

          {/* تذييل اللوحة — إرشادات الاختصارات */}
          <div className="border-t border-line px-3 py-1.5 flex items-center justify-between text-[11px] text-ink-subtle">
            <div className="flex items-center gap-3">
              <span><kbd className="meta">↑↓</kbd> navigate</span>
              <span><kbd className="meta">↵</kbd> open</span>
              <span><kbd className="meta">ESC</kbd> close</span>
            </div>
            <span className="meta">MAWG Palette</span>
          </div>
        </CmdkRoot>
      </div>
    </div>
  );
}
