// =====================================================================
// ProtectedRoute.jsx
// مكونان لحماية الصفحات:
//   1. ProtectedRoute: الصفحات للمسجلين فقط (مثل لوحة التحكم)
//   2. GuestOnly: الصفحات للزوار فقط (تسجيل الدخول/التسجيل)
// =====================================================================

import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { Loader } from "./Loader";

// ===== المسارات المحمية =====
// إذا لم يكن المستخدم مسجلاً، يُرسَل إلى /login
export function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  // أثناء التحقق من الجلسة نُظهر شاشة تحميل
  if (loading) return <Loader fullscreen label="Loading session..." />;
  // غير مسجل → نوجّه لصفحة الدخول (مع حفظ المسار للعودة لاحقًا)
  if (!user) return <Navigate to="/login" state={{ from: location }} replace />;
  // مسجل → نُظهر الصفحة كالمعتاد
  return children;
}

// ===== مسارات الزوار فقط =====
// إذا كان المستخدم مسجلاً، يُرسَل إلى الصفحة الرئيسية
export function GuestOnly({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <Loader fullscreen label="Loading session..." />;
  // مسجل بالفعل → لا داعي لرؤية صفحة تسجيل الدخول
  if (user) return <Navigate to="/" replace />;
  return children;
}
