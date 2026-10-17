/* ---------- Animasi masuk 0% sampai 100% ---------- */
const loader = (() => {
  const el = document.getElementById("loader");
  const html = document.documentElement;
  if (!el) { html.classList.remove("loading"); return { finish() {} }; }
  const num = document.getElementById("loaderNum");
  const fill = document.getElementById("loaderFill");
  const msg = document.getElementById("loaderMsg");
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const MIN = reduce ? 0 : 1300; // waktu minimal supaya hitungannya sempat terlihat
  const t0 = performance.now();
  let shown = 0, wantFinish = false, closed = false;

  const paint = (v) => {
    const n = Math.min(100, Math.max(0, Math.round(v)));
    num.textContent = n;
    fill.style.width = n + "%";
    el.setAttribute("aria-valuenow", n);
    msg.textContent = n >= 100 ? "Sauh diangkat, berlayar!" : n >= 45 ? "Membaca peta endpoint..." : "Mengangkat jangkar...";
  };
  const close = () => {
    if (closed) return;
    closed = true;
    paint(100);
    html.classList.remove("loading");
    el.classList.add("done");
    setTimeout(() => (el.hidden = true), 900);
  };
  const tick = (now) => {
    if (closed) return;
    const t = now - t0;
    const finishing = wantFinish && t >= MIN;
    // Sebelum data siap, hitungan melambat mendekati 90%. Begitu siap, langsung dikebut ke 100%.
    const target = finishing ? 100 : 90 * (1 - Math.exp(-t / 900));
    shown += (target - shown) * (finishing ? 0.2 : 0.25);
    if (finishing && 100 - shown < 0.6) shown = 100;
    paint(shown);
    if (shown >= 100) return setTimeout(close, 280);
    requestAnimationFrame(tick);
  };
  paint(0);
  if (reduce) return { finish: close };
  requestAnimationFrame(tick);
  setTimeout(close, 9000); // pengaman: halaman tidak boleh tertahan di layar loading
  return { finish() { wantFinish = true; } };
})();

const LABEL = {
  download: "Downloader", music: "Musik", image: "Gambar", video: "Video", maker: "Maker",
  ai: "AI", search: "Pencarian", info: "Info", stalk: "Profil", tools: "Tools", fun: "Hiburan", utility: "Utility", islami: "Islami", random: "Random", game: "Game",
  am: "Alight Motion", convert: "Konversi", text: "Teks", font: "Font", crypto: "Crypto", generator: "Generator", time: "Waktu", math: "Matematika", color: "Warna", onepiece: "One Piece",
};
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
// Domain otomatis: awalnya alamat yang sedang dibuka, lalu disamakan dengan /api/config (domain production Vercel).
let base = location.origin;
let method = "GET";
const LIMIT = 24;
const expanded = new Set();
const showBase = () => { const el = $("#baseUrl"); if (el) el.textContent = base; };
const clean = (p) => (p.endsWith("?") ? p.slice(0, -1) : p);
const title = (e) => e.name.charAt(0).toUpperCase() + e.name.slice(1);
const catName = (c) => (c === "semua" ? "Semua" : LABEL[c] || c);

let all = [];
let cat = "semua";
let term = "";
let cur = null;

/* ---------- Daftar ---------- */
function render() {
  const t = term.trim().toLowerCase();
  const rows = all.filter((e) => (cat === "semua" || e.cat === cat) && (!t || `${e.name} ${e.desc} ${e.cat} ${e.path}`.toLowerCase().includes(t)));
  if (!rows.length) {
    $("#list").innerHTML = `<p class="empty">Tidak ada endpoint yang cocok. Hapus kata kunci atau pilih kategori lain.</p>`;
    return;
  }
  const groups = {};
  rows.forEach((e) => (groups[e.cat] ||= []).push(e));
  const capped = cat === "semua" && !t;
  $("#list").innerHTML = Object.entries(groups)
    .map(([c, all0]) => { const items = capped && !expanded.has(c) ? all0.slice(0, LIMIT) : all0; return `<section><h2 class="group">${esc(catName(c))} <small>${all0.length}</small></h2><div class="grid">${items
      .map((e) => `<button type="button" class="card" data-path="${esc(e.path)}"><span class="badge">GET·POST</span><h3>${esc(title(e))}</h3><p>${esc(e.desc)}</p><span class="tag ${e.kind}">${e.kind === "ready" ? "Siap dipakai" : "Perlu provider"}</span></button>`)
      .join("")}</div>${items.length < all0.length ? `<button type="button" class="more" data-more="${esc(c)}">Tampilkan semua ${all0.length} endpoint ${esc(catName(c))}</button>` : ""}</section>`; })
    .join("");
}

