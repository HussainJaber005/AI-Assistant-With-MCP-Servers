// LocalStorage-backed friendly names + original briefs for generated files.
// Backend only knows file names; friendly metadata lives client-side.

const KEY = "mawg:draft-meta:v1";

function readAll() {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function writeAll(data) {
  try {
    localStorage.setItem(KEY, JSON.stringify(data));
  } catch {
    /* quota full — drop silently */
  }
}

export function getMeta(fileName) {
  return readAll()[fileName] || null;
}

export function setMeta(fileName, patch) {
  const all = readAll();
  all[fileName] = { ...(all[fileName] || {}), ...patch };
  writeAll(all);
}

export function removeMeta(fileName) {
  const all = readAll();
  delete all[fileName];
  writeAll(all);
}
