// Uji semua endpoint tanpa internet memakai fetch tiruan.  Jalankan: node tests/run.js
//
// Yang diuji:
//   1. Setiap endpoint, dalam 5 kondisi server sumber (normal, media langsung, error 500, respons sampah, mati total, timeout),
//      selalu membalas dengan format yang bisa dibaca bot: JSON { ok, status, data/result } atau { ok:false, error }, atau file media.
//      Tidak boleh ada HTML, crash, atau menggantung.
//   2. Endpoint lokal (game, utilitas, hiburan) harus tetap 200 walau internet mati total.
//   3. Hasil hitungan endpoint lokal dicocokkan dengan nilai yang sudah diketahui benar.
//
// Catatan: ini menguji logika dan ketahanan kode, bukan apakah layanan pihak ketiga hidup.

try { require.resolve("express"); } catch { require("./shim"); }
const http = require("http");
const path = require("path");
const root = path.join(__dirname, "..");
const app = require(path.join(root, "api/index.js"));
const { list } = require(path.join(root, "lib/registry.js"));

// ---------- Fetch tiruan ----------
const PNG = Buffer.from("89504e470d0a1a0a0000000d49484452", "hex");
const realFetch = global.fetch;
let mode = "ok";
const reply = (body, { status = 200, type = "application/json" } = {}) =>
  new Response(body, { status, headers: { "content-type": type } });
const JSON_OK = {
  status: true, success: true,
  result: {
    url: "https://cdn.test/x.png", image: "https://cdn.test/x.png", download: "https://cdn.test/x.mp3",
    title: "judul", judul: "judul", text: "teks", name: "nama", username: "user",
    list: [{ title: "a", url: "https://cdn.test/x.png" }],
  },
};
global.fetch = async (input, opt = {}) => {
  const url = String(input);
  if (url.startsWith("http://127.0.0.1")) return realFetch(input, opt);
  if (mode === "down") throw new TypeError("fetch failed");
  if (mode === "timeout") throw Object.assign(new Error("timeout"), { name: "TimeoutError" });
  if (mode === "err500") return reply("Internal Server Error", { status: 500, type: "text/plain" });
  if (mode === "garbage") return reply("<html><body>bukan json</body></html>", { type: "text/html" });
  if (url.includes("api.mojang.com")) return reply(JSON.stringify({ id: "069a79f444e94726a5befca90e38aaf5", name: "Notch" }));
  if (url.startsWith("https://cdn.test/")) return reply(PNG, { type: url.endsWith(".mp3") ? "audio/mpeg" : "image/png" });
  if (mode === "direct") return reply(PNG, { type: "image/png" });
  return reply(JSON.stringify(JSON_OK));
};

// ---------- Nilai parameter uji ----------
const OVERRIDE = {
  konversi: { nilai: "10", dari: "km", ke: "mil" },
  selisihtanggal: { dari: "2020-01-01", ke: "2020-03-01" },
  hitungmundur: { tanggal: "2099-01-01" },
  weton: { tanggal: "1945-08-17" },
  hijriah: { tanggal: "2024-03-11" },
  jsonformat: { text: '{"a":1}' },
  hex: { text: "616263", mode: "decode" },
  urlencode: { text: "a b" },
  stalkminecraft: { username: "Notch" },
  cekjawaban: { tebakan: "Bunglon", jawaban: "bunglon" },
  balogo: { textl: "Blue", textr: "Archive" },
  base64: { text: "halo", mode: "encode" },
  kalkulator: { expr: "1+2", ekspresi: "1+2" },
  kurs: {},
  basis: { angka: "ff", dari: "16", ke: "2" },
  frombinary: { angka: "101" },
  fromoctal: { angka: "17" },
  fromhex: { angka: "ff" },
  unbinary: { text: "01100001" },
  unmorse: { text: "... --- ..." },
  dariromawi: { text: "XIV" },
  fromascii: { text: "72 105" },
  extractnumber: { text: "a 12 b 3,5" },
  karakter: { nama: "luffy" },
};
const BY_NAME = {
  url: "https://example.com/a.jpg", image: "https://example.com/a.jpg", ppurl: "https://example.com/a.jpg", avatar: "https://example.com/a.jpg",
  text: "halo dunia", q: "naruto", username: "tes", prompt: "kucing lucu",
  angka: "17", n: "10", a: "12", b: "18", c: "2", harga: "100000", diskon: "10", pokok: "1000000", bunga: "12", bulan: "12", harta: "200000000",
  tahun: "2024", nilai: "10", total_match: "100", wr_now: "50", wr_target: "60", shift: "3", id: "123456", zone: "1234", uid: "123456789",
  tanggal: "2000-01-31", kota: "jakarta", user: "tes", name: "tes", nama: "tes",
  email: "tes@example.com", link: "https://example.com/verifikasi?t=1", count: "1",
  hex: "ff8800", hex2: "0088ff", r: "10", g: "20", b: "30", h: "120", s: "50", l: "50", daftar: "3,1,2,2", key: "kunci",
  berat: "60", tinggi: "170", umur: "25", gender: "l", zona: "Asia/Jakarta", tim: "2",
};
const dummy = (e) => {
  const o = {};
  for (const p of e.params) {
    const n = p.replace(/\?$/, "");
    if (p.endsWith("?")) continue;
    o[n] = BY_NAME[n] ?? "tes";
  }
  return { ...o, ...(OVERRIDE[e.name] || {}) };
};

