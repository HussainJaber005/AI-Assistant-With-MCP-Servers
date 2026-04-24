import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels";
import { useAuth } from "../context/AuthContext";
import { api } from "../lib/api";
import { toast } from "sonner";
import { SourceView } from "../components/SourceView";
import { CommandPalette } from "../components/CommandPalette";
import { ShortcutsOverlay } from "../components/ShortcutsOverlay";
import { getMeta, setMeta, removeMeta } from "../lib/draftMeta";
import {
  Send,
  RefreshCw,
  LogOut,
  Copy,
  Check,
  File as FileIcon,
  Eye,
  Code,
  AlertCircle,
  ExternalLink,
  MessageSquare,
  Layers,
  Monitor,
  Tablet,
  Smartphone,
  PanelRight,
  PanelLeft,
  Slash,
  Sparkles,
  Maximize,
  Minimize,
  Grid,
  Download,
  Trash,
  Edit,
  Search,
  Command,
  Keyboard,
  Plus,
} from "../components/icons";

const SUGGESTIONS = [
  "A sleek SaaS landing page for an AI code review tool.",
  "A minimal portfolio — hero, 3 projects, contact.",
  "A dark crypto wallet page with FAQ and features.",
];

const DEVICES = [
  { id: "desktop", label: "Desktop", width: 1536, icon: Monitor },
  { id: "tablet",  label: "Tablet",  width: 834,  icon: Tablet  },
  { id: "mobile",  label: "Mobile",  width: 390,  icon: Smartphone },
];

const MOBILE_TABS = [
  { id: "brief",   label: "Brief",   icon: MessageSquare },
  { id: "drafts",  label: "Drafts",  icon: Layers },
  { id: "preview", label: "Preview", icon: Eye },
  { id: "source",  label: "Source",  icon: Code },
];

/** Compose the final prompt sent to the builder, combining the user's
 *  brief with their answers to the clarifying questions. */
function composeFinalPrompt(brief, questions, answers) {
  const lines = [];
  for (const q of questions || []) {
    const a = answers[q.key];
    if (a == null || (Array.isArray(a) && a.length === 0)) continue;
    lines.push(`- ${q.question} → ${Array.isArray(a) ? a.join(", ") : a}`);
  }
  if (!lines.length) return brief;
  return `${brief}\n\nDesign decisions:\n${lines.join("\n")}`;
}