function renderCats() {
  const names = ["semua", ...new Set(all.map((e) => e.cat))];
  const html = (extra) => names.map((c) => `<button type="button" data-cat="${c}" aria-pressed="${c === cat}">${esc(catName(c))}${extra(c)}</button>`).join("");
  $("#cats").innerHTML = html(() => "");
  $("#drawerCats").innerHTML = html((c) => ` (${c === "semua" ? all.length : all.filter((e) => e.cat === c).length})`);
}

/* ---------- Modal ---------- */
function field(p) {
  const opt = p.endsWith("?");
  const n = clean(p);
  return `<div class="field"><label for="f-${esc(n)}">${esc(n)}${opt ? "" : ' <span class="req" aria-hidden="true">*</span>'}<svg class="i" role="img" aria-label="${opt ? "Opsional" : "Wajib diisi"}"><title>${opt ? "Opsional" : "Wajib diisi"}</title><use href="#i-info"/></svg></label><input id="f-${esc(n)}" name="${esc(n)}" ${opt ? "" : "required"} autocomplete="off" placeholder="Masukkan ${esc(n)}..."></div>`;
}

function sync() {
  $("#mSend").disabled = !$$("#mForm input[required]").every((i) => i.value.trim());
}

function openModal(e) {
  cur = e;
  $("#mTitle").textContent = title(e);
  $("#mDesc").textContent = e.desc;
  $("#mUrl").textContent = base + e.path;
  $("#mNote").hidden = e.kind !== "provider";
  $("#mParams").innerHTML = e.params.length ? e.params.map(field).join("") : `<p class="muted">Endpoint ini tidak butuh parameter.</p>`;
  const out = $("#mOut");
  out.hidden = true;
  out.innerHTML = "";
  sync();
  setMethod("GET");
  $("#modal").showModal();
  $(".mbody").scrollTop = 0;
}

function setMethod(m) {
  method = m;
  $$("#mMethod button").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.m === m)));
  $("#mStamp").textContent = m;
  $("#mBody").hidden = m !== "POST" || !cur.params.length;
  showBody();
}

function bodyObj() {
  const o = {};
  new FormData($("#mForm")).forEach((v, k) => v.trim() && (o[k] = v.trim()));
  return o;
}

function showBody() {
  if (method !== "POST") return;
  const o = bodyObj();
  cur.params.forEach((p) => { const n = clean(p); if (!(n in o)) o[n] = p.endsWith("?") ? "" : "..."; });
  $("#mBody").textContent = `POST ${base + cur.path}\nContent-Type: application/json\n\n${JSON.stringify(o, null, 2)}`;
}

function buildUrl() {
  const u = new URL(cur.path, location.origin);
  new FormData($("#mForm")).forEach((v, k) => v.trim() && u.searchParams.set(k, v.trim()));
  return u.toString();
}

async function copy(text, btn) {
  const html = btn.innerHTML;
  try { await navigator.clipboard.writeText(text); btn.textContent = btn.classList.contains("circle") ? "✓" : "Tersalin"; }
  catch { btn.textContent = "!"; }
  setTimeout(() => (btn.innerHTML = html), 1500);
}

