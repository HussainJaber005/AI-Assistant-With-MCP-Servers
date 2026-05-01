// =====================================================================
// main.jsx
// نقطة دخول تطبيق React — أول ملف يعمل عند فتح الموقع
// مهمته: تركيب التطبيق <App /> داخل عنصر <div id="root"> في index.html
// =====================================================================

import { StrictMode } from 'react'                  // وضع صارم يساعد في كشف الأخطاء
import { createRoot } from 'react-dom/client'        // واجهة React الحديثة لتركيب التطبيق
import './index.css'                                  // تحميل ملف الأنماط العام
import App from './App.jsx'                          // المكوّن الجذر للتطبيق

// إنشاء جذر React وتركيب التطبيق
// StrictMode يُشغّل المكونات مرتين في وضع التطوير لاكتشاف الأخطاء
createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
