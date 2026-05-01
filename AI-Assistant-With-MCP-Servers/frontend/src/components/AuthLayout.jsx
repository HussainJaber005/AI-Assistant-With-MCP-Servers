// =====================================================================
// AuthLayout.jsx
// قالب موحّد لصفحات تسجيل الدخول والتسجيل
// التصميم: شاشة مقسومة إلى نصفين على الشاشات الكبيرة:
//   - يسار: شعار العلامة التجارية (يختفي على الجوال)
//   - يمين: النموذج الفعلي (تسجيل دخول/تسجيل)
// المكوّن يأخذ:
//   - title: العنوان الرئيسي
//   - subtitle: نص فرعي صغير فوق العنوان
//   - children: محتوى النموذج نفسه
//   - footer: نص يظهر أسفل النموذج (مثل: "ليس لديك حساب؟ سجّل الآن")
// =====================================================================

export function AuthLayout({ title, subtitle, children, footer }) {
  return (
    <div className="min-h-screen grid md:grid-cols-2 bg-bg">
      {/* ===== الجانب الأيسر — قسم العلامة التجارية ===== */}
      {/* يختفي على شاشات الجوال (hidden md:flex) */}
      <div className="hidden md:flex relative overflow-hidden border-r border-line">
        {/* تأثير ضوئي خفيف في الخلفية */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            backgroundImage:
              "radial-gradient(700px 500px at 10% 110%, rgba(226,118,68,0.08), transparent 60%)",
          }}
        />
        <div className="relative z-10 flex flex-col justify-between p-10 lg:p-14 w-full">
          {/* الشعار في الأعلى */}
          <header className="flex items-center gap-2">
            <span className="h-6 w-6 rounded-md bg-accent/15 border border-accent/30 grid place-items-center">
              <span className="h-1.5 w-1.5 rounded-full bg-accent" />
            </span>
            <span className="font-display font-semibold text-[17px] tracking-tight text-ink">
              MAWG
            </span>
          </header>

          {/* النص الترويجي في المنتصف */}
          <div className="max-w-lg">
            <h1 className="font-display text-[44px] lg:text-[52px] leading-[1.04] tracking-tight text-ink-strong">
              Describe a site.
              <br />
              Ship it in seconds.
            </h1>
            <p className="mt-5 text-ink-muted text-[15px] leading-relaxed max-w-md">
              A multi-agent pipeline plans, drafts, and polishes a complete HTML
              landing page from a single prompt.
            </p>
          </div>

          {/* تذييل الجانب الأيسر — مراحل المعالجة */}
          <footer className="flex items-center justify-between text-[12px] text-ink-subtle">
            <div className="flex items-center gap-4">
              <span>Plan</span>
              <span className="text-line-strong">·</span>
              <span>Build</span>
              <span className="text-line-strong">·</span>
              <span>Polish</span>
            </div>
            <span className="meta">Multi-Agent Web Generator</span>
          </footer>
        </div>
      </div>

      {/* ===== الجانب الأيمن — النموذج ===== */}
      <div className="flex items-center justify-center px-6 py-10 md:px-14">
        <div className="w-full max-w-md">
          {/* شعار صغير يظهر فقط على الجوال (لأن الجانب الأيسر مخفي) */}
          <div className="md:hidden flex items-center gap-2 mb-10">
            <span className="h-6 w-6 rounded-md bg-accent/15 border border-accent/30 grid place-items-center">
              <span className="h-1.5 w-1.5 rounded-full bg-accent" />
            </span>
            <span className="font-display font-semibold text-[16px] tracking-tight text-ink">
              MAWG
            </span>
          </div>

          {/* العنوان والنص الفرعي */}
          <div className="mb-7">
            {subtitle && (
              <div className="meta text-accent mb-2">{subtitle}</div>
            )}
            <h2 className="font-display text-[28px] leading-tight tracking-tight text-ink-strong">
              {title}
            </h2>
          </div>

          {/* محتوى النموذج (تأتي من الصفحة المستدعية) */}
          {children}

          {/* التذييل (اختياري) — مثل: "ليس لديك حساب؟" */}
          {footer && (
            <div className="mt-8 pt-6 hairline text-[13px] text-ink-muted text-center">
              {footer}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
