// Endpoint tambahan. Semuanya langsung aktif: tanpa API key dan tanpa PROVIDER_URL.
// Kategori "utility" dan "islami" diproses di server sendiri, sisanya memakai API publik gratis.
const crypto = require("crypto");

module.exports = ({ add, json, get, fail, enc, isUrl, esc, hex }) => {
  const num = (v, d, min, max) => {
    const n = parseFloat(v);
    return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : d;
  };

  /* ---------- Utility (diproses di server, tanpa pihak ketiga) ---------- */
  add("utility", "base64", "Encode atau decode Base64 (mode: encode/decode)", ["text", "mode?"], (q) => {
    const dec = (q.mode || "encode").toLowerCase() === "decode";
    return { mode: dec ? "decode" : "encode", hasil: dec ? Buffer.from(q.text, "base64").toString("utf8") : Buffer.from(q.text, "utf8").toString("base64") };
  });

  add("utility", "hash", "Hash teks (algo: md5, sha1, sha256, sha512)", ["text", "algo?"], (q) => {
    const algo = (q.algo || "sha256").toLowerCase();
    if (!["md5", "sha1", "sha256", "sha512"].includes(algo)) throw fail("algo harus md5, sha1, sha256, atau sha512");
    return { algo, hasil: crypto.createHash(algo).update(q.text).digest("hex") };
  });

  add("utility", "uuid", "Buat UUID v4 acak", [], () => ({ uuid: crypto.randomUUID() }));

  add("utility", "password", "Buat password acak (panjang 8-64, simbol=1 untuk memakai simbol)", ["panjang?", "simbol?"], (q) => {
    const n = Math.round(num(q.panjang, 16, 8, 64));
    const set = "abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789" + (q.simbol === "1" ? "!@#$%^&*-_=+?" : "");
    let out = "";
    for (let i = 0; i < n; i++) out += set[crypto.randomInt(set.length)];
    return { panjang: n, password: out };
  });

  add("utility", "random", "Angka acak dalam rentang (default 1 sampai 100)", ["min?", "max?"], (q) => {
    const a = Math.round(num(q.min, 1, -1e9, 1e9));
    const b = Math.round(num(q.max, 100, -1e9, 1e9));
    const [lo, hi] = a <= b ? [a, b] : [b, a];
    return { min: lo, max: hi, hasil: crypto.randomInt(lo, hi + 1) };
  });

  add("utility", "pilih", "Pilih satu dari beberapa opsi, pisahkan dengan koma", ["opsi"], (q) => {
    const o = q.opsi.split(",").map((s) => s.trim()).filter(Boolean);
    if (o.length < 2) throw fail("Isi minimal 2 opsi, pisahkan dengan koma");
    return { opsi: o, dipilih: o[crypto.randomInt(o.length)] };
  });

  add("utility", "dadu", "Lempar dadu (jumlah 1-10, sisi 2-100)", ["jumlah?", "sisi?"], (q) => {
    const n = Math.round(num(q.jumlah, 1, 1, 10));
    const s = Math.round(num(q.sisi, 6, 2, 100));
    const hasil = Array.from({ length: n }, () => crypto.randomInt(1, s + 1));
    return { jumlah: n, sisi: s, hasil, total: hasil.reduce((x, y) => x + y, 0) };
  });

  add("utility", "koin", "Lempar koin", [], () => ({ hasil: crypto.randomInt(2) ? "Gambar" : "Angka" }));

  add("utility", "kalkulator", "Hitung ekspresi matematika sederhana, contoh: (12+3)*4/2", ["expr"], (q) => {
    const e = q.expr.replace(/\s+/g, "").replace(/,/g, ".").replace(/\^/g, "**");
    if (!/^[0-9+\-*/().%]+$/.test(e) || e.length > 200) throw fail("Ekspresi hanya boleh berisi angka dan operator + - * / % ^ ( )");
    let r;
    try { r = Function(`"use strict";return (${e})`)(); } catch { throw fail("Ekspresi tidak valid"); }
    if (typeof r !== "number" || !Number.isFinite(r)) throw fail("Hasil tidak valid");
    return { ekspresi: q.expr, hasil: r };
  });

  add("utility", "bmi", "Hitung BMI dari berat (kg) dan tinggi (cm)", ["berat", "tinggi"], (q) => {
    const w = parseFloat(q.berat), h = parseFloat(q.tinggi) / 100;
    if (!(w > 0 && w < 500 && h > 0.5 && h < 2.8)) throw fail("berat (kg) atau tinggi (cm) tidak masuk akal");
    const bmi = w / (h * h);
    const kat = bmi < 18.5 ? "Kurus" : bmi < 25 ? "Normal" : bmi < 30 ? "Gemuk" : "Obesitas";
    return { bmi: +bmi.toFixed(1), kategori: kat };
  });

  add("utility", "umur", "Hitung umur dari tanggal lahir (format YYYY-MM-DD)", ["tanggal"], (q) => {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(q.tanggal);
    const b = m && new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
    if (!b || isNaN(b) || b.getUTCMonth() !== +m[2] - 1) throw fail("Format tanggal harus YYYY-MM-DD");
    const n = new Date();
    if (b > n) throw fail("Tanggal lahir tidak boleh di masa depan");
    let th = n.getUTCFullYear() - b.getUTCFullYear(), bl = n.getUTCMonth() - b.getUTCMonth(), hr = n.getUTCDate() - b.getUTCDate();
    if (hr < 0) { bl--; hr += new Date(Date.UTC(n.getUTCFullYear(), n.getUTCMonth(), 0)).getUTCDate(); }
    if (bl < 0) { th--; bl += 12; }
    let next = new Date(Date.UTC(n.getUTCFullYear(), b.getUTCMonth(), b.getUTCDate()));
    if (next < new Date(Date.UTC(n.getUTCFullYear(), n.getUTCMonth(), n.getUTCDate()))) next = new Date(Date.UTC(n.getUTCFullYear() + 1, b.getUTCMonth(), b.getUTCDate()));
    return { tahun: th, bulan: bl, hari: hr, totalHari: Math.floor((n - b) / 864e5), ulangTahunBerikutnyaHari: Math.ceil((next - n) / 864e5) };
  });

  add("utility", "zodiak", "Cari zodiak dari tanggal lahir (format YYYY-MM-DD)", ["tanggal"], (q) => {
    const m = /^\d{4}-(\d{2})-(\d{2})$/.exec(q.tanggal);
    if (!m) throw fail("Format tanggal harus YYYY-MM-DD");
    const v = +m[1] * 100 + +m[2];
    const z = [[120, "Capricorn"], [219, "Aquarius"], [321, "Pisces"], [420, "Aries"], [521, "Taurus"], [621, "Gemini"], [723, "Cancer"], [823, "Leo"], [923, "Virgo"], [1023, "Libra"], [1122, "Scorpio"], [1222, "Sagitarius"], [1232, "Capricorn"]];
    return { zodiak: z.find(([lim]) => v < lim)[1] };
  });

  add("utility", "morse", "Teks ke kode Morse atau sebaliknya (mode: encode/decode)", ["text", "mode?"], (q) => {
    const M = { a: ".-", b: "-...", c: "-.-.", d: "-..", e: ".", f: "..-.", g: "--.", h: "....", i: "..", j: ".---", k: "-.-", l: ".-..", m: "--", n: "-.", o: "---", p: ".--.", q: "--.-", r: ".-.", s: "...", t: "-", u: "..-", v: "...-", w: ".--", x: "-..-", y: "-.--", z: "--..", 0: "-----", 1: ".----", 2: "..---", 3: "...--", 4: "....-", 5: ".....", 6: "-....", 7: "--...", 8: "---..", 9: "----." };
    if ((q.mode || "encode").toLowerCase() === "decode") {
      const R = Object.fromEntries(Object.entries(M).map(([k, v]) => [v, k]));
      return { hasil: q.text.trim().split(/\s*\/\s*/).map((w) => w.split(/\s+/).map((c) => R[c] || "?").join("")).join(" ") };
    }
    return { hasil: q.text.toLowerCase().split(/\s+/).map((w) => [...w].map((c) => M[c]).filter(Boolean).join(" ")).join(" / ") };
  });

  add("utility", "binary", "Teks ke biner atau sebaliknya (mode: encode/decode)", ["text", "mode?"], (q) => {
    if ((q.mode || "encode").toLowerCase() === "decode") {
      const bytes = q.text.trim().split(/\s+/);
      if (!bytes.every((b) => /^[01]{1,8}$/.test(b))) throw fail("Biner harus berupa kelompok 0 dan 1 dipisah spasi");
      return { hasil: Buffer.from(bytes.map((b) => parseInt(b, 2))).toString("utf8") };
    }
    return { hasil: [...Buffer.from(q.text, "utf8")].map((b) => b.toString(2).padStart(8, "0")).join(" ") };
  });

  add("utility", "teks", "Ubah teks (mode: upper, lower, title, reverse, slug, alay)", ["text", "mode"], (q) => {
    const m = q.mode.toLowerCase();
    const f = {
      upper: (s) => s.toUpperCase(),
      lower: (s) => s.toLowerCase(),
      title: (s) => s.toLowerCase().replace(/(^|\s)\S/g, (c) => c.toUpperCase()),
      reverse: (s) => [...s].reverse().join(""),
      slug: (s) => s.toLowerCase().normalize("NFKD").replace(/[^\w\s-]/g, "").trim().replace(/[\s_-]+/g, "-"),
      alay: (s) => [...s].map((c, i) => (i % 2 ? c.toLowerCase() : c.toUpperCase())).join(""),
    }[m];
    if (!f) throw fail("mode harus upper, lower, title, reverse, slug, atau alay");
    return { mode: m, hasil: f(q.text) };
  });

  add("utility", "hitungkata", "Hitung kata, karakter, dan kalimat dalam teks", ["text"], (q) => ({
    karakter: q.text.length,
    karakterTanpaSpasi: q.text.replace(/\s/g, "").length,
    kata: (q.text.trim().match(/\S+/g) || []).length,
    kalimat: (q.text.match(/[^.!?]+[.!?]*/g) || []).filter((s) => s.trim()).length,
  }));

  add("utility", "warna", "Info warna dari kode hex tanpa # (RGB, HSL)", ["hex"], (q) => {
    let h = q.hex.replace(/^#/, "");
    if (/^[0-9a-f]{3}$/i.test(h)) h = [...h].map((c) => c + c).join("");
    if (!/^[0-9a-f]{6}$/i.test(h)) throw fail("hex harus 3 atau 6 digit, contoh: ff8800");
    const [r, g, b] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
    const mx = Math.max(r, g, b) / 255, mn = Math.min(r, g, b) / 255, l = (mx + mn) / 2, d = mx - mn;
    const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
    const R = r / 255, G = g / 255, B = b / 255;
    let hue = d === 0 ? 0 : mx === R ? ((G - B) / d) % 6 : mx === G ? (B - R) / d + 2 : (R - G) / d + 4;
    hue = Math.round((hue * 60 + 360) % 360);
    return { hex: `#${h.toLowerCase()}`, rgb: `rgb(${r}, ${g}, ${b})`, hsl: `hsl(${hue}, ${Math.round(s * 100)}%, ${Math.round(l * 100)}%)`, gambar: `/api/image/warnaimg?hex=${h}` };
  });

  add("utility", "terbilang", "Angka jadi tulisan bahasa Indonesia (maks 999 triliun)", ["angka"], (q) => {
    const n = Math.floor(Number(q.angka));
    if (!Number.isFinite(n) || n < 0 || n > 999999999999999) throw fail("angka harus antara 0 dan 999999999999999");
    const sat = ["", "satu", "dua", "tiga", "empat", "lima", "enam", "tujuh", "delapan", "sembilan", "sepuluh", "sebelas"];
    const t = (x) => {
      if (x < 12) return sat[x];
      if (x < 20) return t(x - 10) + " belas";
      if (x < 100) return (t(Math.floor(x / 10)) + " puluh " + t(x % 10)).trim();
      if (x < 200) return ("seratus " + t(x - 100)).trim();
      if (x < 1000) return (t(Math.floor(x / 100)) + " ratus " + t(x % 100)).trim();
      if (x < 2000) return ("seribu " + t(x - 1000)).trim();
      if (x < 1e6) return (t(Math.floor(x / 1000)) + " ribu " + t(x % 1000)).trim();
      if (x < 1e9) return (t(Math.floor(x / 1e6)) + " juta " + t(x % 1e6)).trim();
      if (x < 1e12) return (t(Math.floor(x / 1e9)) + " miliar " + t(x % 1e9)).trim();
      return (t(Math.floor(x / 1e12)) + " triliun " + t(x % 1e12)).trim();
    };
    return { angka: n, terbilang: n === 0 ? "nol" : t(n).replace(/\s+/g, " ") };
  });

  add("utility", "romawi", "Angka (1-3999) ke angka Romawi", ["angka"], (q) => {
    let n = parseInt(q.angka, 10);
    if (!(n >= 1 && n <= 3999)) throw fail("angka harus 1 sampai 3999");
    const m = [[1000, "M"], [900, "CM"], [500, "D"], [400, "CD"], [100, "C"], [90, "XC"], [50, "L"], [40, "XL"], [10, "X"], [9, "IX"], [5, "V"], [4, "IV"], [1, "I"]];
    let o = "";
    for (const [v, s] of m) while (n >= v) { o += s; n -= v; }
    return { romawi: o };
  });

  add("utility", "waktu", "Waktu sekarang di zona waktu tertentu (default Asia/Jakarta)", ["zona?"], (q) => {
    const tz = q.zona || "Asia/Jakarta";
    let f;
    try { f = new Intl.DateTimeFormat("id-ID", { timeZone: tz, dateStyle: "full", timeStyle: "long" }).format(new Date()); }
    catch { throw fail("Zona waktu tidak dikenal, contoh: Asia/Jakarta, Asia/Makassar, UTC, America/New_York"); }
    return { zona: tz, waktu: f, iso: new Date().toISOString() };
  });

  add("utility", "headers", "Cek status dan header HTTP sebuah website", ["url"], async (q) => {
    if (!isUrl(q.url)) throw fail("url harus diawali http:// atau https://");
    const host = new URL(q.url).hostname.toLowerCase();
    if (host === "localhost" || host.endsWith(".local") || host.endsWith(".internal") || /^(\[|127\.|10\.|0\.|169\.254\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(host) || !host.includes(".")) throw fail("Alamat internal tidak diizinkan");
    const r = await fetch(q.url, { method: "HEAD", redirect: "manual", signal: AbortSignal.timeout(10000), headers: { "user-agent": "rijal-rest-api/1.0" } });
    return { status: r.status, lokasiRedirect: r.headers.get("location"), server: r.headers.get("server"), tipe: r.headers.get("content-type"), header: Object.fromEntries(r.headers) };
  });

  add("utility", "dns", "Cek DNS record domain (tipe: A, AAAA, MX, TXT, NS, CNAME)", ["domain", "tipe?"], async (q) => {
    const tipe = (q.tipe || "A").toUpperCase();
    if (!["A", "AAAA", "MX", "TXT", "NS", "CNAME"].includes(tipe)) throw fail("tipe harus A, AAAA, MX, TXT, NS, atau CNAME");
    const d = await json(`https://cloudflare-dns.com/dns-query?name=${enc(q.domain)}&type=${tipe}`, { headers: { accept: "application/dns-json" } });
    return { domain: q.domain, tipe, status: d.Status === 0 ? "OK" : d.Status === 3 ? "Domain tidak ada" : `Kode ${d.Status}`, jawaban: (d.Answer || []).map((a) => ({ nama: a.name, ttl: a.TTL, data: a.data })) };
  });

  /* ---------- Islami ---------- */
  add("islami", "asmaulhusna", "99 Asmaul Husna (opsional nomor 1-99)", ["no?"], async (q) => {
    const d = (await json("https://api.aladhan.com/v1/asmaAlHusna")).data;
    const rows = d.map((a) => ({ no: a.number, arab: a.name, latin: a.transliteration, arti: a.en.meaning }));
    if (q.no) {
      const r = rows.find((x) => x.no === parseInt(q.no, 10));
      if (!r) throw fail("no harus 1 sampai 99", 404);
      return r;
    }
    return rows;
  });

  add("islami", "surah", "Daftar 114 surah, atau info satu surah", ["no?"], async (q) => {
    if (q.no) {
      const n = parseInt(q.no, 10);
      if (!(n >= 1 && n <= 114)) throw fail("no harus 1 sampai 114");
      const d = (await json(`https://api.alquran.cloud/v1/surah/${n}`)).data;
      return { no: d.number, arab: d.name, latin: d.englishName, arti: d.englishNameTranslation, jumlahAyat: d.numberOfAyahs, turun: d.revelationType };
    }
    const d = (await json("https://api.alquran.cloud/v1/surah")).data;
    return d.map((s) => ({ no: s.number, arab: s.name, latin: s.englishName, jumlahAyat: s.numberOfAyahs, turun: s.revelationType }));
  });

  add("islami", "ayatacak", "Ayat Al-Quran acak dengan terjemahan Indonesia", [], async () => {
    const n = crypto.randomInt(1, 6237);
    const [ar, id] = (await json(`https://api.alquran.cloud/v1/ayah/${n}/editions/quran-uthmani,id.indonesian`)).data;
    return { surah: ar.surah.englishName, namaArab: ar.surah.name, ayat: ar.numberInSurah, arab: ar.text, arti: id.text };
  });

  add("islami", "kalender", "Konversi tanggal Masehi ke Hijriah (format DD-MM-YYYY, default hari ini)", ["tanggal?"], async (q) => {
    const t = q.tanggal || new Date().toLocaleDateString("en-GB", { timeZone: "Asia/Jakarta" }).replace(/\//g, "-");
    if (!/^\d{2}-\d{2}-\d{4}$/.test(t)) throw fail("Format tanggal harus DD-MM-YYYY");
    const d = (await json(`https://api.aladhan.com/v1/gToH/${t}`)).data;
    return { masehi: t, hijriah: `${d.hijri.day} ${d.hijri.month.en} ${d.hijri.year} H`, hari: d.hijri.weekday.en };
  });

  /* ---------- Info tambahan ---------- */
  add("info", "gempaterkini", "15 gempa M 5.0+ terbaru dari BMKG", [], async () => (await json("https://data.bmkg.go.id/DataMKG/TEWS/gempaterkini.json")).Infogempa.gempa);

  add("info", "gempadirasakan", "15 gempa yang dirasakan terbaru dari BMKG", [], async () => (await json("https://data.bmkg.go.id/DataMKG/TEWS/gempadirasakan.json")).Infogempa.gempa);

  add("info", "prakiraan", "Prakiraan cuaca 3 hari ke depan untuk sebuah kota", ["kota"], async (q) => {
    const g = (await json(`https://geocoding-api.open-meteo.com/v1/search?name=${enc(q.kota)}&count=1&language=id`)).results?.[0];
    if (!g) throw fail("Kota tidak ditemukan", 404);
    const d = (await json(`https://api.open-meteo.com/v1/forecast?latitude=${g.latitude}&longitude=${g.longitude}&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max&forecast_days=3&timezone=auto`)).daily;
    const k = (c) => (c === 0 ? "Cerah" : c <= 3 ? "Berawan" : c <= 48 ? "Berkabut" : c <= 67 ? "Hujan" : c <= 77 ? "Salju" : c <= 82 ? "Hujan deras" : c <= 86 ? "Salju" : "Badai petir");
    return { kota: g.name, negara: g.country, hari: d.time.map((t, i) => ({ tanggal: t, cuaca: k(d.weather_code[i]), suhuMinC: d.temperature_2m_min[i], suhuMaxC: d.temperature_2m_max[i], peluangHujanPersen: d.precipitation_probability_max[i] })) };
  });

  add("info", "libur", "Hari libur nasional Indonesia (default tahun ini)", ["tahun?"], async (q) => {
    const y = parseInt(q.tahun, 10) || new Date().getFullYear();
    const d = await json(`https://date.nager.at/api/v3/PublicHolidays/${y}/ID`);
    return d.map((h) => ({ tanggal: h.date, nama: h.localName, english: h.name }));
  });

  add("info", "negara", "Info negara (nama atau kode negara)", ["nama"], async (q) => {
    const d = (await json(`https://restcountries.com/v3.1/name/${enc(q.nama)}?fields=name,capital,region,subregion,population,area,languages,currencies,flags,cca2,timezones`))[0];
    return { nama: d.name.common, resmi: d.name.official, kode: d.cca2, ibukota: d.capital, wilayah: d.region, subwilayah: d.subregion, populasi: d.population, luasKm2: d.area, bahasa: d.languages, mataUang: d.currencies, zonaWaktu: d.timezones, bendera: d.flags?.png };
  });

  add("info", "crypto", "Harga kripto (id coingecko, contoh: bitcoin) dalam IDR dan USD", ["coin"], async (q) => {
    const id = q.coin.toLowerCase();
    const d = await json(`https://api.coingecko.com/api/v3/simple/price?ids=${enc(id)}&vs_currencies=idr,usd&include_24hr_change=true`);
    if (!d[id]) throw fail("Koin tidak ditemukan. Pakai id coingecko, contoh: bitcoin, ethereum, solana", 404);
    return { coin: id, idr: d[id].idr, usd: d[id].usd, perubahan24jamPersenUsd: d[id].usd_24h_change };
  });

  add("info", "kamus", "Arti kata bahasa Inggris (definisi dan contoh)", ["kata"], async (q) => {
    const d = (await json(`https://api.dictionaryapi.dev/api/v2/entries/en/${enc(q.kata)}`))[0];
    return { kata: d.word, fonetik: d.phonetic, arti: d.meanings.map((m) => ({ jenis: m.partOfSpeech, definisi: m.definitions.slice(0, 3).map((x) => ({ arti: x.definition, contoh: x.example || null })) })) };
  });

  add("info", "provinsi", "Daftar provinsi di Indonesia (data Emsifa)", [], async () => json("https://emsifa.github.io/api-wilayah-indonesia/api/provinces.json"));

  add("info", "kabupaten", "Daftar kabupaten/kota dari id provinsi (lihat /api/info/provinsi)", ["id"], async (q) => {
    if (!/^\d{1,2}$/.test(q.id)) throw fail("id provinsi harus angka, contoh: 32");
    return json(`https://emsifa.github.io/api-wilayah-indonesia/api/regencies/${q.id}.json`);
  });

  /* ---------- Pencarian tambahan ---------- */
  add("search", "wikipediaen", "Ringkasan artikel Wikipedia bahasa Inggris", ["q"], async (q) => {
    const d = await json(`https://en.wikipedia.org/api/rest_v1/page/summary/${enc(q.q)}`);
    return { judul: d.title, ringkasan: d.extract, gambar: d.thumbnail?.source || null, url: d.content_urls?.desktop?.page };
  });

  add("search", "pokemon", "Info Pokemon (nama atau nomor)", ["nama"], async (q) => {
    const d = await json(`https://pokeapi.co/api/v2/pokemon/${enc(q.nama.toLowerCase())}`);
    return { id: d.id, nama: d.name, tinggiM: d.height / 10, beratKg: d.weight / 10, tipe: d.types.map((t) => t.type.name), kemampuan: d.abilities.map((a) => a.ability.name), stat: Object.fromEntries(d.stats.map((s) => [s.stat.name, s.base_stat])), gambar: d.sprites.other?.["official-artwork"]?.front_default || d.sprites.front_default };
  });

  add("search", "film", "Cari film dan serial (data TVMaze)", ["q"], async (q) => {
    const d = await json(`https://api.tvmaze.com/search/shows?q=${enc(q.q)}`);
    return d.slice(0, 5).map(({ show: s }) => ({ judul: s.name, tipe: s.type, bahasa: s.language, genre: s.genres, skor: s.rating?.average, tayang: s.premiered, status: s.status, sinopsis: (s.summary || "").replace(/<[^>]+>/g, ""), gambar: s.image?.original || null, url: s.url }));
  });

  add("search", "manga", "Cari manga", ["q"], async (q) => {
    const d = await json(`https://api.jikan.moe/v4/manga?q=${enc(q.q)}&limit=5`);
    return d.data.map((a) => ({ judul: a.title, tipe: a.type, chapter: a.chapters, skor: a.score, status: a.status, sinopsis: a.synopsis, gambar: a.images?.jpg?.image_url, url: a.url }));
  });

  add("search", "animerandom", "Anime acak lengkap dengan sinopsis", [], async () => {
    const a = (await json("https://api.jikan.moe/v4/random/anime")).data;
    return { judul: a.title, tipe: a.type, episode: a.episodes, skor: a.score, sinopsis: a.synopsis, gambar: a.images?.jpg?.image_url, url: a.url };
  });

  add("search", "buku", "Cari buku (Open Library)", ["q"], async (q) => {
    const d = await json(`https://openlibrary.org/search.json?q=${enc(q.q)}&limit=5&fields=title,author_name,first_publish_year,cover_i,key`);
    return d.docs.map((b) => ({ judul: b.title, penulis: b.author_name, tahun: b.first_publish_year, sampul: b.cover_i ? `https://covers.openlibrary.org/b/id/${b.cover_i}-L.jpg` : null, url: `https://openlibrary.org${b.key}` }));
  });

  /* ---------- Profil tambahan ---------- */
  add("stalk", "stalkrepo", "Info repo GitHub (format owner/nama)", ["repo"], async (q) => {
    if (!/^[\w.-]+\/[\w.-]+$/.test(q.repo)) throw fail("repo harus berformat owner/nama, contoh: expressjs/express");
    const d = await json(`https://api.github.com/repos/${q.repo}`);
    return { nama: d.full_name, deskripsi: d.description, bintang: d.stargazers_count, fork: d.forks_count, isuTerbuka: d.open_issues_count, bahasa: d.language, lisensi: d.license?.spdx_id, diperbarui: d.pushed_at, url: d.html_url };
  });

  add("stalk", "stalkpypi", "Info paket Python di PyPI", ["name"], async (q) => {
    const d = (await json(`https://pypi.org/pypi/${enc(q.name)}/json`)).info;
    return { nama: d.name, versi: d.version, ringkasan: d.summary, penulis: d.author, lisensi: d.license, python: d.requires_python, url: d.package_url };
  });

  add("stalk", "tebakumur", "Tebak umur, gender, dan negara dari sebuah nama depan", ["nama"], async (q) => {
    const [a, g, n] = await Promise.all([
      json(`https://api.agify.io/?name=${enc(q.nama)}`),
      json(`https://api.genderize.io/?name=${enc(q.nama)}`),
      json(`https://api.nationalize.io/?name=${enc(q.nama)}`),
    ]);
    return { nama: q.nama, perkiraanUmur: a.age, gender: g.gender, peluangGender: g.probability, negara: (n.country || []).slice(0, 3).map((c) => ({ kode: c.country_id, peluang: +c.probability.toFixed(2) })) };
  });

  /* ---------- Gambar (dibuat di server atau diarahkan ke layanan gratis) ---------- */
  add("image", "warnaimg", "Gambar warna polos dari hex tanpa #", ["hex"], (q) => ({
    svg: `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400"><rect width="400" height="400" fill="${hex(q.hex, "#000000")}"/></svg>`,
  }), { out: "image" });

  add("image", "avatar", "Avatar unik dari sebuah nama (style: initials, bottts, pixel-art, adventurer, fun-emoji)", ["nama", "style?"], (q) => {
    const s = ["initials", "bottts", "pixel-art", "adventurer", "fun-emoji", "identicon", "thumbs"].includes(q.style) ? q.style : "initials";
    return { redirect: `https://api.dicebear.com/9.x/${s}/png?size=512&seed=${enc(q.nama)}` };
  }, { out: "image" });

  add("image", "barcode", "Buat barcode dari teks", ["text"], (q) => ({
    redirect: `https://bwipjs-api.metafloor.com/?bcid=code128&text=${enc(q.text)}&scale=3&includetext`,
  }), { out: "image" });

  add("image", "placeholder", "Gambar placeholder (lebar, tinggi, teks)", ["w?", "h?", "text?"], (q) => {
    const w = Math.round(num(q.w, 600, 16, 2000)), h = Math.round(num(q.h, 400, 16, 2000));
    const t = esc((q.text || `${w}x${h}`).slice(0, 60));
    const fs = Math.max(12, Math.min(w, h) / 6);
    return {
      svg: `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><rect width="100%" height="100%" fill="#cbd5e1"/><text x="50%" y="50%" font-family="Arial,sans-serif" font-size="${fs}" fill="#475569" text-anchor="middle" dominant-baseline="middle">${t}</text></svg>`,
    };
  }, { out: "image" });

  add("image", "randomfoto", "Foto acak (lebar dan tinggi opsional)", ["w?", "h?"], (q) => ({
    redirect: `https://picsum.photos/${Math.round(num(q.w, 800, 50, 3000))}/${Math.round(num(q.h, 600, 50, 3000))}`,
  }), { out: "image" });

  add("image", "kucing", "Foto kucing acak", [], () => ({ redirect: `https://cataas.com/cat?t=${Date.now()}` }), { out: "image" });

  add("image", "anjing", "Foto anjing acak", [], async () => {
    const d = await json("https://dog.ceo/api/breeds/image/random");
    return { redirect: d.message };
  }, { out: "image" });

  add("image", "memegen", "Buat meme dari template (template: drake, doge, buzz, success, fry, dll)", ["template", "atas", "bawah?"], (q) => {
    const seg = (s) => !s ? "_" : enc((s).replace(/_/g, "__").replace(/-/g, "--").replace(/\s/g, "_").replace(/\?/g, "~q").replace(/%/g, "~p").replace(/#/g, "~h").replace(/\//g, "~s"));
    if (!/^[\w-]+$/.test(q.template)) throw fail("template tidak valid");
    return { redirect: `https://api.memegen.link/images/${q.template}/${seg(q.atas)}/${seg(q.bawah)}.png` };
  }, { out: "image" });

  add("maker", "attp", "Teks warna-warni bergerak (animasi SVG)", ["text"], (q) => {
    const t = esc(q.text.slice(0, 40));
    const cols = ["#ff3b30", "#ff9500", "#ffcc00", "#34c759", "#00c7be", "#007aff", "#af52de"];
    const size = Math.max(24, Math.min(140, Math.floor(480 / Math.max(t.length * 0.62, 1))));
    const texts = cols.map((c, i) => `<text x="256" y="256" font-family="Arial Black,Arial,sans-serif" font-weight="900" font-size="${size}" fill="${c}" text-anchor="middle" dominant-baseline="middle" opacity="0"><animate attributeName="opacity" values="${cols.map((_, j) => (j === i ? 1 : 0)).join(";")}" dur="${cols.length * 0.25}s" calcMode="discrete" repeatCount="indefinite"/>${t}</text>`).join("");
    return { svg: `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512"><rect width="512" height="512" fill="#111"/>${texts}</svg>` };
  }, { out: "image" });

  add("maker", "quotemaker", "Gambar kutipan dengan nama penulis", ["text", "author?"], (q) => {
    const words = q.text.slice(0, 220).split(/\s+/);
    const lines = [];
    let cur = "";
    for (const w of words) { if (cur && (cur + " " + w).length > 26) { lines.push(cur); cur = w; } else cur = cur ? cur + " " + w : w; }
    if (cur) lines.push(cur);
    const fs = lines.length > 6 ? 26 : 34;
    const y0 = 256 - ((lines.length - 1) * fs * 1.3) / 2;
    const body = lines.map((l, i) => `<tspan x="256" y="${y0 + i * fs * 1.3}">${esc(l)}</tspan>`).join("");
    const au = q.author ? `<text x="256" y="${Math.min(470, y0 + lines.length * fs * 1.3 + 30)}" font-family="Georgia,serif" font-size="22" fill="#9ca3af" text-anchor="middle">- ${esc(q.author.slice(0, 40))}</text>` : "";
    return { svg: `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512"><rect width="512" height="512" fill="#0f172a"/><text x="30" y="80" font-family="Georgia,serif" font-size="90" fill="#334155">&#8220;</text><text font-family="Georgia,serif" font-size="${fs}" fill="#f8fafc" text-anchor="middle">${body}</text>${au}</svg>` };
  }, { out: "image" });

  /* ---------- Hiburan tambahan ---------- */
  add("fun", "faktakucing", "Fakta acak tentang kucing", [], async () => ({ fakta: (await json("https://catfact.ninja/fact")).fact }));

  add("fun", "saran", "Saran acak (bahasa Inggris)", [], async () => ({ saran: (await json("https://api.adviceslip.com/advice")).slip.advice }));

  add("fun", "faktaacak", "Fakta acak (bahasa Inggris)", [], async () => ({ fakta: (await json("https://uselessfacts.jsph.pl/api/v2/facts/random?language=en")).text }));

  add("fun", "bucin", "Gombalan acak bahasa Indonesia", [], () => {
    const k = ["Kamu itu kayak WiFi, tanpa kamu hidupku lemot.", "Bukan kopi yang bikin aku melek, tapi mikirin kamu.", "Kamu kalkulator ya? Soalnya cuma kamu yang bisa bikin hatiku berhitung.", "Kalau kamu jadi HP, aku rela jadi charger-nya.", "Aku bukan fotografer, tapi aku bisa membayangkan kita berdua.", "Kamu tahu bedanya kamu sama sinyal? Sinyal bisa hilang, kamu nggak pernah hilang dari pikiranku.", "Jangan jadi hujan kalau cuma bikin aku basah kangen.", "Kamu Google ya? Soalnya semua yang kucari ada di kamu."];
    return { gombal: k[crypto.randomInt(k.length)] };
  });

  add("fun", "truthdare", "Pertanyaan atau tantangan acak (tipe: truth/dare)", ["tipe?"], (q) => {
    const T = ["Siapa orang yang paling sering kamu stalking?", "Apa hal paling memalukan yang pernah kamu alami?", "Kapan terakhir kali kamu berbohong, dan soal apa?", "Siapa mantan yang paling susah dilupakan?", "Aplikasi apa yang paling sering kamu buka diam-diam?"];
    const D = ["Kirim voice note menyanyikan lagu anak-anak.", "Ganti foto profil dengan foto lucu selama 1 jam.", "Chat orang terakhir di kontakmu dengan kata 'halo ganteng/cantik'.", "Ceritakan lelucon terburuk yang kamu tahu.", "Tirukan suara hewan pilihan grup."];
    const tipe = (q.tipe || (crypto.randomInt(2) ? "truth" : "dare")).toLowerCase();
    if (!["truth", "dare"].includes(tipe)) throw fail("tipe harus truth atau dare");
    const src = tipe === "truth" ? T : D;
    return { tipe, hasil: src[crypto.randomInt(src.length)] };
  });
};
