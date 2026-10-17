// Endpoint Alight Motion, diambil dari plugin Luffy v4.8: amprem.js (Hyerls), amverif (digabung ke amprem), dan ambulk.js (Alby).
// Kunci API disimpan di server, tidak pernah dikirim ke pengguna. Bisa diganti lewat Environment Variables Vercel:
//   HYERLS_KEY dan ALBY_KEY. Nilai awal di bawah sama dengan yang dipakai script bot.
//
// Semua endpoint menerima GET (query) maupun POST (JSON atau form).

const HYERLS = "https://hyerls.my.id/api/amprem.php";
const ALBY = "https://albyoffc.my.id/api/v1/am";
const HYERLS_KEY = process.env.HYERLS_KEY || "ZANSPWK";
const ALBY_KEY = process.env.ALBY_KEY || "albymd-235b23e";
const UA = "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 Chrome/139.0.0.0 Mobile Safari/537.36";

module.exports = ({ add, fail }) => {
  const emailOk = (e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(e || "").trim());
  const link = (v) => {
    const m = String(v || "").replace(/\s+/g, " ").match(/https?:\/\/\S+/i);
    if (!m) return "";
    const u = m[0].replace(/[\]}>,.;]+$/g, "");
    try { return /^https?:$/.test(new URL(u).protocol) ? u : ""; } catch { return ""; }
  };

  // Bila sumber membalas teks biasa, dibungkus jadi { message }.
  const call = async (url) => {
    let r;
    try {
      r = await fetch(url, { signal: AbortSignal.timeout(50000), headers: { "user-agent": UA, accept: "application/json, text/plain, */*" } });
    } catch (e) {
      throw fail(e.name === "TimeoutError" ? "Server sumber terlalu lama membalas" : "Server sumber tidak dapat dihubungi", e.name === "TimeoutError" ? 504 : 502);
    }
    const txt = await r.text();
    let d;
    try { d = JSON.parse(txt); } catch { d = txt.trim().slice(0, 1500); }
    const msg = typeof d === "string" ? d : String(d?.message || d?.msg || d?.error || "").slice(0, 300);
    if (!r.ok) throw fail(msg || `Server sumber membalas ${r.status}`, 502);
    if (d && typeof d === "object" && (d.success === false || d.status === false || d.ok === false)) throw fail(msg || "Server sumber menolak permintaan", 502);
    return typeof d === "string" ? { message: d } : d;
  };

  const register = (q) => {
    const email = String(q.email || "").trim();
    if (!emailOk(email)) throw fail("Format email tidak valid");
    return call(`${HYERLS}?${new URLSearchParams({ key: HYERLS_KEY, action: "register", email })}`);
  };
  const verify = (q) => {
    const email = String(q.email || "").trim();
    if (!emailOk(email)) throw fail("Format email tidak valid");
    const l = link(q.link);
    if (!l) throw fail("link harus berupa full link verifikasi dari email (diawali https://)");
    return call(`${HYERLS}?${new URLSearchParams({ key: HYERLS_KEY, action: "login", email, link: l })}`);
  };
  const bulk = (q) => {
    const n = q.count ? parseInt(q.count, 10) : 1;
    if (!(n >= 1 && n <= 10)) throw fail("count harus 1 sampai 10");
    const prefix = String(q.prefix || "").trim();
    if (prefix && !/^[a-z0-9._-]{1,30}$/i.test(prefix)) throw fail("prefix hanya boleh huruf, angka, titik, strip, underscore (maks 30)");
    const path = prefix ? "bulkcustom" : "bulkrandom";
    const p = { apikey: ALBY_KEY, count: String(n) };
    if (prefix) p.prefix = prefix;
    return call(`${ALBY}/${path}?${new URLSearchParams(p)}`);
  };

  const H = { heavy: true };
  add("am", "amprem", "Alight Motion Premium langkah 1: kirim link verifikasi ke email (GET atau POST)", ["email"], register, H);
  add("am", "amsend", "Sama dengan amprem: kirim link verifikasi Alight Motion ke email", ["email"], register, H);
  add("am", "amverif", "Alight Motion Premium langkah 2: kirim email dan full link verifikasi dari inbox", ["email", "link"], verify, H);
  add("am", "amverify", "Sama dengan amverif: verifikasi akun Alight Motion Premium", ["email", "link"], verify, H);
  add("am", "ambulk", "Buat beberapa akun Alight Motion sekaligus (count 1-10, prefix opsional untuk email custom)", ["count?", "prefix?"], bulk, H);
  add("am", "ambulkrandom", "Bulk Alight Motion dengan email acak (count 1-10)", ["count?"], (q) => bulk({ count: q.count }), H);
  add("am", "ambulkcustom", "Bulk Alight Motion dengan awalan email sendiri (count 1-10)", ["prefix", "count?"], (q) => bulk(q), H);
};
