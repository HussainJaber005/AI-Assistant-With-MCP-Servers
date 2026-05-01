// =====================================================================
// Register.jsx
// صفحة إنشاء حساب جديد
// تأخذ: اسم مستخدم + بريد + كلمة مرور
// مع مقياس مرئي يبيّن قوة كلمة المرور أثناء الكتابة
// عند النجاح يتم تسجيل المستخدم تلقائيًا وإرساله للصفحة الرئيسية
// =====================================================================

import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { AuthLayout } from "../components/AuthLayout";
import { AlertCircle, Lock, Mail, User, Eye, EyeOff } from "../components/icons";

export default function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();

  // حالات النموذج
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);            // إظهار/إخفاء كلمة المرور
  const [error, setError] = useState("");                   // رسالة الخطأ
  const [submitting, setSubmitting] = useState(false);      // هل الطلب قيد التنفيذ؟

  // تركيز تلقائي على اسم المستخدم عند فتح الصفحة
  const usernameRef = useRef(null);
  useEffect(() => { usernameRef.current?.focus(); }, []);

  // حساب قوة كلمة المرور الحالية (0–4)
  const strength = scorePassword(password);

  // عند الضغط على زر إنشاء الحساب
  const onSubmit = async (e) => {
    e.preventDefault();
    setError("");
    // فحص محلي قبل إرسال الطلب
    if (password.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }
    setSubmitting(true);
    try {
      await register(username, email, password);
      // نجاح — التطبيق يُسجّل المستخدم ويوجّهه للرئيسية
      navigate("/", { replace: true });
    } catch (err) {
      // فشل — مثل: البريد محجوز، اسم المستخدم محجوز
      setError(err.message || "Registration failed");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthLayout
      title="Create your studio"
      subtitle="Get started"
      footer={
        <>
          Already a member?{" "}
          <Link to="/login" className="link">
            Sign in
          </Link>
        </>
      }
    >
      <form onSubmit={onSubmit} className="space-y-5" noValidate>
        <Field label="Username" icon={<User className="h-4 w-4" />}>
          <input
            ref={usernameRef}
            id="username"
            type="text"
            required
            autoComplete="username"
            minLength={3}
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="input pl-10"
            placeholder="jane"
          />
        </Field>

        <Field label="Email" icon={<Mail className="h-4 w-4" />}>
          <input
            id="email"
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="input pl-10"
            placeholder="you@studio.com"
          />
        </Field>

        <div>
          <label className="meta text-ink-muted block mb-2">Password</label>
          <div className="relative">
            <span className="text-ink-subtle absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none">
              <Lock className="h-4 w-4" />
            </span>
            <input
              id="password"
              type={showPw ? "text" : "password"}
              required
              autoComplete="new-password"
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="input pl-10 pr-10"
              placeholder="At least 6 characters"
            />
            <button
              type="button"
              onClick={() => setShowPw((v) => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-subtle hover:text-ink transition-colors"
              tabIndex={-1}
              title={showPw ? "Hide password" : "Show password"}
            >
              {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          <StrengthMeter strength={strength} value={password} />
        </div>

        {error && (
          <div className="flex items-start gap-2 text-[13px] text-danger bg-danger-soft border border-danger/25 rounded-lg px-3 py-2.5">
            <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <button type="submit" className="btn-primary w-full h-11" disabled={submitting}>
          {submitting ? "Creating account…" : "Create account"}
        </button>
      </form>
    </AuthLayout>
  );
}

function Field({ label, icon, children }) {
  return (
    <div>
      <label className="meta text-ink-muted block mb-2">{label}</label>
      <div className="relative">
        <span className="text-ink-subtle absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none">
          {icon}
        </span>
        {children}
      </div>
    </div>
  );
}

// =====================================================================
// حساب قوة كلمة المرور — يرجع رقمًا من 0 إلى 4
// نقطة لكل شرط محقق:
//   - أطول من 6
//   - أطول من 10
//   - يحتوي حروفًا كبيرة وصغيرة
//   - يحتوي أرقامًا
//   - يحتوي رموزًا خاصة
// =====================================================================
function scorePassword(pw) {
  if (!pw) return 0;
  let score = 0;
  if (pw.length >= 6) score++;
  if (pw.length >= 10) score++;
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) score++;
  if (/[0-9]/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;
  return Math.min(score, 4);
}

// =====================================================================
// مقياس قوة كلمة المرور المرئي
// 4 شرائط: تتلون حسب القوة (أحمر/برتقالي/أخضر)
// =====================================================================
function StrengthMeter({ strength, value }) {
  // رسالة ابتدائية قبل الكتابة
  if (!value) {
    return (
      <p className="mt-1.5 text-[11.5px] text-ink-subtle">
        Must be at least 6 characters.
      </p>
    );
  }
  // تسميات الفئات الخمس
  const labels = ["Too weak", "Weak", "Okay", "Good", "Strong"];
  // ألوان كل فئة
  const colors = [
    "bg-danger",
    "bg-danger",
    "bg-warning",
    "bg-success",
    "bg-success",
  ];
  return (
    <div className="mt-2">
      {/* الشرائط الأربعة */}
      <div className="flex gap-1">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className={`h-1 flex-1 rounded-full transition-colors ${
              strength > i ? colors[strength] : "bg-line"
            }`}
          />
        ))}
      </div>
      {/* تسمية القوة + عدد الحروف */}
      <div className="mt-1 flex items-center justify-between text-[11px]">
        <span className="text-ink-subtle">{labels[strength]}</span>
        <span className="meta text-ink-faint">{value.length} chars</span>
      </div>
    </div>
  );
}
