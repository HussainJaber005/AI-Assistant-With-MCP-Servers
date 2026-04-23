# ui.py
# واجهة المستخدم الرئيسية للمشروع
# هذا الملف يحتوي صفحة HTML كاملة داخل متغير Python
# ويتم عرضها من خلال api.py عند فتح الصفحة الرئيسية

INDEX_HTML = r"""
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Multi Agents Web Generator</title>

  <style>
    /* =========================
       Global Reset
    ========================= */
    * {
      box-sizing: border-box;
    }

    body {
      font-family: Arial, sans-serif;
      background: #09090b;
      color: white;
      margin: 0;
      padding: 0;
      overflow: hidden;
    }

    /* =========================
       Main Layout
       يسار: الشات والملفات
       يمين: المعاينة + السورس
    ========================= */
    .wrap {
      display: grid;
      grid-template-columns: 420px 1fr;
      height: 100vh;
      overflow: hidden;
    }

    .left,
    .right {
      display: flex;
      flex-direction: column;
      gap: 12px;
      padding: 16px;
      min-height: 0;
    }

    .left {
      border-right: 1px solid #27272a;
    }

    .right {
      min-width: 0;
      min-height: 0;
    }

    /* =========================
       Shared Panels
    ========================= */
    .messages,
    .history,
    .panel {
      border: 1px solid #27272a;
      background: #18181b;
      border-radius: 12px;
    }

    /* =========================
       Chat Messages Box
    ========================= */
    .messages {
      flex: 1;
      overflow-y: auto;
      padding: 12px;
      min-height: 160px;
    }

    .msg {
      margin-bottom: 10px;
      padding: 10px 12px;
      border-radius: 10px;
      white-space: pre-wrap;
      word-break: break-word;
    }

    .user {
      background: #6d28d9;
    }

    .ai {
      background: #27272a;
    }

    /* =========================
       Input Area
    ========================= */
    textarea {
      width: 100%;
      min-height: 92px;
      background: #18181b;
      color: white;
      border: 1px solid #27272a;
      border-radius: 10px;
      padding: 10px;
      resize: vertical;
    }

    /* =========================
       Buttons
    ========================= */
    button {
      background: #6d28d9;
      color: white;
      border: none;
      padding: 10px 14px;
      border-radius: 8px;
      cursor: pointer;
      transition: 0.2s ease;
    }

    button:hover {
      background: #7c3aed;
    }

    .secondary-btn {
      background: #27272a;
      border: 1px solid #3f3f46;
    }

    .secondary-btn:hover {
      background: #3f3f46;
    }

    .row {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
      align-items: center;
    }

    .muted {
      color: #a1a1aa;
      font-size: 14px;
      white-space: pre-wrap;
    }

    /* =========================
       Generated Files List
    ========================= */
    .history {
      max-height: 220px;
      overflow-y: auto;
      padding: 10px;
    }

    .history-item {
      background: #27272a;
      padding: 8px 10px;
      border-radius: 8px;
      cursor: pointer;
      margin-bottom: 8px;
      border: 1px solid transparent;
      transition: 0.2s ease;
    }

    .history-item:hover {
      background: #3f3f46;
      border-color: #52525b;
    }

    /* =========================
       Right Side Split
    ========================= */
    .split {
      display: grid;
      grid-template-rows: minmax(470px, 1.75fr) minmax(320px, 1fr);
      gap: 12px;
      min-height: 0;
      flex: 1;
    }

    /* =========================
       Generic Panel Structure
    ========================= */
    .panel {
      min-height: 0;
      overflow: hidden;
      display: flex;
      flex-direction: column;
    }

    .panel h3 {
      margin: 0;
      padding: 12px 14px;
      border-bottom: 1px solid #27272a;
      font-size: 15px;
    }

    .panel-toolbar {
      display: flex;
      gap: 8px;
      align-items: center;
      justify-content: space-between;
      padding: 10px 14px;
      border-bottom: 1px solid #27272a;
      background: #111114;
    }

    .panel-toolbar .left-tools,
    .panel-toolbar .right-tools {
      display: flex;
      gap: 8px;
      align-items: center;
      flex-wrap: wrap;
    }

    .panel .body {
      flex: 1;
      min-height: 0;
      overflow: auto;
    }

    /* =========================
       Preview Iframe
    ========================= */
    iframe {
      width: 100%;
      height: 100%;
      min-height: 470px;
      border: 0;
      border-radius: 12px;
      background: white;
      display: block;
    }

    /* =========================
       Source Code Area
    ========================= */
    pre {
      margin: 0;
      padding: 14px;
      height: 100%;
      overflow: auto;
      white-space: pre-wrap;
      word-break: break-word;
      color: #e4e4e7;
      font-size: 12px;
      line-height: 1.6;
      font-family: Consolas, "Courier New", monospace;
    }

    /* =========================
       Small Helpers
    ========================= */
    .mono {
      font-family: Consolas, "Courier New", monospace;
    }

    .small-text {
      font-size: 12px;
      color: #a1a1aa;
    }
  </style>
</head>
<body>
  <div class="wrap">

    <!-- =========================
         LEFT SIDE
         الشات + إدخال الطلب + الملفات الناتجة
    ========================= -->
    <div class="left">
      <h2>MAWG</h2>

      <!-- منطقة الرسائل -->
      <div class="messages" id="chatMessages">
        <div class="msg ai">Describe the landing page you want to build.</div>
      </div>

      <!-- مربع إدخال وصف الصفحة -->
      <textarea id="promptInput" placeholder="Describe what you want to build..."></textarea>

      <!-- أزرار التحكم -->
      <div class="row">
        <button onclick="submitPrompt()">Generate</button>
        <button onclick="loadResults()">Refresh Results</button>
        <button class="secondary-btn" onclick="window.location.href='/logout'">Logout</button>
      </div>

      <!-- حالة النظام الحالية -->
      <div class="muted" id="statusText">ready</div>

      <!-- اسم الملف الحالي المفتوح -->
      <div class="small-text mono" id="currentFileText"></div>

      <!-- قائمة الملفات الناتجة -->
      <h3>Generated Files</h3>
      <div class="history" id="historyList"></div>
    </div>

    <!-- =========================
         RIGHT SIDE
         Preview + Source Code
    ========================= -->
    <div class="right">
      <div class="split">

        <!-- =========================
             Preview Panel
        ========================= -->
        <div class="panel">
          <h3>Preview</h3>
          <div class="body">
            <iframe id="previewFrame"></iframe>
          </div>
        </div>

        <!-- =========================
             Source Code Panel
        ========================= -->
        <div class="panel">
          <h3>View Source</h3>

          <!-- شريط أدوات السورس -->
          <div class="panel-toolbar">
            <div class="left-tools">
              <button class="secondary-btn" onclick="copySource()">Copy Source</button>
            </div>

            <div class="right-tools">
              <span class="small-text" id="sourceInfoText">No source loaded</span>
            </div>
          </div>

          <div class="body">
            <pre id="sourceCode">Select a generated file to view its source.</pre>
          </div>
        </div>
      </div>
    </div>
  </div>

  <script>
    // =========================
    // API Endpoints
    // =========================
    const API_URL = "/ai_assistant";
    const RESULTS_URL = "/results";
    const SOURCE_URL = "/source/";
    const RESULT_BASE = "/result/";

    // =========================
    // DOM Helpers
    // =========================

    // إضافة رسالة جديدة إلى صندوق المحادثة
    function addMessage(text, type = "ai") {
      const el = document.createElement("div");
      el.className = "msg " + type;
      el.textContent = text;

      const box = document.getElementById("chatMessages");
      box.appendChild(el);
      el.scrollIntoView({ behavior: "smooth", block: "end" });
    }

    // تحديث سطر الحالة
    function setStatus(text) {
      document.getElementById("statusText").textContent = text;
    }

    // تحديث اسم الملف المعروض حاليًا
    function setCurrentFile(text) {
      document.getElementById("currentFileText").textContent = text || "";
    }

    // تحديث معلومة السورس
    function setSourceInfo(text) {
      document.getElementById("sourceInfoText").textContent = text || "";
    }

    // تحويل المستخدم إلى login عند انتهاء الجلسة
    function redirectToLoginIfUnauthorized(message, statusCode = null) {
      const msg = String(message || "");
      if (statusCode === 401 || msg.includes("401") || msg.toLowerCase().includes("unauthorized")) {
        window.location.href = "/login";
        return true;
      }
      return false;
    }

    // =========================
    // Main Submit Function
    // ترسل وصف المستخدم إلى الباك إند
    // ثم تعرض النتيجة والملف الناتج
    // =========================
    async function submitPrompt() {
      const input = document.getElementById("promptInput");
      const prompt = input.value.trim();

      if (!prompt) return;

      addMessage(prompt, "user");
      setStatus("generating...");
      input.value = "";

      try {
        const res = await fetch(API_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ user_query: prompt })
        });

        const data = await res.json();

        if (!res.ok) {
          const detail = data?.detail || data?.error?.message || ("Server error " + res.status);

          if (redirectToLoginIfUnauthorized(detail, res.status)) {
            return;
          }

          throw new Error(detail);
        }

        const response = data.response;

        addMessage(
          response.message + "\n" + (response.debug_message || ""),
          "ai"
        );

        setStatus("done");

        // إعادة تحميل قائمة النتائج
        await loadResults();

        // فتح الملف الأخير مباشرة
        if (response.file_name) {
          openResult(response.file_name);
          await loadSource(response.file_name);
        }

      } catch (err) {
        if (redirectToLoginIfUnauthorized(err.message)) {
          return;
        }

        addMessage("Error: " + err.message, "ai");
        setStatus("error");
      }
    }

    // =========================
    // Load All Generated Results
    // تجلب جميع الملفات الموجودة داخل مجلد result
    // =========================
    async function loadResults() {
      try {
        const res = await fetch(RESULTS_URL);

        if (res.status === 401) {
          window.location.href = "/login";
          return;
        }

        const data = await res.json();

        const list = document.getElementById("historyList");
        list.innerHTML = "";

        for (const file of data.results) {
          const item = document.createElement("div");
          item.className = "history-item";
          item.textContent = file.file_name;

          item.onclick = async () => {
            openResult(file.file_name);
            await loadSource(file.file_name);
          };

          list.appendChild(item);
        }
      } catch (err) {
        console.error("Failed to load results:", err);
      }
    }

    // =========================
    // Open Generated HTML in iframe
    // =========================
    function openResult(fileName) {
      const frame = document.getElementById("previewFrame");
      frame.src = RESULT_BASE + encodeURIComponent(fileName);

      setStatus(fileName);
      setCurrentFile(fileName);
    }

    // =========================
    // Load Source Code
    // يجلب HTML كنص كامل ويعرضه في pre
    // =========================
    async function loadSource(fileName) {
      try {
        const res = await fetch(SOURCE_URL + encodeURIComponent(fileName));

        if (res.status === 401) {
          window.location.href = "/login";
          return;
        }

        const text = await res.text();

        document.getElementById("sourceCode").textContent = text;
        setSourceInfo(fileName + " loaded");
      } catch (err) {
        document.getElementById("sourceCode").textContent =
          "Failed to load source: " + err.message;
        setSourceInfo("source load failed");
      }
    }

    // =========================
    // Copy Source Instantly
    // ينسخ كامل الـ HTML الموجود في View Source
    // =========================
    async function copySource() {
      const text = document.getElementById("sourceCode").textContent;

      try {
        await navigator.clipboard.writeText(text);
        setStatus("source copied");
        setSourceInfo("copied to clipboard");
      } catch (err) {
        setStatus("copy failed");
        setSourceInfo("copy failed: " + err.message);
      }
    }

    // =========================
    // Initial Load
    // =========================
    loadResults();
  </script>
</body>
</html>
"""