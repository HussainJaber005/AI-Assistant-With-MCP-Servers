import { useEffect } from "react";

const GROUPS = [
  {
    label: "Navigate",
    items: [
      ["⌘ / Ctrl + K",  "Open command palette"],
      ["?",              "Show this shortcuts panel"],
      ["Esc",            "Close palette / exit fullscreen"],
    ],
  },
  {
    label: "Panels",
    items: [
      ["⌘ / Ctrl + B",   "Toggle Brief panel"],
      ["⌘ / Ctrl + \\",  "Toggle Source panel"],
      ["Drag divider",   "Resize panels"],
    ],
  },
  {
    label: "Brief",
    items: [
      ["⌘ / Ctrl + ⏎",  "Send brief"],
      ["Click a pill",   "Toggle selection"],
    ],
  },
  {
    label: "Drafts",
    items: [
      ["Double-click",   "Rename inline"],
      ["Hover",          "Show edit / delete actions"],
    ],
  },
];

export function ShortcutsOverlay({ open, onClose }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[55] flex items-center justify-center px-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/55 backdrop-blur-sm" />
      <div
        className="relative w-full max-w-md bg-bg-elev border border-line-strong rounded-xl shadow-canvas"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-4 py-3 border-b border-line flex items-center justify-between">
          <h3 className="font-display font-semibold text-[15px] text-ink">Keyboard shortcuts</h3>
          <button onClick={onClose} className="btn-ghost text-[11px]">Esc</button>
        </div>

        <div className="p-4 space-y-5">
          {GROUPS.map((g) => (
            <div key={g.label}>
              <div className="meta text-ink-muted mb-2">{g.label}</div>
              <div className="space-y-1.5">
                {g.items.map(([keys, desc]) => (
                  <div key={keys} className="flex items-center justify-between text-[13px]">
                    <span className="text-ink">{desc}</span>
                    <kbd className="chip font-mono">{keys}</kbd>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
