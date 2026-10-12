const KEY = "yakton-notes-v1", $ = s => document.querySelector(s), ed = $("#editor");
const TPL = (document.body.dataset.template || "").replace("@DATE@", new Date().toDateString());
const ALLOWED = new Set(["B","I","U","STRONG","EM","H1","H2","UL","OL","LI","DIV","P","BR","SPAN"]);
function clean(html) { // whitelist sanitizer: stored notes and backup files are untrusted input
  const doc = new DOMParser().parseFromString(`<body>${html}`, "text/html");
  (function walk(n) { [...n.childNodes].forEach(c => { if (c.nodeType === 1) { if (!ALLOWED.has(c.tagName)) { c.remove(); return; } [...c.attributes].forEach(a => c.removeAttribute(a.name)); walk(c); } else if (c.nodeType !== 3) c.remove(); }); })(doc.body);
  return doc.body.innerHTML;
}
let state = { notes: [], cur: null };
try { const s = JSON.parse(localStorage.getItem(KEY)); if (s?.notes) state = s; } catch {}
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(state)); $("#saved").textContent = "Saved"; } catch { $("#saved").textContent = "⚠ Could not save (storage full or blocked)"; } };
const text = html => { const d = document.createElement("div"); d.innerHTML = clean(html).replace(/<\/(div|p|h1|h2|li)>|<br>/gi, "\n"); return d.textContent; };
const title = n => (text(n.html).trim().split("\n")[0] || "Untitled").slice(0, 40);
const cur = () => state.notes.find(n => n.id === state.cur);
function newNote() { const n = { id: Date.now().toString(36), html: TPL, updated: Date.now() }; state.notes.unshift(n); state.cur = n.id; save(); render(); ed.focus(); }
function render(keepEditor) {
  const q = $("#search").value.toLowerCase();
  $("#list").innerHTML = "";
  state.notes.filter(n => text(n.html).toLowerCase().includes(q)).sort((a, b) => b.updated - a.updated).forEach(n => {
    const li = document.createElement("li"), b = document.createElement("button");
    b.className = "note" + (n.id === state.cur ? " active" : ""); b.innerHTML = "<strong></strong><small></small>";
    b.firstChild.textContent = title(n); b.lastChild.textContent = new Date(n.updated).toLocaleDateString();
    b.onclick = () => { state.cur = n.id; save(); render(); }; li.append(b); $("#list").append(li);
  });
  if (!keepEditor) { ed.innerHTML = clean(cur()?.html || ""); count(); }
}
const count = () => { const w = ed.innerText.trim().split(/\s+/).filter(Boolean).length; $("#count").textContent = `${w} word${w === 1 ? "" : "s"}`; };
let t; ed.addEventListener("input", () => { const n = cur(); if (!n) return; n.html = ed.innerHTML; n.updated = Date.now(); count(); $("#saved").textContent = "Saving…"; clearTimeout(t); t = setTimeout(() => { save(); render(true); }, 400); });
ed.addEventListener("paste", e => { e.preventDefault(); document.execCommand("insertText", false, e.clipboardData.getData("text/plain")); });
ed.addEventListener("click", () => { const r = getSelection(), n = r.anchorNode; if (n?.nodeType === 3 && /^[☐☑]/.test(n.textContent) && r.anchorOffset <= 1) { n.textContent = (n.textContent[0] === "☐" ? "☑" : "☐") + n.textContent.slice(1); ed.dispatchEvent(new Event("input")); } });
const CMD = { bold: ["bold"], italic: ["italic"], underline: ["underline"], h1: ["formatBlock", "H1"], h2: ["formatBlock", "H2"], ul: ["insertUnorderedList"], ol: ["insertOrderedList"], undo: ["undo"], redo: ["redo"], check: ["insertText", "☐ "] };
document.querySelectorAll(".tb[data-c]").forEach(b => b.onmousedown = e => { e.preventDefault(); ed.focus(); document.execCommand(...CMD[b.dataset.c]); ed.dispatchEvent(new Event("input")); });
$("#new").onclick = newNote; $("#search").oninput = () => render(true);
$("#del").onclick = () => { if (!cur() || !confirm("Delete this note?")) return; state.notes = state.notes.filter(n => n.id !== state.cur); state.cur = state.notes[0]?.id || null; if (!state.cur) newNote(); else { save(); render(); } };
const download = (name, data, type) => { const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([data], { type })); a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000); };
$("#export").onchange = e => { const n = cur(), f = e.target.value; e.target.value = ""; if (!n || !f) return; const base = title(n).replace(/[^\w-]+/g, "_") || "note";
  if (f === "txt") download(base + ".txt", text(n.html), "text/plain");
  if (f === "html") download(base + ".html", `<!doctype html><meta charset="utf-8"><title>${base}</title>${clean(n.html)}`, "text/html");
  if (f === "md") download(base + ".md", text(clean(n.html).replace(/<h1>/g, "\n# ").replace(/<h2>/g, "\n## ").replace(/<li>/g, "- ").replace(/<\/?(b|strong)>/g, "**").replace(/<\/?(i|em)>/g, "*")), "text/markdown"); };
$("#backup").onclick = () => download(`yakton-notes-backup-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(state), "application/json");
$("#restore").onchange = async e => { try { const s = JSON.parse(await e.target.files[0].text()); if (!Array.isArray(s.notes)) throw 0; const ids = new Set(state.notes.map(n => n.id)); s.notes.filter(n => n && typeof n.html === "string" && !ids.has(String(n.id))).forEach(n => state.notes.push({ id: String(n.id), html: clean(n.html), updated: +n.updated || Date.now() })); save(); render(); alert("Backup restored."); } catch { alert("That file isn't a valid Yakton Notes backup."); } e.target.value = ""; };
if (!state.notes.length) newNote(); else { if (!cur()) state.cur = state.notes[0].id; render(); }
