// =====================================================================
// Login.jsx
// صفحة تسجيل الدخول
// تأخذ البريد + كلمة المرور وتُرسلها للـ backend
// عند النجاح: تُوجّه المستخدم للصفحة الرئيسية (أو الصفحة التي حاول الوصول لها قبل الدخول)
// =====================================================================

import { useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { AuthLayout } from "../components/AuthLayout";
import { AlertCircle, Lock, Mail, Eye, EyeOff } from "../components/icons";

export default function Login() {
  // دالة تسجيل الدخول من السياق
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  // إذا كان المستخدم حاول الوصول لصفحة محمية قبل الدخول، نرجعه إليها بعد النجاح
  const from = location.state?.from?.pathname || "/";

  // حالات النموذج
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);          // إظهار/إخفاء كلمة المرور
  const [error, setError] = useState("");                 // رسالة الخطأ
  const [submitting, setSubmitting] = useState(false);    // هل الطلب قيد التنفيذ؟

  // تركيز تلقائي على حقل البريد عند فتح الصفحة
  const emailRef = useRef(null);
  useEffect(() => { emailRef.current?.focus(); }, []);

  // عند الضغط على زر تسجيل الدخول
  const onSubmit = async (e) => {
    e.preventDefault();           // منع إعادة تحميل الصفحة
    setError("");
    setSubmitting(true);
    try {
      await login(email, password);
      // نجاح — نوجه للصفحة المطلوبة
      navigate(from, { replace: true });
    } catch (err) {
      // فشل — نُظهر رسالة الخطأ
      setError(err.message || "Login failed");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    // قالب الصفحة المشترك (الجانب الأيسر برندي والجانب الأيمن نموذج)
    <AuthLayout
      title="Welcome back"
      subtitle="Sign in"
      footer={
        <>
          New to MAWG?{" "}
          <Link to="/register" className="link">
            Create an account
          </Link>
        </>
      }
    >
      <form onSubmit={onSubmit} className="space-y-5" noValidate>
        {/* حقل البريد */}
        <Field label="Email" icon={<Mail className="h-4 w-4" />}>
          <input
            ref={emailRef}
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

        {/* حقل كلمة المرور — مع زر إظهار/إخفاء */}
        <Field label="Password" icon={<Lock className="h-4 w-4" />}>
          <input
            id="password"
            type={showPw ? "text" : "password"}
            required
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="input pl-10 pr-10"
            placeholder="••••••••"
          />
          {/* زر العين — يبدّل بين إظهار/إخفاء كلمة المرور */}
          <button
            type="button"
            onClick={() => setShowPw((v) => !v)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-subtle hover:text-ink transition-colors"
            tabIndex={-1}
            title={showPw ? "Hide password" : "Show password"}
          >
            {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </Field>

        {/* عرض رسالة الخطأ إن وُجدت */}
        {error && (
          <div className="flex items-start gap-2 text-[13px] text-danger bg-danger-soft border border-danger/25 rounded-lg px-3 py-2.5">
            <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* زر تسجيل الدخول — يتعطل أثناء الإرسال */}
        <button type="submit" className="btn-primary w-full h-11" disabled={submitting}>
          {submitting ? "Signing in…" : "Sign in"}
        </button>
      </form>
    </AuthLayout>
  );
}

// مكوّن صغير لتغليف كل حقل (label + أيقونة + الحقل نفسه)
function Field({ label, icon, children }) {
  return (
    <div>
      <label className="meta text-ink-muted block mb-2">{label}</label>
      <div className="relative">
        {/* الأيقونة في يسار الحقل */}
        <span className="text-ink-subtle absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none">
          {icon}
        </span>
        {children}
      </div>
    </div>
  );
}
