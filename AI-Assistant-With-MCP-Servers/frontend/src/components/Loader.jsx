// =====================================================================
// Loader.jsx
// مكوّن "التحميل" — يعرض دائرة دوّارة مع نص اختياري
// له وضعان:
//   - عادي: يظهر داخل عنصر معين
//   - fullscreen: يغطي الشاشة كاملة (للتحميل الأولي مثلاً)
// =====================================================================

export function Loader({ fullscreen = false, label = "" }) {
  // عنصر الدائرة الدوّارة + النص
  const Spinner = (
    <div className="flex items-center gap-3 text-ink-muted text-sm">
      {/* الدائرة الدوارة — تستخدم animate-spin من Tailwind */}
      <span className="h-4 w-4 rounded-full border-2 border-line-strong border-t-accent animate-spin" />
      {/* النص الذي يظهر بجانب الدائرة (اختياري) */}
      <span className="meta">{label}</span>
    </div>
  );

  // الوضع العادي — نُرجع الدائرة فقط
  if (!fullscreen) return Spinner;

  // وضع ملء الشاشة — نلفّها بطبقة تغطي الشاشة كاملة
  return (
    <div className="fixed inset-0 flex items-center justify-center bg-bg">
      {Spinner}
    </div>
  );
}
