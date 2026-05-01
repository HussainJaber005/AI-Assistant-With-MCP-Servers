// =====================================================================
// AuthContext.jsx
// "السياق" (Context) المسؤول عن إدارة حالة المستخدم في كامل التطبيق
// يوفّر:
//   - بيانات المستخدم الحالي
//   - حالة التحميل (هل ما زلنا نتحقق من تسجيل الدخول؟)
//   - دوال: login / register / logout / refresh
// أي مكوّن يحتاج معرفة "هل المستخدم مسجل؟" يستدعي useAuth()
// =====================================================================

import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { api } from "../lib/api";   // مكتبة الاتصال بالـ backend

// إنشاء كائن السياق — قيمته الافتراضية null
const AuthContext = createContext(null);

// المزوّد — يلف التطبيق كله ويُمرر البيانات لكل المكونات
export function AuthProvider({ children }) {
  // user: بيانات المستخدم (null لو غير مسجل)
  const [user, setUser] = useState(null);
  // loading: true أثناء أول تحقق من الجلسة
  const [loading, setLoading] = useState(true);

  // تحديث بيانات المستخدم من الـ backend
  // useCallback يمنع إعادة إنشاء الدالة عند كل render
  const refresh = useCallback(async () => {
    try {
      // نسأل الخادم: "من أنا؟"
      const { user } = await api.me();
      setUser(user);
    } catch {
      // لو فشل الطلب — معناه غير مسجل دخول
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  // عند تحميل التطبيق لأول مرة، نتحقق من الجلسة
  useEffect(() => {
    refresh();
  }, [refresh]);

  // تسجيل الدخول
  const login = async (email, password) => {
    const { user } = await api.login(email, password);
    setUser(user);
    return user;
  };

  // إنشاء حساب جديد (يُسجّل المستخدم تلقائيًا)
  const register = async (username, email, password) => {
    const { user } = await api.register(username, email, password);
    setUser(user);
    return user;
  };

  // تسجيل الخروج
  const logout = async () => {
    await api.logout();
    setUser(null);
  };

  // تمرير القيم لكل المكونات الأبناء
  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, refresh }}>
      {children}
    </AuthContext.Provider>
  );
}

// Hook مساعد — أي مكون يستدعي useAuth() ليصل لبيانات المستخدم
export function useAuth() {
  const ctx = useContext(AuthContext);
  // حماية: إذا استُخدم خارج AuthProvider نرمي خطأ واضح
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
