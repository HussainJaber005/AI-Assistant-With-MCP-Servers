INDEX_HTML = r"""
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Multi Agents Web Generator</title>
  <style>
    * { box-sizing: border-box; }
    body {
      font-family: Arial, sans-serif;
      background: #09090b;
      color: white;
      margin: 0;
      padding: 0;
    }
    .wrap {
      display: grid;
      grid-template-columns: 420px 1fr;
      height: 100vh;
    }
    .left, .right {
      display: flex;
      flex-direction: column;
      gap: 12px;
      padding: 16px;
      min-height: 0;
    }
    .left {
      border-right: 1px solid #27272a;
    }
    .messages, .history, .panel {
      border: 1px solid #27272a;
      background: #18181b;
      border-radius: 12px;
    }
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
    .user { background: #6d28d9; }
    .ai { background: #27272a; }
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
    button {
      background: #6d28d9;
      color: white;
      border: none;
      padding: 10px 14px;
      border-radius: 8px;
      cursor: pointer;
    }
    button:hover { background: #7c3aed; }
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
    }
    .history-item:hover { background: #3f3f46; }
    .right {
      min-width: 0;
    }
    .split {
      display: grid;
      grid-template-rows: 1fr 1fr;
      gap: 12px;
      min-height: 0;
      flex: 1;
    }
    iframe {
      width: 100%;
      height: 100%;
      border: 0;
      border-radius: 12px;
      background: white;
    }
    pre {
      margin: 0;
      padding: 14px;
      overflow: auto;
      white-space: pre;
      word-break: normal;
      min-height: 100%;
      color: #e4e4e7;
      font-size: 12px;
      line-height: 1.5;
    }
    .panel {
      min-height: 0;
      overflow: hidden;
    }
    .panel h3 {
      margin: 0;
      padding: 12px 14px;
      border-bottom: 1px solid #27272a;
      font-size: 15px;
    }
    .panel .body {
      height: calc(100% - 46px);
    }
  </style>
</head>
<body>
  <div class="wrap">
    <div class="left">
      <h2>MAWG</h2>

      <div class="messages" id="chatMessages">
        <div class="msg ai">Describe the landing page you want to build.</div>
      </div>

      <textarea id="promptInput" placeholder="Describe what you want to build..."></textarea>

      <div class="row">
        <button onclick="submitPrompt()">Generate</button>
        <button onclick="loadResults()">Refresh Results</button>
      </div>

      <div class="muted" id="statusText">ready</div>

      <h3>Generated Files</h3>
      <div class="history" id="historyList"></div>
    </div>

    <div class="right">
      <div class="split">
        <div class="panel">
          <h3>Preview</h3>
          <div class="body">
            <iframe id="previewFrame"></iframe>
          </div>
        </div>

        <div class="panel">
          <h3>View Source</h3>
          <div class="body">
            <pre id="sourceCode">Select a generated file to view its source.</pre>
          </div>
        </div>
      </div>
    </div>
  </div>

  <script>
    const API_URL = "/ai_assistant";
    const RESULTS_URL = "/results";
    const SOURCE_URL = "/source/";
    const RESULT_BASE = "/result/";

    function addMessage(text, type = "ai") {
      const el = document.createElement("div");
      el.className = "msg " + type;
      el.textContent = text;
      document.getElementById("chatMessages").appendChild(el);
      el.scrollIntoView({ behavior: "smooth" });
    }

    function setStatus(text) {
      document.getElementById("statusText").textContent = text;
    }

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
          throw new Error(detail);
        }

        const response = data.response;
        addMessage(response.message + "\n" + (response.debug_message || ""), "ai");
        setStatus("done");

        await loadResults();

        if (response.file_name) {
          openResult(response.file_name);
          loadSource(response.file_name);
        }
      } catch (err) {
        addMessage("Error: " + err.message, "ai");
        setStatus("error");
      }
    }

    async function loadResults() {
      try {
        const res = await fetch(RESULTS_URL);
        const data = await res.json();

        const list = document.getElementById("historyList");
        list.innerHTML = "";

        for (const file of data.results) {
          const item = document.createElement("div");
          item.className = "history-item";
          item.textContent = file.file_name;
          item.onclick = () => {
            openResult(file.file_name);
            loadSource(file.file_name);
          };
          list.appendChild(item);
        }
      } catch (err) {
        console.error(err);
      }
    }

    function openResult(fileName) {
      const frame = document.getElementById("previewFrame");
      frame.src = RESULT_BASE + encodeURIComponent(fileName);
      setStatus(fileName);
    }

    async function loadSource(fileName) {
      try {
        const res = await fetch(SOURCE_URL + encodeURIComponent(fileName));
        const text = await res.text();
        document.getElementById("sourceCode").textContent = text;
      } catch (err) {
        document.getElementById("sourceCode").textContent = "Failed to load source: " + err.message;
      }
    }

    loadResults();
  </script>
</body>
</html>
"""