// ---------- Ambil daftar endpoint lokal ----------
const collect = (file) => {
  const names = new Set();
  const add = (cat, name) => names.add(`${cat}/${name}`);
  require(path.join(root, file))({ add, fail: (m) => new Error(m), enc: encodeURIComponent, isUrl: (s) => /^https?:/i.test(s) });
  return names;
};
const LOCAL = new Set([...collect("lib/games.js"), ...collect("lib/local.js"), ...collect("lib/mega.js")]);
const LUFFY = collect("lib/luffy.js");

// ---------- HTTP helper ----------
const server = http.createServer(app);
let base;
const hit = (e, q) =>
  new Promise((resolve) => {
    const u = new URL(e.path, base);
    for (const [k, v] of Object.entries(q)) u.searchParams.set(k, v);
    const t = setTimeout(() => resolve({ hang: true }), 8000);
    http.get(u, (res) => {
      const chunks = [];
      res.on("data", (c) => chunks.push(c));
      res.on("end", () => {
        clearTimeout(t);
        const body = Buffer.concat(chunks);
        const type = String(res.headers["content-type"] || "");
        let json = null;
        if (type.includes("json")) { try { json = JSON.parse(body.toString()); } catch {} }
        resolve({ code: res.statusCode, type, body, json, loc: res.headers.location });
      });
    }).on("error", (err) => { clearTimeout(t); resolve({ err }); });
  });

