// =====================================================================
// api.js
// طبقة الاتصال بالـ backend
// كل طلب يمر من خلال هذا الملف بدلاً من تكرار fetch في كل مكان
// المميزات:
//   1. يضمن إرسال الكوكيز مع كل طلب (للجلسة)
//   2. يحوّل الردود تلقائيًا (JSON أو نص)
//   3. يرمي خطأً منظمًا عند فشل أي طلب
// =====================================================================

// دالة موحدة للطلبات — تُغلّف fetch بإعدادات افتراضية
async function request(path, { method = "GET", body, headers } = {}) {
  const res = await fetch(path, {
    method,
    credentials: "include",   // ضروري لإرسال الكوكي مع الطلب (للجلسة)
    headers: {
      "Content-Type": "application/json",
      ...headers,
    },
    // إذا كان هناك body نحوّله إلى JSON
    body: body ? JSON.stringify(body) : undefined,
  });

  // قراءة الرد — JSON أو نص حسب نوع المحتوى
  const ct = res.headers.get("content-type") || "";
  const data = ct.includes("application/json") ? await res.json() : await res.text();

  // إذا لم يكن الرد ناجحًا (status غير 2xx) نرمي خطأ مفصّل
  if (!res.ok) {
    const err = new Error(
      (data && data.detail) || (typeof data === "string" ? data : `HTTP ${res.status}`)
    );
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}

// كائن api يجمع كل الطلبات في مكان واحد
// أي مكون يستدعي api.login(...) أو api.generate(...)
export const api = {
  // ===== المصادقة =====
  me: () => request("/api/auth/me"),                                // جلب المستخدم الحالي
  login: (email, password) =>
    request("/api/auth/login", { method: "POST", body: { email, password } }),
  register: (username, email, password) =>
    request("/api/auth/register", {
      method: "POST",
      body: { username, email, password },
    }),
  logout: () => request("/api/auth/logout", { method: "POST" }),

  // ===== النتائج =====
  listResults: () => request("/api/results"),                        // قائمة كل ملفات HTML
  deleteResult: (fileName) =>
    request(`/api/results/${encodeURIComponent(fileName)}`, { method: "DELETE" }),

  // جلب الكود المصدري (HTML خام) — هذا الطلب يرجع نصًا وليس JSON
  getSource: async (fileName) => {
    const res = await fetch(`/api/source/${encodeURIComponent(fileName)}`, {
      credentials: "include",
    });
    if (!res.ok) throw new Error(`Failed to load source (${res.status})`);
    return res.text();
  },

  // ===== الذكاء الاصطناعي =====
  // مرحلة الأسئلة التوضيحية
  clarify: (userQuery) =>
    request("/api/ai_clarify", {
      method: "POST",
      body: { user_query: userQuery },
    }),

  // مرحلة التوليد النهائي للـ HTML
  generate: (userQuery) =>
    request("/api/ai_assistant", {
      method: "POST",
      body: { user_query: userQuery },
    }),
};
