// Endpoint provider yang diambil dari script bot Luffy v4.8 (plugins maker, canvas, ai, random, stalker, dll).
// Semua host dan path di bawah ini dipakai langsung oleh plugin Luffy.
// Layanan pihak ketiga bisa down sewaktu-waktu. Karena itu setiap endpoint:
//   1. mencoba semua alamat cadangan secara berurutan,
//   2. selalu mengembalikan JSON { ok:false, error } yang rapi bila gagal (tidak pernah crash),
//   3. mengembalikan file asli (gambar/audio/video) bila hasilnya media.

const MB = 1024 * 1024;
const UA = "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Mobile Safari/537.36";
const CUKI_KEY = process.env.CUKI_KEY || "cuki-x";

const NX = "https://api.nexray.web.id";
const NX2 = "https://api.nexray.eu.cc";
const FAA = "https://api-faa.my.id";
const ZZ = "https://api.zenzxz.my.id";
const DL = "https://api.deline.web.id";
const NK = "https://api.nekolabs.web.id";
const CK = "https://api.cuki.biz.id";
const AZ = "https://api.azbry.com";
const YL = "https://api.yuulabs.web.id";
const NA = "https://api.nexadev.my.id";
const NA2 = "https://apii.nexadev.my.id";
const EM = "https://api.emiliabot.my.id";