const check = (r) => {
  if (r.hang) return "menggantung";
  if (r.err) return "koneksi putus: " + r.err.message;
  if (r.code >= 300 && r.code < 400) return r.loc ? null : "redirect tanpa lokasi";
  if (/^(image|audio|video)\//.test(r.type) || r.type.includes("octet-stream")) return r.code === 200 && r.body.length ? null : "media kosong";
  if (!r.json) return `bukan JSON (${r.type || "tanpa content-type"})`;
  if (typeof r.json.ok !== "boolean") return "tidak ada field ok";
  if (r.json.ok) return r.json.status === true && "result" in r.json && "data" in r.json ? null : "field status/result/data tidak lengkap";
  if (!r.json.error || typeof r.json.error !== "string") return "error kosong";
  if (r.json.status !== false) return "field status harus false saat gagal";
  if (/Cannot read|undefined|is not a function|TypeError|at .*\.js/.test(r.json.error)) return "bocor detail internal: " + r.json.error;
  if (r.code < 400) return "ok:false tapi status HTTP " + r.code;
  return null;
};

(async () => {
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  base = `http://127.0.0.1:${server.address().port}`;
  const eps = list();
  const problems = [];
  const stats = {};

  for (const m of ["ok", "direct", "err500", "garbage", "down", "timeout"]) {
    mode = m;
    const s = (stats[m] = { sukses: 0, errorRapi: 0, masalah: 0 });
    for (const e of eps) {
      const r = await hit(e, dummy(e));
      const bad = check(r);
      if (bad) { s.masalah++; problems.push(`[${m}] ${e.cat}/${e.name}: ${bad}`); }
      else if (r.json && r.json.ok === false) s.errorRapi++;
      else s.sukses++;

      // Endpoint lokal harus tetap berhasil walau internet mati total.
      if (LOCAL.has(`${e.cat}/${e.name}`) && !(r.json && r.json.ok === true) && !(r.code === 400) && !(r.code === 200 && /^image\//.test(r.type))) {
        problems.push(`[${m}] ${e.cat}/${e.name}: endpoint lokal gagal saat internet mati (${r.code})`);
      }
      // Endpoint dari Luffy tidak boleh membocorkan error tak terduga.
      if (LUFFY.has(`${e.cat}/${e.name}`) && r.json && r.json.ok === false && r.code === 500) {
        problems.push(`[${m}] ${e.cat}/${e.name}: status 500 tak terduga`);
      }
    }
  }

  // Mode normal: semua endpoint Luffy dengan data tiruan wajib sukses.
  mode = "ok";
  for (const e of eps.filter((x) => LUFFY.has(`${x.cat}/${x.name}`))) {
    const r = await hit(e, dummy(e));
    const okMedia = r.code === 200 && /^(image|audio|video)\//.test(r.type);
    const okJson = r.json && r.json.ok === true;
    if (!okMedia && !okJson && !(r.code === 400)) problems.push(`[ok] ${e.cat}/${e.name}: seharusnya sukses, dapat ${r.code} ${r.json?.error || r.type}`);
    if (r.code === 400) problems.push(`[ok] ${e.cat}/${e.name}: ditolak 400 (${r.json?.error})`);
  }

  // ---------- Nilai yang sudah diketahui benar ----------
  const V = async (cat, name, q) => (await hit({ path: `/api/${cat}/${name}` }, q)).json?.data;
  const eq = (label, got, want) => {
    if (JSON.stringify(got) !== JSON.stringify(want)) problems.push(`[nilai] ${label}: dapat ${JSON.stringify(got)}, seharusnya ${JSON.stringify(want)}`);
  };
  mode = "down";
  const w = await V("utility", "weton", { tanggal: "1945-08-17" });
  eq("weton 17-08-1945", [w?.hari, w?.pasaran, w?.neptu], ["Jumat", "Legi", 11]);
  eq("kabisat 2024", (await V("utility", "kabisat", { tahun: "2024" }))?.kabisat, true);
  eq("kabisat 1900", (await V("utility", "kabisat", { tahun: "1900" }))?.kabisat, false);
  const f = await V("utility", "fpbkpk", { a: "12", b: "18" });
  eq("fpb/kpk 12,18", [f?.fpb, f?.kpk], [6, 36]);
  eq("17 prima", (await V("utility", "bilangan", { angka: "17" }))?.prima, true);
  eq("1 km ke mil", (await V("utility", "konversi", { nilai: "1", dari: "km", ke: "m" }))?.hasil, 1000);
  eq("100C ke F", (await V("utility", "konversi", { nilai: "100", dari: "c", ke: "f" }))?.hasil, 212);
  eq("akar x2-3x+2", (await V("utility", "kuadrat", { a: "1", b: "-3", c: "2" }))?.akar, [2, 1]);
  eq("diskon 10%", (await V("utility", "diskon", { harga: "100000", diskon: "10" }))?.bayar, 90000);
  const wr = await V("tools", "winrate", { total_match: "100", wr_now: "50", wr_target: "60" });
  eq("winrate 50->60", [wr?.menangBeruntunDibutuhkan, wr?.hasilAkhir], [25, 60]);
  eq("faktorial 5", (await V("utility", "faktorial", { n: "5" }))?.hasil, 120);
  eq("fibonacci 8", (await V("utility", "fibonacci", { n: "8" }))?.deret, ["0", "1", "1", "2", "3", "5", "8", "13"]);
  eq("hijriah 11-03-2024", (await V("islami", "hijriah", { tanggal: "2024-03-11" }))?.hijriah?.replace(/\s+/g, " ").toLowerCase().includes("ramadan"), true);
  eq("cekjawaban", (await V("game", "cekjawaban", { tebakan: " Bunglon ", jawaban: "bunglon" }))?.benar, true);
  eq("rot13", (await V("utility", "rot13", { text: "Halo" }))?.hasil, "Unyb");
  eq("jodoh konsisten", (await V("fun", "jodoh", { nama1: "a", nama2: "b" }))?.persen, (await V("fun", "jodoh", { nama1: "b", nama2: "a" }))?.persen);
  const g = await V("game", "tebakkimia", {});
  eq("tebakkimia punya jawaban", typeof g?.jawaban, "string");
  const bad400 = await hit({ path: "/api/utility/kabisat" }, {});
  eq("parameter wajib kosong -> 400", [bad400.code, bad400.json?.ok], [400, false]);
  const alias = await hit({ path: "/api/utility/rot13" }, { teks: "Halo" });
  eq("alias parameter teks->text", alias.json?.data?.hasil, "Unyb");
  const miss = await hit({ path: "/api/xxx/yyy" }, {});
  eq("endpoint tak ada -> 404 JSON", [miss.code, miss.json?.ok], [404, false]);
  const upper = await hit({ path: "/api/Utility/Rot13" }, { text: "a" });
  eq("nama endpoint tak peduli huruf besar", upper.json?.ok, true);


  // ---------- Endpoint baru: nilai yang sudah diketahui benar ----------
  eq("convert km-ke-m", (await V("convert", "km-ke-m", { nilai: "1" }))?.hasil, 1000);
  eq("convert c-ke-f", (await V("convert", "c-ke-f", { nilai: "100" }))?.hasil, 212);
  eq("convert gb-ke-mb", (await V("convert", "gb-ke-mb", { nilai: "2" }))?.hasil, 2048);
  eq("md5 abc", (await V("crypto", "md5", { text: "abc" }))?.hasil, "900150983cd24fb0d6963f7d28e17f72");
  eq("sha256 abc", (await V("crypto", "sha256", { text: "abc" }))?.hasil, "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
  eq("terbilang 1234", (await V("math", "terbilang", { angka: "1234" }))?.hasil, "seribu dua ratus tiga puluh empat");
  eq("romawi 1994", (await V("math", "romawi", { angka: "1994" }))?.hasil, "MCMXCIV");
  eq("dariromawi XIV", (await V("math", "dariromawi", { text: "XIV" }))?.hasil, 14);
  eq("faktorial 10", (await V("math", "faktorial", { angka: "10" }))?.hasil, 3628800);
  eq("fibonacci 50", (await V("math", "fibonacci", { n: "50" }))?.hasil, "12586269025");
  eq("kombinasi 5,2", (await V("math", "kombinasi", { n: "5", r: "2" }))?.hasil, "10");
  eq("faktorprima 360", (await V("math", "faktorprima", { angka: "360" }))?.hasil, [2, 2, 2, 3, 3, 5]);
  eq("median", (await V("math", "median", { daftar: "5,1,3" }))?.hasil, 3);
  eq("basis ff->2", (await V("math", "basis", { angka: "ff", dari: "16", ke: "2" }))?.hasil, "11111111");
  eq("font bold", (await V("font", "bold", { text: "Ab1" }))?.hasil, "\u{1D400}\u{1D41B}\u{1D7CF}".replace(/\\u\{(.+?)\}/g, (m, h) => String.fromCodePoint(parseInt(h, 16))));
  eq("morse sos", (await V("text", "morse", { text: "sos" }))?.hasil, "... --- ...");
  eq("unmorse sos", (await V("text", "unmorse", { text: "... --- ..." }))?.hasil, "sos");
  eq("palindrome", (await V("text", "palindrome", { text: "Kasur ini rusak" }))?.hasil, true);
  eq("slug", (await V("text", "slug", { text: "Halo Dunia Ku!" }))?.hasil, "halo-dunia-ku");
  eq("camel", (await V("text", "camel", { text: "halo dunia ku" }))?.hasil, "haloDuniaKu");
  eq("hex2rgb", (await V("color", "hex2rgb", { hex: "#ff8800" }))?.css, "rgb(255, 136, 0)");
  eq("kontras hitam-putih", (await V("color", "kontras", { hex: "000", hex2: "fff" }))?.rasio, 21);
  eq("kabisat 2024 (time)", (await V("time", "kabisat", { tahun: "2024" }))?.kabisat, true);
  eq("hari 17-08-1945", (await V("time", "hari", { tanggal: "1945-08-17" }))?.hari, "Jumat");
  eq("zodiak 31-01", (await V("time", "zodiak", { tanggal: "2000-01-31" }))?.zodiak, "Aquarius");
  eq("jakarta UTC+07:00", (await V("time", "jakarta", {}))?.utc, "UTC+07:00");
  eq("onepiece kru 10 orang", (await V("onepiece", "kru", {}))?.length, 10);
  eq("bounty konsisten", (await V("onepiece", "bounty", { nama: "rijal" }))?.bounty, (await V("onepiece", "bounty", { nama: "RIJAL" }))?.bounty);
  const wanted = await hit({ path: "/api/onepiece/wanted" }, { nama: "Rijal" });
  eq("wanted gambar svg", [wanted.code, wanted.type.startsWith("image/svg+xml")], [200, true]);
  eq("am/ambulk count 99 ditolak", (await hit({ path: "/api/am/ambulk" }, { count: "99" })).code, 400);
  eq("am/amprem email salah ditolak", (await hit({ path: "/api/am/amprem" }, { email: "bukan-email" })).code, 400);

  // ---------- POST: JSON, form, dan method yang tidak boleh ----------
  const send = (method, p, body, type) => new Promise((resolve) => {
    const u = new URL(p, base);
    const data = body === undefined ? undefined : type === "form" ? new URLSearchParams(body).toString() : JSON.stringify(body);
    const req = http.request(u, { method, headers: data === undefined ? {} : { "content-type": type === "form" ? "application/x-www-form-urlencoded" : "application/json", "content-length": Buffer.byteLength(data) } }, (res) => {
      const ch = []; res.on("data", (c) => ch.push(c));
      res.on("end", () => { let json = null; try { json = JSON.parse(Buffer.concat(ch).toString()); } catch {} resolve({ code: res.statusCode, json }); });
    });
    req.on("error", () => resolve({ code: 0 }));
    if (data !== undefined) req.write(data);
    req.end();
  });
  eq("POST JSON", (await send("POST", "/api/text/upper", { text: "halo" }))?.json?.data?.hasil, "HALO");
  eq("POST form", (await send("POST", "/api/text/upper", { text: "halo" }, "form"))?.json?.data?.hasil, "HALO");
  eq("POST angka (bukan string)", (await send("POST", "/api/math/faktorial", { angka: 5 }))?.json?.data?.hasil, 120);
  eq("POST alias teks->text", (await send("POST", "/api/text/upper", { teks: "halo" }))?.json?.data?.hasil, "HALO");
  eq("POST tanpa parameter wajib -> 400", (await send("POST", "/api/text/upper", {})).code, 400);
  eq("POST JSON rusak -> 400 JSON", await (async () => { const r = await new Promise((res) => { const rq = http.request(new URL("/api/text/upper", base), { method: "POST", headers: { "content-type": "application/json" } }, (x) => { const c = []; x.on("data", (d) => c.push(d)); x.on("end", () => { let j = null; try { j = JSON.parse(Buffer.concat(c).toString()); } catch {} res({ code: x.statusCode, ok: j?.ok }); }); }); rq.end("{rusak"); }); return [r.code, r.ok]; })(), [400, false]);
  eq("DELETE ditolak 405", (await send("DELETE", "/api/text/upper")).code, 405);
  const cfg = (await hit({ path: "/api/config" }, {})).json;
  eq("config domain otomatis", [cfg?.ok, /^http:\/\/127\.0\.0\.1:\d+$/.test(cfg?.base || "")], [true, true]);

  // ---------- Laporan ----------
  const cats = {};
  eps.forEach((e) => (cats[e.cat] = (cats[e.cat] || 0) + 1));
  console.log(`Total endpoint terdaftar : ${eps.length}`);
  console.log(`  dari Luffy             : ${LUFFY.size}`);
  console.log(`  lokal (selalu aktif)   : ${LOCAL.size} + utilitas bawaan lain`);
  console.log("Per kategori             :", Object.entries(cats).map(([k, v]) => `${k} ${v}`).join(", "));
  console.log("\nHasil per kondisi server sumber (jumlah endpoint):");
  for (const [m, s] of Object.entries(stats)) console.log(`  ${m.padEnd(8)} sukses ${String(s.sukses).padStart(3)} | gagal tapi rapi ${String(s.errorRapi).padStart(3)} | MASALAH ${s.masalah}`);
  console.log(problems.length ? `\n${problems.length} MASALAH:\n- ${problems.slice(0, 80).join("\n- ")}` : "\nSemua pemeriksaan lolos.");
  server.close();
  process.exit(problems.length ? 1 : 0);
})();
