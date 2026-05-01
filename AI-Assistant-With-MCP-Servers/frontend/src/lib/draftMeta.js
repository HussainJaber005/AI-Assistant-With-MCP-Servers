// =====================================================================
// draftMeta.js
// تخزين بيانات إضافية عن الملفات المولّدة — في المتصفح فقط (localStorage)
// لماذا؟
//   - الـ backend يعرف فقط أسماء الملفات (مثل result_5.html)
//   - نحب نخزّن عنوانًا ودودًا والـ brief الأصلي بدون تعديل قاعدة البيانات
//   - فنحفظها في localStorage مرتبطة باسم الملف
// =====================================================================

// المفتاح المستخدم في localStorage — v1 لو احتجنا تغيير الصيغة لاحقًا
const KEY = "mawg:draft-meta:v1";

// قراءة كل البيانات المخزنة (object بمفاتيح أسماء الملفات)
function readAll() {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    // إذا كان JSON تالفًا أو localStorage معطلاً، نرجع كائنًا فارغًا
    return {};
  }
}

// حفظ كل البيانات
function writeAll(data) {
  try {
    localStorage.setItem(KEY, JSON.stringify(data));
  } catch {
    /* امتلأت المساحة — نتجاهل الخطأ بصمت */
  }
}

// قراءة بيانات ملف معين (يرجع null إذا لم تكن موجودة)
export function getMeta(fileName) {
  return readAll()[fileName] || null;
}

// حفظ/تحديث بيانات ملف — patch تُدمج مع البيانات السابقة
export function setMeta(fileName, patch) {
  const all = readAll();
  all[fileName] = { ...(all[fileName] || {}), ...patch };
  writeAll(all);
}

// حذف بيانات ملف (عند حذف الملف نفسه)
export function removeMeta(fileName) {
  const all = readAll();
  delete all[fileName];
  writeAll(all);
}