module.exports = ({ add, fail, enc, isUrl }) => {
  const qs = (o) => {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries(o || {})) if (v !== undefined && v !== null && String(v).trim() !== "") p.set(k, String(v).trim());
    return p.toString();
  };
  const ep = (base, path, o) => `${base}${path}?${qs(o)}`;
  const need = (u) => {
    if (!isUrl(u)) throw fail("url harus diawali http:// atau https://");
    return u;
  };

  const rawGet = async (url, timeout = 30000) => {
    try {
      return await fetch(url, { signal: AbortSignal.timeout(timeout), headers: { "user-agent": UA, accept: "*/*" }, redirect: "follow" });
    } catch (e) {
      throw fail(e.name === "TimeoutError" ? "Server sumber terlalu lama membalas" : "Server sumber tidak dapat dihubungi", e.name === "TimeoutError" ? 504 : 502);
    }
  };

  const sniff = (b) => {
    const h = b.slice(0, 12);
    if (h.slice(0, 4).toString("hex") === "89504e47") return "image/png";
    if (h.slice(0, 3).toString("hex") === "ffd8ff") return "image/jpeg";
    if (h.slice(8, 12).toString() === "WEBP") return "image/webp";
    if (h.slice(0, 3).toString() === "GIF") return "image/gif";
    return null;
  };

  const URLRE = /^https?:\/\/\S+$/i;
  const KEYS = ["url", "result", "image", "image_url", "download", "download_url", "link", "video", "audio", "data", "output", "media"];
  const findUrl = (o, depth = 0) => {
    if (o == null || depth > 5) return null;
    if (typeof o === "string") return URLRE.test(o.trim()) ? o.trim() : null;
    if (Array.isArray(o)) {
      for (const x of o) { const u = findUrl(x, depth + 1); if (u) return u; }
      return null;
    }
    if (typeof o === "object") {
      for (const k of KEYS) if (k in o) { const u = findUrl(o[k], depth + 1); if (u) return u; }
      for (const v of Object.values(o)) { const u = findUrl(v, depth + 1); if (u) return u; }
    }
    return null;
  };

  const srcError = (d) => {
    if (d && typeof d === "object" && (d.status === false || d.success === false || (d.error && !d.result && !d.data))) {
      return String(d.message || d.msg || d.error || "Server sumber gagal memproses permintaan").slice(0, 200);
    }
    return null;
  };

  // Ambil media dari satu alamat. Bila sumber membalas JSON berisi link, ikuti linknya satu kali.
  const mediaOne = async (u, want, hop) => {
    const r = await rawGet(u, 40000);
    if (!r.ok) throw fail(`Server sumber membalas ${r.status}`, 502);
    const ct = (r.headers.get("content-type") || "").toLowerCase();
    const len = parseInt(r.headers.get("content-length") || "0", 10);
    const direct = /^(image|audio|video)\//.test(ct) || ct.includes("octet-stream");
    if (direct && len > 4 * MB) return { redirect: r.url || u };
    const buf = Buffer.from(await r.arrayBuffer());
    if (!buf.length) throw fail("Server sumber mengirim file kosong", 502);
    const looksJson = buf[0] === 0x7b || buf[0] === 0x5b;
    if (direct && !looksJson) {
      if (buf.length > 4 * MB) return { redirect: r.url || u };
      const type = ct.includes("octet-stream") ? sniff(buf) || (want === "audio" ? "audio/mpeg" : want === "video" ? "video/mp4" : "image/png") : ct.split(";")[0];
      return { buffer: buf, type };
    }
    let d;
    try { d = JSON.parse(buf.toString("utf8")); } catch { throw fail("Server sumber tidak mengirim media", 502); }
    const e = srcError(d);
    if (e) throw fail(e, 502);
    const next = findUrl(d.result ?? d.data ?? d);
    if (!next || next === u || hop >= 1) throw fail("Media tidak ditemukan pada respons server sumber", 502);
    return mediaOne(next, want, hop + 1);
  };

  const media = async (urls, want) => {
    let last;
    for (const u of [].concat(urls)) {
      try { return await mediaOne(u, want, 0); } catch (e) { last = e; }
    }
    throw last || fail("Gagal mengambil media dari server sumber", 502);
  };

  // Ambil JSON dari satu atau beberapa alamat cadangan.
  const call = async (urls, shape) => {
    let last;
    for (const u of [].concat(urls)) {
      try {
        const r = await rawGet(u, 35000);
        if (!r.ok) throw fail(`Server sumber membalas ${r.status}`, 502);
        const txt = await r.text();
        let d;
        try { d = JSON.parse(txt); } catch { throw fail("Respons server sumber bukan JSON", 502); }
        const e = srcError(d);
        if (e) throw fail(e, 502);
        const core = d && typeof d === "object" && !Array.isArray(d) && ("result" in d || "data" in d) ? d.result ?? d.data : d;
        if (core == null || core === "" || (Array.isArray(core) && !core.length)) throw fail("Server sumber tidak mengembalikan data", 404);
        return shape ? shape(core, d) : core;
      } catch (e) { last = e; }
    }
    throw last || fail("Gagal mengambil data dari server sumber", 502);
  };

  const heavy = { heavy: true };
  const IMG = { heavy: true, out: "image" };
  const AUD = { heavy: true, out: "audio" };
  const VID = { heavy: true, out: "video" };
  const ans = (c) => (typeof c === "string" ? { jawaban: c } : c);

  const img = (cat, name, desc, params, urls, extra = IMG) => add(cat, name, desc, params, (q) => media(urls(q), "image"), extra);
  const json = (cat, name, desc, params, urls, shape, extra = {}) => add(cat, name, desc, params, (q) => call(urls(q), shape), extra);

  /* ================= MAKER: gambar dibuat provider ================= */
  img("maker", "fakelobyml", "Lobby Mobile Legends palsu. rank dan border opsional", ["username", "rank?", "border?"], (q) => ep(NX, "/maker/fakelobyml", q));
  img("maker", "fakelobyff", "Lobby Free Fire palsu", ["username", "lobby?"], (q) => ep(NX, "/maker/fakelobyff", q));
  img("maker", "fakenote", "Catatan WhatsApp/iPhone palsu", ["name", "message", "avatar?"], (q) => ep(NX, "/maker/fakenote", q));
  img("maker", "fakenotifwa", "Notifikasi chat WhatsApp palsu", ["username", "chat", "ppurl?", "tanggal?", "jam?"], (q) => ep(NX, "/maker/fakenotifwa", q));
  img("maker", "fakeboard", "Papan tulis palsu dengan teks dan nama penulis", ["text", "author?"], (q) => ep(NX, "/maker/fakeboard", { teks: q.text, author: q.author }));
  img("maker", "fakebook", "Buku tulis palsu berisi teks", ["text"], (q) => ep(NX, "/maker/fakebook", { teks: q.text }));
  img("maker", "quotecard", "Kartu kutipan dengan nama penulis", ["text", "author?"], (q) => ep(NX, "/maker/quotecard", q));
  img("maker", "sertifikatnasa", "Sertifikat NASA dengan namamu", ["nama"], (q) => ep(NX, "/maker/sertifikat-nasa", q));
  img("maker", "balogo", "Logo gaya Blue Archive (teks kiri dan kanan)", ["textl", "textr"], (q) => ep(NX, "/maker/balogo", { text: `${q.textl} ${q.textr}` }));
  img("maker", "iqc", "Screenshot chat iPhone palsu", ["text"], (q) => [ep(NX2, "/maker/iqc", q), ep(NX2, "/maker/v1/iqc", q)]);
  img("maker", "ttp", "Teks berwarna jadi gambar (text to picture)", ["text"], (q) => ep(NX2, "/maker/ttp", q));
  img("maker", "bratanime", "Gambar brat bergaya anime", ["text"], (q) => ep(NX, "/maker/bratanime", q));
  img("maker", "cewekbrat", "Gambar brat versi cewek", ["text"], (q) => ep(DL, "/maker/cewekbrat", q));
  img("maker", "fakeigstory", "Story Instagram palsu", ["username", "caption", "url", "time?"], (q) => ep(ZZ, "/maker/fakeigstory", { username: q.username, caption: q.caption, time: q.time, url: need(q.url) }));
  img("maker", "fakegroup", "Tampilan grup WhatsApp palsu", ["url", "title", "number?", "time?"], (q) => ep(ZZ, "/maker/fakegroup", { url: need(q.url), title: q.title, number: q.number, time: q.time }));
  img("maker", "fakegroupv2", "Tampilan grup WhatsApp palsu versi 2", ["url", "name", "members?", "desc?", "author?", "date?"], (q) => ep(ZZ, "/maker/fakegroupv2", { url: need(q.url), name: q.name, members: q.members, desc: q.desc, author: q.author, date: q.date }));
  img("maker", "fakechannel", "Tampilan saluran WhatsApp palsu", ["url", "name", "followers?", "desc?", "date?"], (q) => ep(ZZ, "/maker/fakechannel", { url: need(q.url), name: q.name, followers: q.followers, desc: q.desc, date: q.date }));
  img("maker", "musiccard", "Kartu pemutar musik dengan cover", ["judul", "nama", "image"], (q) => ep(NX2, "/canvas/musiccard", { judul: q.judul, nama: q.nama, image_url: need(q.image) }));
  img("maker", "wmp1", "Gambar teks Warkop gaya 1", ["text"], (q) => ep(NA2, "/wmp1", q));
  img("maker", "wmp2", "Gambar teks Warkop gaya 2", ["text"], (q) => ep(NA2, "/wmp2", q));
  img("maker", "susutaro", "Edit foto jadi poster susu taro", ["image"], (q) => ep(CK, "/api/canvas/susu-taro", { apikey: CUKI_KEY, image: need(q.image) }));
  img("maker", "ustadz", "Gambar ustadz dengan tulisan", ["text"], (q) => ep(CK, "/api/canvas/ustadz", { apikey: CUKI_KEY, text: q.text }));
  img("maker", "starboy", "Edit foto jadi cover gaya Starboy", ["image"], (q) => ep(CK, "/api/canvas/starboy", { apikey: CUKI_KEY, image: need(q.image) }));
  img("maker", "watercolortext", "Teks cat air (efek ephoto360)", ["text"], (q) => ep(CK, "/api/ephoto/watercolortext", { apikey: CUKI_KEY, query: q.text }));

  /* ================= IMAGE: edit gambar dengan AI ================= */
  const edit = (name, desc, path) => img("image", name, desc, ["url"], (q) => ep(FAA, path, { url: need(q.url) }));
  edit("tojapanese", "Ubah foto jadi gaya Jepang", "/faa/tojapanese");
  edit("toghibli", "Ubah foto jadi gaya Studio Ghibli", "/faa/toghibli");
  edit("tohijab", "Ubah foto jadi berhijab", "/faa/tohijab");
  edit("tofigura", "Ubah foto jadi action figure", "/faa/tofigura");
  edit("tofigurav3", "Ubah foto jadi action figure versi 3", "/faa/tofigurav3");
  edit("tomoai", "Ubah foto jadi gaya Moai", "/faa/tomoai");
  edit("tomekah", "Ubah foto jadi robot mekah", "/faa/tomekah");
  edit("toblonde", "Ubah rambut di foto jadi pirang", "/faa/toblonde");
  img("image", "nanobanana", "Edit foto sesuai perintah (Nano Banana)", ["url", "prompt"], (q) => ep(FAA, "/faa/nano-banana", { url: need(q.url), prompt: q.prompt }));
  img("image", "unblur", "Hilangkan blur pada foto", ["url"], (q) => ep(NX2, "/tools/unblur", { url: need(q.url) }));
  img("image", "upscale", "Perbesar resolusi foto", ["url", "resolusi?"], (q) => ep(NA, "/api/upscale1", { url: need(q.url), resolusi: q.resolusi || "4" }));
  img("image", "gura", "Edit foto jadi meme Gawr Gura", ["url"], (q) => ep(NX2, "/canvas/gura", { url: need(q.url) }));

  /* ================= RANDOM: gambar acak ================= */
  const rnd = (name, desc, urls) => img("random", name, desc, [], () => urls);
  rnd("cecanindo", "Foto cewek Indonesia acak", `${NX}/random/cecan/indonesia`);
  rnd("cecanjepang", "Foto cewek Jepang acak", `${NX}/random/cecan/japan`);
  rnd("cecankorea", "Foto cewek Korea acak", `${NX}/random/cecan/korea`);
  rnd("cecanchina", "Foto cewek China acak", `${NX}/random/cecan/china`);
  rnd("cecanthailand", "Foto cewek Thailand acak", `${NX}/random/cecan/thailand`);
  rnd("cecanvietnam", "Foto cewek Vietnam acak", `${NX}/random/cecan/vietnam`);
  rnd("randomba", "Gambar acak karakter Blue Archive", `${NX}/random/ba`);
  img("random", "randomanime", "Gambar anime acak. type opsional (mis. waifu, neko)", ["type?"], (q) => ep(NX2, "/random/anime", { type: q.type || "waifu" }));
  json("random", "ppcouple", "Pasangan foto profil couple acak", [], () => `${DL}/random/ppcouple`);
  img("random", "lahelu", "Meme Lahelu acak", [], () => ep(CK, "/api/random/lahelu", { apikey: CUKI_KEY }));

  /* ================= AI ================= */
  const aiText = (name, desc, urls, extra = {}) => json("ai", name, desc, ["text"], urls, ans, { heavy: true, ...extra });
  aiText("glm", "Tanya jawab dengan GLM", (q) => ep(NX, "/ai/glm", { text: q.text, model: "glm-4.6" }));
  aiText("gpt35", "Tanya jawab dengan GPT-3.5 Turbo", (q) => ep(NX2, "/ai/gpt-3.5-turbo", q));
  aiText("quillbot", "Tulis ulang kalimat (paraphrase) dengan Quillbot", (q) => ep(NX2, "/ai/quillbot", q));
  aiText("mathgpt", "Selesaikan soal matematika langkah demi langkah", (q) => ep(NX2, "/ai/mathgpt", q));
  aiText("simisimi", "Ngobrol dengan SimSimi", (q) => ep(NX, "/ai/simisimi", q));
  aiText("humanizer", "Ubah teks AI jadi lebih natural", (q) => ep(NX, "/ai/humanizer", { teks: q.text }));
  aiText("openai", "Tanya jawab dengan OpenAI (prompt sistem opsional)", (q) => ep(DL, "/ai/openai", q));
  aiText("kimi", "Tanya jawab dengan Kimi", (q) => ep(ZZ, "/api/ai/kimi", { query: q.text }));
  aiText("gita", "Tanya jawab ala Bhagavad Gita", (q) => ep(CK, "/api/ai/gita", { apikey: CUKI_KEY, q: q.text }));
  img("ai", "sologo", "Buat logo dari deskripsi", ["prompt"], (q) => ep(NX2, "/ai/sologo", q));
  img("ai", "fluximg", "Buat gambar dari deskripsi dengan Flux", ["prompt"], (q) => ep(YL, "/api/ai/flux-img", q));
  add("ai", "suno", "Buat lagu dari deskripsi (bisa lama, hasilnya link audio)", ["prompt"], async (q) => {
    const d = await call(ep(NX2, "/ai/suno", q));
    const url = findUrl(d);
    if (!url) throw fail("Lagu belum berhasil dibuat", 502);
    return typeof d === "object" ? { ...d, audio: url } : { audio: url };
  }, heavy);
  json("ai", "ytsummary", "Ringkas isi video YouTube", ["url"], (q) => ep(NK, "/tools/yt-summarizer/v2", { url: need(q.url), language: "id" }), (c) => (typeof c === "string" ? { ringkasan: c } : c), heavy);

  /* ================= SEARCH ================= */
  json("search", "applemusic", "Cari lagu di Apple Music", ["q"], (q) => ep(NX, "/search/applemusic", q));
  json("search", "lyrics", "Cari lirik lagu dari judul", ["q"], (q) => ep(NX2, "/search/lyrics", q));
  json("search", "apkpure", "Cari aplikasi di APKPure", ["q"], (q) => ep(NK, "/dsc/apkpure/search", q));
  json("search", "apkcombo", "Cari aplikasi di APKCombo", ["q"], (q) => ep(NK, "/dsc/apkcombo/search", q));
  json("search", "apkzoic", "Cari aplikasi di APKZoic", ["q"], (q) => ep(NK, "/dsc/apkzoic/search", q));
  json("search", "brainly", "Cari jawaban soal di Brainly", ["q"], (q) => ep(NK, "/dsc/brainly/search", q));
  json("search", "bstation", "Cari video di Bstation", ["q"], (q) => ep(NK, "/dsc/bstation/search", q));
  json("search", "tiktoksearch", "Cari video TikTok", ["q"], (q) => ep(AZ, "/api/search/ttsearch", q));

  /* ================= STALK ================= */
  json("stalk", "stalkmlbb", "Info akun Mobile Legends dari ID dan zone", ["id", "zone"], (q) => ep(NX, "/stalker/mlbb", q));
  json("stalk", "stalkgenshin", "Info akun Genshin Impact dari UID", ["id"], (q) => ep(NX2, "/stalker/genshin", q));
  json("stalk", "stalkpinterest", "Profil publik Pinterest", ["username"], (q) => ep(NX2, "/stalker/pinterest", q));
  json("stalk", "stalktiktok", "Profil publik TikTok", ["username"], (q) => ep(DL, "/stalker/ttstalk", q));
  add("stalk", "stalkminecraft", "Profil pemain Minecraft Java (UUID dan skin)", ["username"], async (q) => {
    const name = q.username.trim();
    if (!/^[A-Za-z0-9_]{1,16}$/.test(name)) throw fail("Username Minecraft harus 1 sampai 16 karakter huruf, angka, atau _");
    const r = await rawGet(`https://api.mojang.com/users/profiles/minecraft/${enc(name)}`, 15000);
    if (r.status === 404 || r.status === 204) throw fail("Pemain tidak ditemukan", 404);
    if (!r.ok) throw fail(`Server sumber membalas ${r.status}`, 502);
    const d = await r.json().catch(() => null);
    if (!d?.id) throw fail("Pemain tidak ditemukan", 404);
    return { username: d.name, uuid: d.id, avatar: `https://mc-heads.net/avatar/${d.id}`, badan: `https://mc-heads.net/body/${d.id}`, skin: `https://mc-heads.net/skin/${d.id}` };
  });

  /* ================= INFO dan TOOLS ================= */
  json("info", "cekplat", "Cek wilayah dari plat nomor kendaraan", ["plate"], (q) => ep(NX, "/tools/cekplat", q));
  json("info", "growagarden", "Stok toko Grow a Garden saat ini", [], () => `${NX2}/information/growagarden`);
  json("tools", "webphishing", "Cek apakah sebuah website terindikasi phishing", ["url"], (q) => ep(NX2, "/tools/webphishing", { url: need(q.url) }));
  json("tools", "usernamegen", "Buat ide username acak", [], () => `${NX2}/tools/usernamegen`);
  json("tools", "bitly", "Pendekkan link dengan Bitly", ["url"], (q) => ep(NK, "/tools/shortlink/bitly", { url: need(q.url) }), (c) => (typeof c === "string" ? { short: c } : c));
  add("tools", "winrate", "Hitung berapa kemenangan beruntun untuk mencapai target winrate MLBB", ["total_match", "wr_now", "wr_target"], (q) => {
    const t = parseInt(q.total_match, 10), now = parseFloat(q.wr_now), target = parseFloat(q.wr_target);
    if (![t, now, target].every(Number.isFinite) || t < 1 || now < 0 || now > 100 || target <= 0 || target >= 100) throw fail("total_match harus angka positif, wr_now 0 sampai 100, wr_target di antara 0 dan 100");
    const wins = Math.round((now / 100) * t);
    const perlu = target <= now ? 0 : Math.ceil((target * t - 100 * wins) / (100 - target));
    return { totalMatch: t, winrateSekarang: now, target, menangBeruntunDibutuhkan: perlu, hasilAkhir: +(((wins + perlu) / (t + perlu)) * 100).toFixed(2) };
  });
  add("tools", "ttsid", "Teks jadi suara bahasa Indonesia", ["text"], (q) => media([ep(EM, "/tools/text-to-speech", { text: q.text.slice(0, 300) }), ep(FAA, "/faa/tts-legkap", { text: q.text.slice(0, 300) })], "audio"), AUD);

  /* ================= DOWNLOAD dan MUSIK ================= */
  json("download", "tiktokv2", "Download TikTok (cadangan, provider kedua)", ["url"], (q) => ep(YL, "/api/downloader/tiktok", { url: need(q.url) }), null, heavy);
  json("download", "douyin", "Download video Douyin", ["url"], (q) => ep(AZ, "/api/downloader/douyin", { url: need(q.url) }), null, heavy);
  json("download", "pinterestdl", "Download gambar atau video dari link Pinterest", ["url"], (q) => ep(AZ, "/api/download/pinterest", { url: need(q.url) }), null, heavy);
  json("download", "spotifydl", "Download lagu dari link Spotify", ["url"], (q) => ep(NX2, "/downloader/spotify", { url: need(q.url) }), null, heavy);
  json("music", "ytplay", "Audio YouTube dari link video", ["url"], (q) => ep(FAA, "/faa/ytplay", { url: need(q.url) }), null, heavy);
};