export default function Dashboard() {
  const { user, logout } = useAuth();

  const [activity, setActivity] = useState([
    { role: "system", text: "Describe the page you want to build. I'll ask a few quick design questions first." },
  ]);
  const [prompt, setPrompt] = useState("");
  const [status, setStatus] = useState("ready");
  const [error, setError] = useState("");

  // phase: idle | analyzing | answering | building
  const [phase, setPhase] = useState("idle");
  const [pendingBrief, setPendingBrief] = useState(""); // original brief awaiting answers
  const [questions, setQuestions] = useState([]);
  const [answers, setAnswers] = useState({});

  const [files, setFiles] = useState([]);
  const [metaVersion, setMetaVersion] = useState(0); // bump to force re-read of localStorage meta
  const [current, setCurrent] = useState(null);
  const [source, setSource] = useState("");
  const [sourceInfo, setSourceInfo] = useState("");
  const [copied, setCopied] = useState(false);

  const [sideTab, setSideTab] = useState("brief");
  const [device, setDevice] = useState("desktop");
  const [mobileView, setMobileView] = useState("brief");

  // Resizable panel refs + collapsed state (desktop only)
  const briefPanelRef = useRef(null);
  const sourcePanelRef = useRef(null);
  const [briefCollapsed, setBriefCollapsed] = useState(false);
  const [sourceCollapsed, setSourceCollapsed] = useState(false);

  // Preview controls
  const [zoom, setZoom] = useState("fit"); // "fit" | 0.5 | 0.75 | 1
  const [showGrid, setShowGrid] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [previewKey, setPreviewKey] = useState(0); // bump to force iframe reload

  // Global UX
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);

  const toggleBrief = useCallback(() => {
    const p = briefPanelRef.current;
    if (!p) return;
    p.isCollapsed() ? p.expand() : p.collapse();
  }, []);
  const toggleSource = useCallback(() => {
    const p = sourcePanelRef.current;
    if (!p) return;
    p.isCollapsed() ? p.expand() : p.collapse();
  }, []);

  const feedRef = useRef(null);
  const iframeRef = useRef(null);

  const busy = phase === "analyzing" || phase === "building";

  // ---------- Data ----------

  const loadResults = useCallback(async () => {
    try {
      const data = await api.listResults();
      setFiles(data.results || []);
    } catch (err) {
      if (err.status === 401) window.location.href = "/login";
    }
  }, []);

  useEffect(() => { loadResults(); }, [loadResults]);

  useEffect(() => {
    const el = feedRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [activity, phase]);

  // Esc → exit fullscreen preview
  useEffect(() => {
    if (!fullscreen) return;
    const onKey = (e) => { if (e.key === "Escape") setFullscreen(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [fullscreen]);

  // "?" → show shortcuts (unless typing in an input)
  useEffect(() => {
    const onKey = (e) => {
      if (e.key !== "?") return;
      const t = e.target;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
      e.preventDefault();
      setShortcutsOpen((v) => !v);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Panel toggle shortcuts: Cmd/Ctrl+B brief, Cmd/Ctrl+\ source
  useEffect(() => {
    const onKey = (e) => {
      if (!(e.metaKey || e.ctrlKey)) return;
      if (e.shiftKey) return;
      if (e.key.toLowerCase() === "b") {
        e.preventDefault();
        toggleBrief();
      } else if (e.key === "\\" || e.key === "|") {
        e.preventDefault();
        toggleSource();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [toggleBrief, toggleSource]);

  const openResult = async (fileName) => {
    setCurrent(fileName);
    try {
      const text = await api.getSource(fileName);
      setSource(text);
      setSourceInfo(`${fileName} · ${formatBytes(text.length)}`);
      if (window.matchMedia("(max-width: 767px)").matches) setMobileView("preview");
    } catch (err) {
      setSource(`Failed to load source: ${err.message}`);
      setSourceInfo("source load failed");
    }
  };

  // ---------- Flow 1: analyze brief (clarify) ----------

  const analyze = async (value) => {
    const q = (value ?? prompt).trim();
    if (!q || busy) return;
    setError("");
    setPrompt("");
    setPendingBrief(q);
    setSideTab("brief");
    setMobileView("brief");

    setActivity((a) => [
      ...a,
      { role: "user", author: user?.username || "you", text: q, at: new Date() },
    ]);
    setPhase("analyzing");
    setStatus("analyzing");

    try {
      const { questions: qs } = await api.clarify(q);
      if (!qs || qs.length === 0) throw new Error("No questions returned");

      setQuestions(qs);
      // Seed every answer as a single-item array (first option) — all questions are multi-select in the UI
      const seeded = {};
      for (const x of qs) seeded[x.key] = x.options.length ? [x.options[0]] : [];
      setAnswers(seeded);

      setActivity((a) => [
        ...a,
        { role: "studio", author: "mawg", text: "A few quick design choices:", kind: "questions", at: new Date() },
      ]);
      setPhase("answering");
      setStatus("awaiting choices");
    } catch (err) {
      if (err.status === 401) { window.location.href = "/login"; return; }
      // Fallback — generate directly with the raw brief
      setActivity((a) => [
        ...a,
        { role: "studio", author: "mawg", text: `Couldn't analyze the brief (${err.message}). Building with it as-is.`, at: new Date() },
      ]);
      await build(q);
    }
  };

  // ---------- Flow 2: build (with or without answers) ----------

  const build = async (rawBrief) => {
    const brief = rawBrief ?? pendingBrief;
    if (!brief || busy) return;
    const final = composeFinalPrompt(brief, questions, answers);
    setPhase("building");
    setStatus("drafting");

    setActivity((a) => [
      ...a,
      { role: "studio", author: "mawg", text: "Building the page…", kind: "status", at: new Date() },
    ]);

    try {
      const { response } = await api.generate(final);
      setActivity((a) => [
        ...a,
        {
          role: "studio",
          author: "mawg",
          text: "Generated successfully.",
          debug: response.debug_message,
          file: response.file_name,
          at: new Date(),
        },
      ]);
      setStatus("ready");
      await loadResults();
      if (response.file_name) {
        setMeta(response.file_name, {
          brief: brief.slice(0, 500),
          created: Date.now() / 1000,
        });
        setMetaVersion((v) => v + 1);
        await openResult(response.file_name);
      }

      // Reset the session for the next brief
      setPendingBrief("");
      setQuestions([]);
      setAnswers({});
    } catch (err) {
      if (err.status === 401) { window.location.href = "/login"; return; }
      setError(err.message || "Generation failed");
      setActivity((a) => [
        ...a,
        { role: "studio", author: "mawg", text: `Error: ${err.message}`, error: true, at: new Date() },
      ]);
      setStatus("error");
    } finally {
      setPhase("idle");
    }
  };

  const cancelAnswers = () => {
    setQuestions([]);
    setAnswers({});
    setPendingBrief("");
    setPhase("idle");
    setStatus("ready");
    setActivity((a) => [
      ...a,
      { role: "system", text: "Discarded. Send a new brief when you're ready.", at: new Date() },
    ]);
  };

  // All questions are multi-select in the UI — clicking toggles an option in/out.
  const pickAnswer = (key, value) => {
    setAnswers((prev) => {
      const cur = Array.isArray(prev[key]) ? prev[key] : prev[key] ? [prev[key]] : [];
      return {
        ...prev,
        [key]: cur.includes(value) ? cur.filter((v) => v !== value) : [...cur, value],
      };
    });
  };

  // Auto-pick answers for ONE question. Picks 2 random options for AI-flagged
  // multi questions (e.g. "sections"), 1 random for everything else.
  const autoPickOne = (q) => {
    const count = q.multi ? Math.min(2, q.options.length) : 1;
    const shuffled = [...q.options].sort(() => Math.random() - 0.5);
    setAnswers((prev) => ({ ...prev, [q.key]: shuffled.slice(0, count) }));
  };

  const copySource = async () => {
    if (!source) return;
    try {
      await navigator.clipboard.writeText(source);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
      toast.success("Source copied to clipboard");
    } catch (err) {
      setSourceInfo(`copy failed: ${err.message}`);
      toast.error(`Copy failed: ${err.message}`);
    }
  };

  // Build a memoized meta map for the drafts panel
  const metaMap = useMemo(() => {
    const map = {};
    for (const f of files) {
      const m = getMeta(f.file_name);
      if (m) map[f.file_name] = m;
    }
    return map;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [files, metaVersion]);

  const deleteDraft = async (fileName) => {
    try {
      await api.deleteResult(fileName);
      removeMeta(fileName);
      if (current === fileName) {
        setCurrent(null);
        setSource("");
        setSourceInfo("");
      }
      await loadResults();
      toast.success(`Deleted ${fileName}`);
    } catch (err) {
      toast.error(`Delete failed: ${err.message}`);
    }
  };

  const renameDraft = (fileName, newLabel) => {
    setMeta(fileName, { label: newLabel });
    setMetaVersion((v) => v + 1);
    toast.success(`Renamed to "${newLabel}"`);
  };

  const newDraft = () => {
    // Reset the brief flow without touching any server state
    setActivity([
      { role: "system", text: "Describe the page you want to build. I'll ask a few quick design questions first." },
    ]);
    setPendingBrief("");
    setQuestions([]);
    setAnswers({});
    setPrompt("");
    setPhase("idle");
    setStatus("ready");
    setError("");
    setSideTab("brief");
    setMobileView("brief");
    toast("Started a new brief");
  };

  const downloadSource = () => {
    if (!source || !current) return;
    const blob = new Blob([source], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = current;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success(`Downloaded ${current}`);
  };

  const doLogout = async () => { await logout(); window.location.href = "/login"; };

  const onKeyDown = (e) => {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      analyze();
    }
  };

  const deviceCfg = useMemo(() => DEVICES.find((d) => d.id === device), [device]);
  const currentIndex = useMemo(
    () => (current ? files.findIndex((f) => f.file_name === current) : -1),
    [current, files]
  );
  const currentDraftNumber = currentIndex >= 0 ? files.length - currentIndex : null;

  const mvClass = (v) => (mobileView === v ? "flex" : "hidden") + " md:flex";

  // ---------- Render ----------

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-bg">
      {/* ========== Top bar ========== */}
      <header className="h-12 shrink-0 border-b border-line flex items-center px-3 gap-2 sm:gap-3 bg-bg">
        <div className="flex items-center gap-2 min-w-0">
          <span className="h-6 w-6 rounded-md bg-accent/15 border border-accent/30 grid place-items-center">
            <span className="h-1.5 w-1.5 rounded-full bg-accent" />
          </span>
          <span className="font-display font-semibold text-[14px] tracking-tight text-ink">MAWG</span>
          <Slash className="h-3 w-3 text-ink-faint hidden sm:inline-block" />
          <span className="text-[13px] text-ink-muted truncate max-w-[140px] sm:max-w-[200px] font-mono hidden sm:inline">
            {current || "new draft"}
          </span>
          {currentDraftNumber && (
            <span className="meta text-ink-subtle ml-1 hidden sm:inline">
              {String(currentDraftNumber).padStart(2, "0")}/{String(files.length).padStart(2, "0")}
            </span>
          )}
        </div>

        <div className="ml-auto flex items-center gap-1.5 sm:gap-2">
          <StatusChip status={status} busy={busy} phase={phase} />
          <span className="hidden lg:block h-5 w-px bg-line-strong mx-1" />
          <div className="hidden lg:flex items-center gap-2 pr-1">
            <span className="h-6 w-6 rounded-full bg-accent-soft border border-accent/30 grid place-items-center text-[11px] font-semibold text-accent-ink">
              {user?.username?.[0]?.toUpperCase() || "U"}
            </span>
            <span className="text-[12.5px] text-ink">{user?.username}</span>
          </div>
          <button
            onClick={() => setPaletteOpen(true)}
            className="hidden md:inline-flex items-center gap-1.5 h-8 px-2.5 rounded-md text-[12px] font-medium bg-bg-raised hover:bg-bg-hover border border-line-strong text-ink-muted hover:text-ink transition-colors focus:outline-none focus-visible:shadow-focus"
            title="Command palette (⌘/Ctrl + K)"
          >
            <Search className="h-3.5 w-3.5" />
            <span className="hidden lg:inline">Search</span>
            <kbd className="hidden lg:inline-flex items-center px-1.5 text-[10px] font-mono text-ink-subtle bg-bg border border-line rounded">⌘K</kbd>
          </button>
          <button
            onClick={newDraft}
            className="hidden md:inline-flex items-center justify-center gap-1.5 h-8 w-8 lg:w-auto lg:px-2.5 rounded-md text-[12px] font-medium text-ink-muted hover:text-ink hover:bg-bg-raised transition-colors"
            title="New brief"
          >
            <Plus className="h-3.5 w-3.5" />
            <span className="hidden lg:inline">New</span>
          </button>
          <div className="hidden md:inline-flex items-center gap-0.5 rounded-md border border-line bg-bg-raised/40 p-0.5">
            <button
              onClick={toggleBrief}
              className={`flex items-center justify-center h-7 w-7 rounded text-ink-muted hover:text-ink hover:bg-bg-raised transition-colors ${briefCollapsed ? "" : "text-ink bg-bg-raised"}`}
              title="Toggle Brief panel (⌘/Ctrl + B)"
            >
              <PanelLeft className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={toggleSource}
              className={`flex items-center justify-center h-7 w-7 rounded text-ink-muted hover:text-ink hover:bg-bg-raised transition-colors ${sourceCollapsed ? "" : "text-ink bg-bg-raised"}`}
              title="Toggle Source panel (⌘/Ctrl + \\)"
            >
              <PanelRight className="h-3.5 w-3.5" />
            </button>
          </div>
          <button
            onClick={() => setShortcutsOpen(true)}
            className="hidden md:inline-flex items-center justify-center h-8 w-8 rounded-md text-ink-muted hover:text-ink hover:bg-bg-raised transition-colors"
            title="Keyboard shortcuts (?)"
          >
            <Keyboard className="h-4 w-4" />
          </button>
          <button
            onClick={doLogout}
            className="inline-flex items-center justify-center gap-1.5 h-8 px-2 md:px-2.5 rounded-md text-[12px] font-medium text-ink-muted hover:text-ink hover:bg-bg-raised transition-colors"
            title="Sign out"
          >
            <LogOut className="h-3.5 w-3.5" />
            <span className="hidden lg:inline">Sign out</span>
          </button>
        </div>
      </header>

      {/* ========== Body ========== */}
      <div className="flex-1 min-h-0 relative">
        {/* Extract panel content so mobile & desktop layouts can share it */}
        {(() => {
          const briefSidebarContent = (
            <>
              <div className="h-10 shrink-0 px-2 flex items-center gap-1 border-b border-line">
                <button
                  onClick={() => { setSideTab("brief"); setMobileView("brief"); }}
                  className={sideTab === "brief" ? "tab-active" : "tab"}
                >
                  <MessageSquare className="h-3.5 w-3.5 inline mr-1 -mt-0.5" />
                  Brief
                </button>
                <button
                  onClick={() => { setSideTab("drafts"); setMobileView("drafts"); }}
                  className={sideTab === "drafts" ? "tab-active" : "tab"}
                >
                  <Layers className="h-3.5 w-3.5 inline mr-1 -mt-0.5" />
                  Drafts
                  <span className="ml-1.5 text-ink-faint font-mono text-[11px]">{files.length}</span>
                </button>
              </div>

              {sideTab === "brief" ? (
                <BriefPanel
                  activity={activity}
                  feedRef={feedRef}
                  prompt={prompt}
                  setPrompt={setPrompt}
                  onSend={analyze}
                  onKeyDown={onKeyDown}
                  busy={busy}
                  phase={phase}
                  error={error}
                  showSuggestions={activity.length <= 1 && phase === "idle"}
                  questions={questions}
                  answers={answers}
                  onPick={pickAnswer}
                  onAutoPick={autoPickOne}
                  onBuild={() => build()}
                  onCancel={cancelAnswers}
                />
              ) : (
                <DraftsPanel
                  files={files}
                  current={current}
                  onPick={openResult}
                  onRefresh={loadResults}
                  onDelete={deleteDraft}
                  onRename={renameDraft}
                  metaMap={metaMap}
                />
              )}
            </>
          );

          const canvasContent = (
            <>
              <div className="h-10 px-4 flex items-center justify-between border-b border-line shrink-0">
                <div className="flex items-center gap-2 text-[12px] text-ink-muted min-w-0">
                  <Eye className="h-3.5 w-3.5 text-ink-subtle shrink-0" />
                  <span className="shrink-0">Preview</span>
                  {current && (
                    <>
                      <span className="text-ink-faint">·</span>
                      <span className="font-mono text-[11.5px] text-ink-subtle truncate">{current}</span>
                    </>
                  )}
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {current && (
                    <>
                      <select
                        value={zoom}
                        onChange={(e) => {
                          const v = e.target.value;
                          setZoom(v === "fit" ? "fit" : Number(v));
                        }}
                        className="h-7 bg-bg-raised border border-line-strong text-ink-muted hover:text-ink text-[11.5px] rounded-md px-2 font-mono focus:outline-none focus:border-accent transition-colors"
                        title="Zoom"
                      >
                        <option value="fit">Fit</option>
                        <option value="0.5">50%</option>
                        <option value="0.75">75%</option>
                        <option value="1">100%</option>
                      </select>
                      <button
                        onClick={() => setShowGrid((v) => !v)}
                        className={`btn-icon ${showGrid ? "!text-accent bg-bg-raised" : ""}`}
                        title="Toggle grid overlay"
                      >
                        <Grid className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => setPreviewKey((k) => k + 1)}
                        className="btn-icon"
                        title="Reload preview"
                      >
                        <RefreshCw className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => setFullscreen((v) => !v)}
                        className="btn-icon"
                        title={fullscreen ? "Exit fullscreen" : "Fullscreen"}
                      >
                        {fullscreen ? <Minimize className="h-3.5 w-3.5" /> : <Maximize className="h-3.5 w-3.5" />}
                      </button>
                      <a
                        href={`/result/${encodeURIComponent(current)}`}
                        target="_blank" rel="noreferrer"
                        className="btn-icon" title="Open in new tab"
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    </>
                  )}
                </div>
              </div>

              <div className="flex-1 min-h-0 overflow-auto p-4 sm:p-6 md:p-8 flex items-start justify-center">
                {current ? (
                  <div className="flex flex-col items-center gap-2 w-full">
                    <div className="flex items-center gap-2 text-[11px] font-mono text-ink-subtle">
                      <span>▸</span>
                      <span className="text-ink-muted">{deviceCfg.label}</span>
                      <span className="text-ink-faint">{deviceCfg.width}</span>
                      {zoom !== "fit" && (
                        <span className="text-ink-faint">· {Math.round(zoom * 100)}%</span>
                      )}
                    </div>
                    <div
                      className="canvas-frame overflow-hidden relative"
                      style={{
                        width: zoom === "fit" ? "100%" : `${deviceCfg.width * zoom}px`,
                        maxWidth: zoom === "fit" ? `${deviceCfg.width}px` : "none",
                      }}
                    >
                      <iframe
                        ref={iframeRef}
                        key={previewKey}
                        src={`/result/${encodeURIComponent(current)}`}
                        title="Preview"
                        className="w-full border-0 block bg-white"
                        style={{ height: device === "desktop" ? 900 : device === "tablet" ? 1100 : 780 }}
                      />
                      {showGrid && <GridOverlay />}
                    </div>
                  </div>
                ) : (
                  <EmptyCanvas busy={busy} phase={phase} />
                )}
              </div>

              <div className="h-12 shrink-0 hidden md:flex items-center justify-center border-t border-line bg-bg-elev">
                <div className="flex items-center gap-1 bg-bg-raised border border-line-strong rounded-lg p-1">
                  {DEVICES.map((d) => (
                    <button
                      key={d.id}
                      onClick={() => setDevice(d.id)}
                      className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[12px] transition-colors ${
                        device === d.id ? "bg-bg-hover text-ink" : "text-ink-muted hover:text-ink"
                      }`}
                    >
                      <d.icon className="h-3.5 w-3.5" />
                      <span className="hidden sm:inline">{d.label}</span>
                      <span className="font-mono text-[10.5px] text-ink-subtle">{d.width}</span>
                    </button>
                  ))}
                </div>
              </div>
            </>
          );

          const sourceContent = (
            <>
              <div className="h-10 px-3 flex items-center justify-between border-b border-line shrink-0">
                <div className="flex items-center gap-2 text-[12px] text-ink-muted">
                  <Code className="h-3.5 w-3.5 text-ink-subtle" />
                  <span>Source</span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="meta text-ink-subtle truncate max-w-[120px] sm:max-w-[160px]">
                    {sourceInfo || "—"}
                  </span>
                  <button
                    onClick={downloadSource}
                    disabled={!source || !current}
                    className="btn-icon"
                    title="Download .html"
                  >
                    <Download className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={copySource}
                    disabled={!source}
                    className="btn-icon"
                    title={copied ? "Copied" : "Copy source"}
                  >
                    {copied ? <Check className="h-3.5 w-3.5 text-success" /> : <Copy className="h-3.5 w-3.5" />}
                  </button>
                </div>
              </div>
              <div className="flex-1 min-h-0 overflow-auto bg-[#1b1d24]">
                {source ? (
                  <SourceView source={source} />
                ) : (
                  <div className="p-4 text-[12px] text-ink-faint font-mono">
                    Select a draft to view its HTML source.
                  </div>
                )}
              </div>
            </>
          );

          return (
            <>
              {/* ---------- Mobile layout (stacked, one panel at a time) ---------- */}
              <div className="md:hidden h-full flex flex-col">
                <aside
                  className={`${mvClass(mobileView === "drafts" ? "drafts" : "brief")}
                    w-full border-b border-line bg-bg-elev/30 flex-col min-h-0 flex-1`}
                >
                  {briefSidebarContent}
                </aside>
                <main
                  className={
                    fullscreen
                      ? "fixed inset-0 z-50 bg-bg flex flex-col"
                      : `${mvClass("preview")} flex-1 min-w-0 flex-col bg-bg-elev/40 min-h-0`
                  }
                >
                  {canvasContent}
                </main>
                <aside
                  className={`${mvClass("source")}
                    w-full border-t border-line bg-bg-elev/30 flex-col min-h-0 flex-1`}
                >
                  {sourceContent}
                </aside>
              </div>

              {/* ---------- Desktop layout (resizable + collapsible panels) ---------- */}
              <PanelGroup
                direction="horizontal"
                autoSaveId="mawg-layout-v1"
                className="hidden md:flex h-full"
              >
                <Panel
                  ref={briefPanelRef}
                  id="brief"
                  order={1}
                  defaultSize={22}
                  minSize={15}
                  maxSize={40}
                  collapsible
                  collapsedSize={0}
                  onCollapse={() => setBriefCollapsed(true)}
                  onExpand={() => setBriefCollapsed(false)}
                  className="bg-bg-elev/30"
                >
                  <div className="h-full flex flex-col min-h-0 border-r border-line">
                    {briefSidebarContent}
                  </div>
                </Panel>

                <PanelResizeHandle className="relative w-px bg-line data-[resize-handle-state=hover]:bg-accent data-[resize-handle-state=drag]:bg-accent transition-colors group">
                  <span className="absolute inset-y-0 -left-1 -right-1" />
                </PanelResizeHandle>

                <Panel id="canvas" order={2} defaultSize={50} minSize={25} className="bg-bg-elev/40">
                  <main
                    className={
                      fullscreen
                        ? "fixed inset-0 z-50 bg-bg flex flex-col"
                        : "h-full flex flex-col min-h-0"
                    }
                  >
                    {canvasContent}
                  </main>
                </Panel>

                <PanelResizeHandle className="relative w-px bg-line data-[resize-handle-state=hover]:bg-accent data-[resize-handle-state=drag]:bg-accent transition-colors group">
                  <span className="absolute inset-y-0 -left-1 -right-1" />
                </PanelResizeHandle>

                <Panel
                  ref={sourcePanelRef}
                  id="source"
                  order={3}
                  defaultSize={28}
                  minSize={18}
                  maxSize={55}
                  collapsible
                  collapsedSize={0}
                  onCollapse={() => setSourceCollapsed(true)}
                  onExpand={() => setSourceCollapsed(false)}
                  className="bg-bg-elev/30"
                >
                  <div className="h-full flex flex-col min-h-0 border-l border-line">
                    {sourceContent}
                  </div>
                </Panel>
              </PanelGroup>
            </>
          );
        })()}
      </div>

      {/* ========== Mobile bottom tab bar ========== */}
      <nav className="md:hidden shrink-0 border-t border-line bg-bg-elev h-14 flex items-stretch">
        {MOBILE_TABS.map((t) => {
          const active = mobileView === t.id || (mobileView === "drafts" && t.id === "drafts");
          return (
            <button
              key={t.id}
              onClick={() => {
                setMobileView(t.id);
                if (t.id === "brief") setSideTab("brief");
                if (t.id === "drafts") setSideTab("drafts");
              }}
              className={`flex-1 flex flex-col items-center justify-center gap-0.5 text-[10px] transition-colors ${
                active ? "text-accent" : "text-ink-muted"
              }`}
            >
              <t.icon className="h-4 w-4" />
              {t.label}
            </button>
          );
        })}
      </nav>

      <CommandPalette
        open={paletteOpen}
        onOpenChange={setPaletteOpen}
        files={files}
        metaMap={metaMap}
        onPickDraft={openResult}
        onDeleteDraft={deleteDraft}
        actions={[
          { id: "new",          label: "New brief",            hint: "Reset chat",        run: newDraft,                          icon: <Plus className="h-3.5 w-3.5 text-accent" /> },
          { id: "toggle-brief", label: "Toggle Brief panel",   hint: "⌘B",                 run: toggleBrief,                       icon: <PanelLeft className="h-3.5 w-3.5 text-ink-subtle" /> },
          { id: "toggle-src",   label: "Toggle Source panel",  hint: "⌘\\",                run: toggleSource,                      icon: <PanelRight className="h-3.5 w-3.5 text-ink-subtle" /> },
          { id: "reload",       label: "Reload preview",       hint: "",                  run: () => setPreviewKey((k) => k + 1),  icon: <RefreshCw className="h-3.5 w-3.5 text-ink-subtle" /> },
          { id: "fullscreen", label: "Toggle fullscreen",   hint: "Esc to exit",        run: () => setFullscreen((v) => !v),  icon: <Maximize className="h-3.5 w-3.5 text-ink-subtle" /> },
          { id: "shortcuts", label: "Keyboard shortcuts",  hint: "?",                 run: () => setShortcutsOpen(true),     icon: <Keyboard className="h-3.5 w-3.5 text-ink-subtle" /> },
          { id: "logout",    label: "Sign out",            hint: "",                  run: doLogout,                         icon: <LogOut className="h-3.5 w-3.5 text-ink-subtle" /> },
        ]}
      />
      <ShortcutsOverlay open={shortcutsOpen} onClose={() => setShortcutsOpen(false)} />
    </div>
  );
}

/* ======== Subcomponents ======== */

function BriefPanel({
  activity, feedRef, prompt, setPrompt, onSend, onKeyDown,
  busy, phase, error, showSuggestions,
  questions, answers, onPick, onAutoPick, onBuild, onCancel,
}) {
  const showQuestionBlock = phase === "answering" || phase === "building";

  return (
    <>
      <div ref={feedRef} className="flex-1 overflow-y-auto p-3">
        {activity.map((a, i) => (
          <ActivityRow
            key={i}
            item={a}
            questions={questions}
            answers={answers}
            onPick={onPick}
            onAutoPick={onAutoPick}
            onBuild={onBuild}
            onCancel={onCancel}
            phase={phase}
            interactive={showQuestionBlock && i === activity.map(x => x.kind).lastIndexOf("questions")}
          />
        ))}
        {phase === "analyzing" && <TypingIndicator label="analyzing brief" />}
        {phase === "building"  && <TypingIndicator label="building page" />}
      </div>

      {showSuggestions && (
        <div className="px-3 pb-2 flex flex-col gap-1.5 shrink-0">
          {SUGGESTIONS.map((s, i) => (
            <button
              key={i}
              onClick={() => onSend(s)}
              className="text-left text-[12px] text-ink-muted hover:text-ink bg-bg-raised/50 hover:bg-bg-raised border border-line rounded-md px-2.5 py-1.5 transition-colors truncate"
              title={s}
            >
              <span className="text-accent mr-1.5">↗</span>
              {s}
            </button>
          ))}
        </div>
      )}

      <div className="shrink-0 border-t border-line p-2.5 bg-bg-elev/60">
        {error && (
          <div className="flex items-start gap-1.5 text-[11px] text-danger bg-danger-soft border border-danger/30 rounded-md px-2 py-1.5 mb-2">
            <AlertCircle className="h-3 w-3 mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder={busy ? "Please wait…" : "Describe what you want to build…"}
          className="input min-h-[80px] max-h-48 resize-none text-[13px] leading-relaxed"
          disabled={busy || phase === "answering"}
        />

        <div className="mt-2 flex items-center justify-between">
          <span className="meta text-ink-faint hidden sm:inline">⌘/Ctrl + ⏎ to send</span>
          <div className="flex items-center gap-2 ml-auto">
            {phase === "answering" ? (
              <span className="text-[11px] text-ink-subtle">Answer below, then Build ▸</span>
            ) : (
              <button
                onClick={() => onSend()}
                disabled={busy || phase === "answering" || !prompt.trim()}
                className="btn-primary"
                title="Analyze brief"
              >
                <Send className="h-3.5 w-3.5" />
                Send
              </button>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

function DraftsPanel({ files, current, onPick, onRefresh, onDelete, onRename, metaMap }) {
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState(null); // file_name being renamed
  const [editValue, setEditValue] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return files;
    return files.filter((f) => {
      const m = metaMap[f.file_name] || {};
      return (
        f.file_name.toLowerCase().includes(q) ||
        (m.label || "").toLowerCase().includes(q) ||
        (m.brief || "").toLowerCase().includes(q)
      );
    });
  }, [files, query, metaMap]);

  const groups = useMemo(() => groupByDate(filtered), [filtered]);

  const beginRename = (fileName) => {
    const m = metaMap[fileName] || {};
    setEditing(fileName);
    setEditValue(m.label || fileName.replace(/\.html$/, ""));
  };
  const commitRename = () => {
    if (editing) onRename(editing, editValue.trim() || editing);
    setEditing(null);
  };

  return (
    <>
      <div className="h-9 px-2 flex items-center gap-1 border-b border-line shrink-0">
        <div className="relative flex-1">
          <Search className="h-3 w-3 text-ink-faint absolute left-2 top-1/2 -translate-y-1/2" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search drafts…"
            className="w-full bg-transparent border-0 pl-6 pr-2 py-1 text-[12px] text-ink placeholder:text-ink-faint focus:outline-none"
          />
        </div>
        <span className="meta text-ink-subtle shrink-0 pr-1">{filtered.length}</span>
        <button onClick={onRefresh} className="btn-icon" title="Refresh">
          <RefreshCw className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-1.5">
        {files.length === 0 ? (
          <div className="text-[12.5px] text-ink-subtle px-3 py-10 text-center">
            <FileIcon className="h-5 w-5 mx-auto mb-2 text-ink-faint" />
            No drafts yet.
            <div className="meta text-ink-faint mt-1">Send a brief to create one</div>
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-[12.5px] text-ink-subtle px-3 py-8 text-center">
            No matches for &ldquo;{query}&rdquo;
          </div>
        ) : (
          groups.map((g) => (
            <div key={g.label} className="mb-2 last:mb-0">
              <div className="meta text-ink-faint px-2 py-1">{g.label}</div>
              {g.items.map((f) => {
                const active = current === f.file_name;
                const m = metaMap[f.file_name] || {};
                const display = m.label || f.file_name;
                const isEditing = editing === f.file_name;
                return (
                  <div
                    key={f.file_name}
                    className={`group flex items-center gap-1 rounded-md border text-[13px] transition-colors ${
                      active
                        ? "bg-bg-raised border-accent/30 text-ink"
                        : "border-transparent hover:bg-bg-raised hover:border-line text-ink-muted"
                    }`}
                    title={m.brief ? `Brief: ${m.brief}` : f.file_name}
                  >
                    {isEditing ? (
                      <input
                        autoFocus
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        onBlur={commitRename}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") commitRename();
                          if (e.key === "Escape") setEditing(null);
                        }}
                        className="flex-1 min-w-0 bg-bg border border-accent/40 rounded px-2 py-1 text-[12.5px] text-ink focus:outline-none m-1"
                      />
                    ) : (
                      <button
                        onClick={() => onPick(f.file_name)}
                        onDoubleClick={() => beginRename(f.file_name)}
                        className="flex-1 min-w-0 text-left px-2 py-1.5 flex items-center gap-2"
                      >
                        <FileIcon
                          className={`h-3.5 w-3.5 shrink-0 ${active ? "text-accent" : "text-ink-subtle"}`}
                        />
                        <span className="truncate">{display}</span>
                      </button>
                    )}

                    {!isEditing && (
                      <div className="flex items-center pr-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => beginRename(f.file_name)}
                          className="btn-icon !h-6 !w-6"
                          title="Rename (double-click row)"
                        >
                          <Edit className="h-3 w-3" />
                        </button>
                        <button
                          onClick={() => {
                            if (window.confirm(`Delete "${display}"? This cannot be undone.`)) {
                              onDelete(f.file_name);
                            }
                          }}
                          className="btn-icon !h-6 !w-6 hover:!text-danger"
                          title="Delete draft"
                        >
                          <Trash className="h-3 w-3" />
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ))
        )}
      </div>
    </>
  );
}

function groupByDate(files) {
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime() / 1000;
  const startOfYesterday = startOfToday - 86400;
  const startOfWeek = startOfToday - 6 * 86400;

  const buckets = { Today: [], Yesterday: [], "This week": [], Older: [] };
  for (const f of files) {
    const mt = f.mtime || 0;
    if (mt >= startOfToday)      buckets.Today.push(f);
    else if (mt >= startOfYesterday) buckets.Yesterday.push(f);
    else if (mt >= startOfWeek)  buckets["This week"].push(f);
    else                         buckets.Older.push(f);
  }
  return ["Today", "Yesterday", "This week", "Older"]
    .filter((k) => buckets[k].length)
    .map((label) => ({ label, items: buckets[label] }));
}

function ActivityRow({ item, questions, answers, onPick, onAutoPick, onBuild, onCancel, phase, interactive }) {
  if (item.role === "system") {
    return <div className="px-2 py-1.5 text-[12.5px] text-ink-subtle italic">{item.text}</div>;
  }

  const isUser = item.role === "user";
  const letter = (item.author || "?")[0].toUpperCase();

  return (
    <div className="py-2 px-2 hover:bg-bg-raised/30 rounded-md transition-colors">
      <div className="flex items-center gap-2 mb-1">
        <span
          className={`h-5 w-5 rounded-full grid place-items-center text-[10px] font-semibold ${
            isUser
              ? "bg-accent-soft border border-accent/30 text-accent-ink"
              : "bg-bg-raised border border-line-strong text-ink-muted"
          }`}
        >
          {isUser ? letter : "◆"}
        </span>
        <span className="text-[12.5px] text-ink font-medium">
          {isUser ? item.author : "studio"}
        </span>
        <span className="meta text-ink-faint">{formatTime(item.at)}</span>
      </div>

      <div className={`pl-7 text-[13px] leading-relaxed whitespace-pre-wrap break-words ${item.error ? "text-danger" : "text-ink"}`}>
        {item.text}
      </div>

      {/* Inline questions block */}
      {item.kind === "questions" && interactive && (
        <div className="pl-7 mt-3 space-y-3.5">
          {questions.map((q) => (
            <QuestionGroup
              key={q.key}
              q={q}
              value={answers[q.key]}
              onPick={onPick}
              onAutoPick={onAutoPick}
              disabled={phase === "building"}
            />
          ))}

          <div className="flex flex-wrap items-center gap-1.5 pt-1">
            <button
              onClick={onBuild}
              disabled={phase === "building"}
              className="btn-primary !px-3 !py-1.5 !text-[12.5px] whitespace-nowrap"
            >
              <Send className="h-3 w-3" />
              Build
            </button>
            <button
              onClick={() => questions.forEach(onAutoPick)}
              disabled={phase === "building"}
              className="btn-ghost !px-2.5 !py-1.5 !text-[12px] whitespace-nowrap"
              title="Randomly pick answers for every question"
            >
              Decide all
            </button>
            <button
              onClick={onCancel}
              disabled={phase === "building"}
              className="btn-ghost !px-2.5 !py-1.5 !text-[12px] whitespace-nowrap"
            >
              Discard
            </button>
          </div>
        </div>
      )}

      {item.debug && (
        <div className="pl-7 mt-1.5">
          <details className="text-[11px] text-ink-muted">
            <summary className="cursor-pointer hover:text-ink meta">pipeline log</summary>
            <pre className="mt-1 font-mono whitespace-pre-wrap text-[10.5px] text-ink-subtle bg-bg-raised/40 border border-line rounded p-2">
              {item.debug}
            </pre>
          </details>
        </div>
      )}
      {item.file && <div className="pl-7 mt-1 meta text-ink-subtle">→ {item.file}</div>}
    </div>
  );
}

function QuestionGroup({ q, value, onPick, onAutoPick, disabled }) {
  // All questions are multi-select in the UI. Normalize value to an array.
  const selected = Array.isArray(value) ? value : value ? [value] : [];
  const isSelected = (opt) => selected.includes(opt);

  return (
    <div>
      <div className="meta text-ink-muted mb-2">
        {q.question}
        <span className="ml-1.5 text-ink-subtle normal-case tracking-normal">
          — pick one or more
        </span>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {q.options.map((opt) => {
          const sel = isSelected(opt);
          return (
            <button
              key={opt}
              onClick={() => onPick(q.key, opt)}
              disabled={disabled}
              className={`px-3 py-1 rounded-full text-[12px] font-medium border transition-colors ${
                sel
                  ? "bg-accent text-bg border-accent"
                  : "bg-bg-raised border-line-strong text-ink-muted hover:text-ink hover:border-accent/50"
              } disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              {opt}
            </button>
          );
        })}
        {/* Decide-for-me pill — dashed border marks it as an action, not an option */}
        <button
          onClick={() => onAutoPick(q)}
          disabled={disabled}
          className="px-3 py-1 rounded-full text-[12px] font-medium border border-dashed border-line-strong text-ink-subtle hover:text-accent hover:border-accent/60 transition-colors disabled:opacity-40 disabled:cursor-not-allowed inline-flex items-center gap-1"
          title="Randomly pick for this question"
        >
          <Sparkles className="h-3 w-3" />
          Decide for me
        </button>
      </div>
    </div>
  );
}

function TypingIndicator({ label = "thinking" }) {
  return (
    <div className="flex items-center gap-1.5 py-2 pl-8 text-[12px] text-ink-muted">
      <span className="h-1.5 w-1.5 rounded-full bg-accent animate-pulse" />
      <span className="h-1.5 w-1.5 rounded-full bg-accent animate-pulse [animation-delay:150ms]" />
      <span className="h-1.5 w-1.5 rounded-full bg-accent animate-pulse [animation-delay:300ms]" />
      <span className="ml-1 meta">{label}</span>
    </div>
  );
}

function StatusChip({ status, busy, phase }) {
  const dot =
    phase === "analyzing" || phase === "building"
      ? "bg-accent animate-pulse"
      : status === "error"
      ? "bg-danger"
      : phase === "answering"
      ? "bg-warning"
      : "bg-success";
  return (
    <span className="chip">
      <span className={`h-1.5 w-1.5 rounded-full ${dot}`} />
      <span className="font-mono hidden sm:inline">{status}</span>
    </span>
  );
}

function GridOverlay() {
  // 12-column baseline grid, subtle, pointer-events: none so it doesn't block clicks
  return (
    <div
      className="absolute inset-0 pointer-events-none"
      style={{
        backgroundImage:
          "linear-gradient(to right, rgba(226,118,68,0.15) 1px, transparent 1px)",
        backgroundSize: `${100 / 12}% 100%`,
      }}
    >
      <div
        className="absolute inset-0"
        style={{
          backgroundImage:
            "linear-gradient(to bottom, rgba(226,118,68,0.07) 1px, transparent 1px)",
          backgroundSize: "100% 8px",
        }}
      />
    </div>
  );
}

function EmptyCanvas({ busy, phase }) {
  const title =
    phase === "analyzing" ? "Analyzing your brief…" :
    phase === "building"  ? "Your draft is being composed…" :
    "Ready when you are";
  return (
    <div className="h-full w-full grid place-items-center text-center">
      <div className="max-w-md px-6">
        <div className="h-20 w-32 sm:h-24 sm:w-40 mx-auto mb-5 rounded-sm border-2 border-dashed border-line-strong bg-bg-raised/30 grid place-items-center">
          <Eye className="h-5 w-5 text-ink-faint" />
        </div>
        <div className="meta text-accent mb-2">── No draft selected</div>
        <h3 className="font-display text-[20px] sm:text-[22px] text-ink tracking-tight">{title}</h3>
        <p className="mt-2 text-[13px] sm:text-[13.5px] text-ink-muted leading-relaxed">
          Send a brief on the left, or pick an existing draft to preview it here.
        </p>
      </div>
    </div>
  );
}

/* ======== Utils ======== */

function formatBytes(n) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(2)} MB`;
}

function formatTime(at) {
  if (!at) return "";
  const now = new Date();
  const d = new Date(at);
  const diff = Math.floor((now - d) / 1000);
  if (diff < 5) return "just now";
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}
