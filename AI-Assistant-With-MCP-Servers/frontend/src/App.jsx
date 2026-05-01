// =====================================================================
// App.jsx
// المكوّن الجذر — يحدّد بنية التطبيق العامة:
//   1. AuthProvider يوفر بيانات المستخدم لكل المكونات
//   2. Toaster لعرض الإشعارات (نجاح/خطأ)
//   3. Router يحدد الصفحات حسب الـ URL
//   4. حماية الصفحات: /login و /register للزوار فقط
//                     / (لوحة التحكم) للمسجلين فقط
// =====================================================================

// مكتبة التوجيه (Routing) — تنقل المستخدم بين الصفحات بدون إعادة تحميل
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";

// مكتبة الإشعارات (Toast notifications)
import { Toaster } from "sonner";

// مزوّد المصادقة — يوفر بيانات المستخدم الحالي للتطبيق كله
import { AuthProvider } from "./context/AuthContext";

// مكونات حماية الصفحات
// ProtectedRoute: يسمح فقط للمسجلين (يوجّه للـ login إن لم يكن مسجلًا)
// GuestOnly: يسمح فقط للزوار (يوجّه للـ Dashboard إن كان مسجلًا)
import { ProtectedRoute, GuestOnly } from "./components/ProtectedRoute";

// الصفحات الثلاث
import Login from "./pages/Login";
import Register from "./pages/Register";
import Dashboard from "./pages/Dashboard";

// المكوّن الرئيسي
export default function App() {
  return (
    // AuthProvider يلف كل التطبيق ليوفّر بيانات المستخدم في أي مكان
    <AuthProvider>
      {/* مكوّن الإشعارات — يظهر في أسفل يمين الشاشة بثيم داكن */}
      <Toaster
        position="bottom-right"
        theme="dark"
        richColors
        toastOptions={{
          style: {
            background: "#18191C",
            border: "1px solid #292B30",
            color: "#E6E7EA",
            fontFamily: "'General Sans', sans-serif",
          },
        }}
      />
      {/* مُوجّه التطبيق — يقرأ الـ URL ويعرض الصفحة المناسبة */}
      <BrowserRouter>
        <Routes>
          {/* صفحة تسجيل الدخول — للزوار فقط */}
          <Route
            path="/login"
            element={
              <GuestOnly>
                <Login />
              </GuestOnly>
            }
          />
          {/* صفحة التسجيل — للزوار فقط */}
          <Route
            path="/register"
            element={
              <GuestOnly>
                <Register />
              </GuestOnly>
            }
          />
          {/* الصفحة الرئيسية (لوحة التحكم) — للمستخدمين المسجلين فقط */}
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <Dashboard />
              </ProtectedRoute>
            }
          />
          {/* أي مسار غير معروف يعيد توجيه المستخدم للرئيسية */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