$("#mForm").addEventListener("input", () => { sync(); showBody(); });
$("#mMethod").addEventListener("click", (ev) => { const b = ev.target.closest("button[data-m]"); if (b) setMethod(b.dataset.m); });
$("#mCopy").addEventListener("click", (ev) => copy(base + cur.path, ev.currentTarget));
$("#mForm").addEventListener("submit", async (ev) => {
  ev.preventDefault();
  if ($("#mSend").disabled) return;
  const out = $("#mOut");
  const url = buildUrl();
  out.hidden = false;
  if (method === "POST") {
    out.innerHTML = `<h3>Respons</h3><p class="status">Memuat...</p>`;
    try {
      const r = await fetch(new URL(cur.path, location.origin), { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(bodyObj()) });
      const type = r.headers.get("content-type") || "";
      if (/^(image|audio|video)\//.test(type)) {
        const src = URL.createObjectURL(await r.blob());
        const tag = type.startsWith("image/") ? `<img alt="Hasil" src="${src}">` : type.startsWith("audio/") ? `<audio controls src="${src}"></audio>` : `<video controls playsinline style="max-width:100%" src="${src}"></video>`;
        out.innerHTML = `<h3>Respons</h3><p class="status">Status ${r.status} · ${esc(type)}</p>${tag}`;
      } else {
        const txt = await r.text();
        let body = txt;
        try { body = JSON.stringify(JSON.parse(txt), null, 2); } catch {}
        out.innerHTML = `<h3>Respons</h3><p class="status">Status ${r.status}</p><pre>${esc(body)}</pre>`;
      }
    } catch {
      out.innerHTML = `<h3>Respons</h3><p class="status">Request POST gagal. Coba method GET atau periksa koneksi.</p>`;
    }
    out.scrollIntoView({ block: "nearest", behavior: "smooth" });
    return;
  }
  if (cur.out === "image") {
    out.innerHTML = `<h3>Respons</h3><img alt="Hasil" src="${esc(url)}">`;
    $("img", out).onerror = (e) => e.target.replaceWith(Object.assign(document.createElement("p"), { className: "status", textContent: "Gambar gagal dimuat. Periksa parameter lalu coba lagi." }));
  } else if (cur.out === "video") {
    out.innerHTML = `<h3>Respons</h3><video controls playsinline style="max-width:100%" src="${esc(url)}"></video>`;
  } else if (cur.out === "audio") {
    out.innerHTML = `<h3>Respons</h3><audio controls src="${esc(url)}"></audio>`;
  } else {
    out.innerHTML = `<h3>Respons</h3><p class="status">Memuat...</p>`;
    try {
      const r = await fetch(url);
      const txt = await r.text();
      let body = txt;
      try { body = JSON.stringify(JSON.parse(txt), null, 2); } catch {}
      out.innerHTML = `<h3>Respons</h3><p class="status">Status ${r.status}</p><pre>${esc(body)}</pre>`;
    } catch {
      out.innerHTML = `<h3>Respons</h3><p class="status">Request gagal. Periksa koneksi lalu coba lagi.</p>`;
    }
  }
  out.scrollIntoView({ block: "nearest", behavior: "smooth" });
});

/* ---------- Interaksi umum ---------- */
const drawer = $("#drawer");
const modal = $("#modal");
const panel = $("#bellPanel");
const bell = $("#bellBtn");

function setPanel(open) {
  panel.hidden = !open;
  bell.setAttribute("aria-expanded", String(open));
  if (open) { $("#dot").hidden = true; try { localStorage.setItem("seenNote", "1"); } catch {} }
}

document.addEventListener("click", (ev) => {
  const t = ev.target;
  const more = t.closest("[data-more]");
  if (more) { expanded.add(more.dataset.more); render(); return; }
  const c = t.closest("[data-cat]");
  if (c) { cat = c.dataset.cat; renderCats(); render(); if (drawer.open) drawer.close(); return; }
  const card = t.closest(".card");
  if (card) { openModal(all.find((e) => e.path === card.dataset.path)); return; }
  if (t.closest("[data-close]")) { t.closest("dialog").close(); return; }
  if (t === modal || t === drawer) { t.close(); return; }
  if (!t.closest(".bellwrap")) setPanel(false);
});
bell.addEventListener("click", () => setPanel(panel.hidden));
$("#menuBtn").addEventListener("click", () => drawer.showModal());
$("#search").addEventListener("input", (ev) => { term = ev.target.value; render(); });
document.addEventListener("keydown", (ev) => {
  if (ev.key === "Escape") setPanel(false);
  if (ev.key === "/" && !/INPUT|TEXTAREA/.test(document.activeElement.tagName) && !document.querySelector("dialog[open]")) {
    ev.preventDefault();
    $("#search").focus();
  }
});
const fab = $("#toTop");
addEventListener("scroll", () => fab.classList.toggle("show", scrollY > 400), { passive: true });
fab.addEventListener("click", () => scrollTo({ top: 0, behavior: "smooth" }));
try { if (localStorage.getItem("seenNote")) $("#dot").hidden = true; } catch {}

/* ---------- Muat data ---------- */
(async () => {
  showBase();
  fetch("/api/config").then((r) => r.json()).then((d) => { if (d && d.ok && d.base) { base = d.base; showBase(); if (cur) { $("#mUrl").textContent = base + cur.path; showBody(); } } }).catch(() => {});
  const vid = $("#bgVideo");
  if (vid) vid.play().catch(() => {});
  fetch("/api/ip").then((r) => r.json()).then((d) => ($("#ip").textContent = d.ip || "Tidak tersedia")).catch(() => ($("#ip").textContent = "Tidak tersedia"));
  try {
    all = (await (await fetch("/api/endpoints")).json()).data;
    $("#total").textContent = all.length;
    renderCats();
    render();
    // Tunggu font siap sebentar saja (maks 1,2 detik) supaya tampilan tidak melompat saat loader menutup.
    await Promise.race([document.fonts ? document.fonts.ready : 0, new Promise((r) => setTimeout(r, 1200))]);
  } catch {
    $("#list").innerHTML = `<p class="empty">Daftar endpoint gagal dimuat. Muat ulang halaman ini.</p>`;
  } finally {
    loader.finish();
  }
})();
