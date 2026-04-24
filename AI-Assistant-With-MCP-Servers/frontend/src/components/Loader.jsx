export function Loader({ fullscreen = false, label = "" }) {
  const Spinner = (
    <div className="flex items-center gap-3 text-ink-muted text-sm">
      <span className="h-4 w-4 rounded-full border-2 border-line-strong border-t-accent animate-spin" />
      <span className="meta">{label}</span>
    </div>
  );

  if (!fullscreen) return Spinner;

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-bg">
      {Spinner}
    </div>
  );
}
