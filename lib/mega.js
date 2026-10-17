// Ratusan endpoint tambahan yang diproses sepenuhnya di server sendiri.
// Tanpa pihak ketiga dan tanpa internet, jadi semuanya selalu aktif dan aman dipakai bot kapan saja.
// Semua menerima GET (query) maupun POST (JSON atau form).

const crypto = require("crypto");

const pick = (a) => a[Math.floor(Math.random() * a.length)];
const seed = (s) => {
  let h = 2166136261;
  for (const c of String(s).toLowerCase().trim()) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return (h >>> 0) / 4294967296;
};
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" }[c]));

module.exports = ({ add: rawAdd, fail }) => {
  // Lewati nama ganda dengan tenang supaya satu nama bentrok tidak mematikan seluruh server.
  const add = (...a) => { try { rawAdd(...a); } catch (e) { if (!/ganda/i.test(e.message)) throw e; } };
  const num = (v, name = "nilai") => {
    const n = Number(String(v).trim().replace(",", "."));
    if (!Number.isFinite(n)) throw fail(`${name} harus berupa angka`);
    return n;
  };
  const int = (v, name, min, max) => {
    const n = num(v, name);
    if (!Number.isInteger(n) || n < min || n > max) throw fail(`${name} harus bilangan bulat ${min} sampai ${max}`);
    return n;
  };
  const round = (n, d = 8) => (n !== 0 && Math.abs(n) < 1e-6 ? Number(Number(n).toPrecision(6)) : Number(Number(n).toFixed(d)));
  const items = (v) => String(v).split(/[\n,;]+/).map((s) => s.trim()).filter(Boolean);
  const nums = (v) => {
    const a = items(v).map((x) => num(x, "daftar"));
    if (!a.length) throw fail("daftar angka kosong");
    if (a.length > 200) throw fail("daftar maksimal 200 angka");
    return a;
  };

  /* =============== KONVERSI SATUAN (300 endpoint) =============== */
  const UNITS = {
    panjang: { mm: 0.001, cm: 0.01, m: 1, km: 1000, inci: 0.0254, kaki: 0.3048, yard: 0.9144, mil: 1609.344 },
    massa: { mg: 1e-6, g: 0.001, kg: 1, ton: 1000, ons: 0.028349523125, pon: 0.45359237 },
    volume: { ml: 0.001, l: 1, galon: 3.785411784, kuart: 0.946352946, cangkir: 0.2365882365, floz: 0.0295735295625, sdm: 0.01478676478125, sdt: 0.00492892159375 },
    luas: { cm2: 1e-4, m2: 1, km2: 1e6, ha: 1e4, acre: 4046.8564224, kaki2: 0.09290304 },
    kecepatan: { ms: 1, kmh: 1 / 3.6, mph: 0.44704, knot: 1852 / 3600 },
    data: { bit: 0.125, byte: 1, kb: 1024, mb: 1048576, gb: 1073741824, tb: 1099511627776 },
    waktu: { detik: 1, menit: 60, jam: 3600, hari: 86400, minggu: 604800, tahun: 31536000 },
    energi: { joule: 1, kj: 1000, kal: 4.184, kkal: 4184, wh: 3600, kwh: 3.6e6 },
    tekanan: { pa: 1, kpa: 1000, bar: 1e5, atm: 101325, psi: 6894.757293168 },
  };
  const unitHandler = (a, b, fa, fb) => (q) => {
    const v = num(q.nilai);
    return { nilai: v, dari: a, ke: b, hasil: round((v * fa) / fb) };
  };
  for (const [kat, tab] of Object.entries(UNITS)) {
    for (const a of Object.keys(tab)) {
      for (const b of Object.keys(tab)) {
        if (a === b) continue;
        add("convert", `${a}-ke-${b}`, `Ubah ${a} ke ${b} (${kat})`, ["nilai"], unitHandler(a, b, tab[a], tab[b]));
      }
    }
  }
  const toC = { c: (x) => x, f: (x) => ((x - 32) * 5) / 9, k: (x) => x - 273.15 };
  const fromC = { c: (x) => x, f: (x) => (x * 9) / 5 + 32, k: (x) => x + 273.15 };
  for (const a of ["c", "f", "k"]) {
    for (const b of ["c", "f", "k"]) {
      if (a === b) continue;
      add("convert", `${a}-ke-${b}`, `Ubah suhu ${a.toUpperCase()} ke ${b.toUpperCase()}`, ["nilai"], (q) => {
        const v = num(q.nilai);
        return { nilai: v, dari: a.toUpperCase(), ke: b.toUpperCase(), hasil: round(fromC[b](toC[a](v)), 4) };
      });
    }
  }

  /* =============== TEKS (cat text) =============== */
  const T = (name, desc, fn, params = ["text"]) => add("text", name, desc, params, (q) => ({ hasil: fn(q.text, q) }));
  const words = (s) => s.replace(/([a-z0-9])([A-Z])/g, "$1 $2").split(/[^A-Za-z0-9]+/).filter(Boolean);
  T("upper", "Huruf kapital semua", (s) => s.toUpperCase());
  T("lower", "Huruf kecil semua", (s) => s.toLowerCase());
  T("title", "Huruf Awal Kapital Tiap Kata", (s) => s.toLowerCase().replace(/(^|\s)\S/g, (c) => c.toUpperCase()));
  T("sentence", "Huruf kapital di awal kalimat", (s) => s.toLowerCase().replace(/(^\s*|[.!?]\s+)([a-z])/g, (m, a, b) => a + b.toUpperCase()));
  T("swapcase", "Tukar huruf besar dan kecil", (s) => [...s].map((c) => (c === c.toUpperCase() ? c.toLowerCase() : c.toUpperCase())).join(""));
  T("reverse", "Balik urutan karakter", (s) => [...s].reverse().join(""));
  T("reversewords", "Balik urutan kata", (s) => s.split(/\s+/).reverse().join(" "));
  T("camel", "camelCase", (s) => words(s).map((w, i) => (i ? w[0].toUpperCase() + w.slice(1).toLowerCase() : w.toLowerCase())).join(""));
  T("pascal", "PascalCase", (s) => words(s).map((w) => w[0].toUpperCase() + w.slice(1).toLowerCase()).join(""));
  T("snake", "snake_case", (s) => words(s).map((w) => w.toLowerCase()).join("_"));
  T("kebab", "kebab-case", (s) => words(s).map((w) => w.toLowerCase()).join("-"));
  T("constant", "CONSTANT_CASE", (s) => words(s).map((w) => w.toUpperCase()).join("_"));
  T("slug", "Ubah jadi slug URL", (s) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, ""));
  T("trim", "Rapikan spasi berlebih", (s) => s.replace(/\s+/g, " ").trim());
  T("nospace", "Hapus semua spasi", (s) => s.replace(/\s+/g, ""));
  T("nolinebreak", "Gabungkan baris jadi satu baris", (s) => s.replace(/\s*\n+\s*/g, " ").trim());
  T("onlyletters", "Sisakan huruf saja", (s) => s.replace(/[^\p{L}]/gu, ""));
  T("onlydigits", "Sisakan angka saja", (s) => s.replace(/\D/g, ""));
  T("novowel", "Hapus huruf vokal", (s) => s.replace(/[aiueoAIUEO]/g, ""));
  T("onlyvowel", "Sisakan huruf vokal saja", (s) => s.replace(/[^aiueoAIUEO]/g, ""));
  T("alay", "Teks gaya alay", (s) => s.replace(/[aeiolsgb]/gi, (c) => ({ a: "4", e: "3", i: "1", o: "0", l: "1", s: "5", g: "9", b: "8" }[c.toLowerCase()])).replace(/[a-z]/g, (c, i) => (i % 2 ? c.toUpperCase() : c)));
  T("leet", "Teks leet speak", (s) => s.replace(/[aeiost]/gi, (c) => ({ a: "4", e: "3", i: "1", o: "0", s: "5", t: "7" }[c.toLowerCase()])));
  T("mock", "tEkS eJeK sElAnG-sElInG", (s) => [...s.toLowerCase()].map((c, i) => (i % 2 ? c.toUpperCase() : c)).join(""));
  T("spasi", "Beri spasi antar huruf", (s) => [...s].join(" "));
  T("shuffle", "Acak urutan huruf", (s) => [...s].sort(() => Math.random() - 0.5).join(""));
  T("shufflewords", "Acak urutan kata", (s) => s.split(/\s+/).sort(() => Math.random() - 0.5).join(" "));
  T("sortwords", "Urutkan kata A-Z", (s) => s.split(/\s+/).sort((a, b) => a.localeCompare(b, "id")).join(" "));
  T("uniquewords", "Hapus kata ganda", (s) => [...new Set(s.split(/\s+/))].join(" "));
  T("sortlines", "Urutkan baris A-Z", (s) => s.split("\n").sort((a, b) => a.localeCompare(b, "id")).join("\n"));
  T("uniquelines", "Hapus baris ganda", (s) => [...new Set(s.split("\n"))].join("\n"));
  T("numberlines", "Beri nomor tiap baris", (s) => s.split("\n").map((l, i) => `${i + 1}. ${l}`).join("\n"));
  T("repeat", "Ulang teks n kali (n maks 50)", (s, q) => Array(int(q.n || "2", "n", 1, 50)).fill(s).join(q.pemisah ?? " ").slice(0, 5000), ["text", "n?", "pemisah?"]);
  T("truncate", "Potong teks dan tambah ...", (s, q) => { const n = int(q.n || "20", "n", 1, 500); return s.length > n ? s.slice(0, n) + "..." : s; }, ["text", "n?"]);
  T("padleft", "Tambah karakter di kiri sampai panjang tertentu", (s, q) => s.padStart(int(q.panjang || "10", "panjang", 1, 200), q.isi || "0"), ["text", "panjang?", "isi?"]);
  T("atbash", "Sandi Atbash", (s) => s.replace(/[a-z]/gi, (c) => { const b = c <= "Z" ? 65 : 97; return String.fromCharCode(b + 25 - (c.charCodeAt(0) - b)); }));
  T("rot47", "Sandi ROT47", (s) => s.replace(/[!-~]/g, (c) => String.fromCharCode(33 + ((c.charCodeAt(0) + 14) % 94))));
  T("binary", "Teks ke biner", (s) => [...Buffer.from(s, "utf8")].map((b) => b.toString(2).padStart(8, "0")).join(" "));
  T("unbinary", "Biner ke teks", (s) => {
    const p = s.trim().split(/\s+/);
    if (!p.every((x) => /^[01]{8}$/.test(x))) throw fail("Format biner tidak valid (kelompok 8 bit dipisah spasi)");
    return Buffer.from(p.map((x) => parseInt(x, 2))).toString("utf8");
  });
  T("octal", "Teks ke oktal", (s) => [...Buffer.from(s, "utf8")].map((b) => b.toString(8)).join(" "));
  T("ascii", "Teks ke kode ASCII/Unicode", (s) => [...s].map((c) => c.codePointAt(0)).join(" "));
  T("fromascii", "Kode ASCII/Unicode ke teks", (s) => {
    const p = s.trim().split(/\s+/).map(Number);
    if (!p.length || p.some((x) => !Number.isInteger(x) || x < 0 || x > 0x10ffff)) throw fail("Kode tidak valid");
    return String.fromCodePoint(...p);
  });
  const MORSE = { a: ".-", b: "-...", c: "-.-.", d: "-..", e: ".", f: "..-.", g: "--.", h: "....", i: "..", j: ".---", k: "-.-", l: ".-..", m: "--", n: "-.", o: "---", p: ".--.", q: "--.-", r: ".-.", s: "...", t: "-", u: "..-", v: "...-", w: ".--", x: "-..-", y: "-.--", z: "--..", 0: "-----", 1: ".----", 2: "..---", 3: "...--", 4: "....-", 5: ".....", 6: "-....", 7: "--...", 8: "---..", 9: "----." };
  const UNMORSE = Object.fromEntries(Object.entries(MORSE).map(([k, v]) => [v, k]));
  T("morse", "Teks ke kode morse", (s) => s.toLowerCase().split(/\s+/).map((w) => [...w].filter((c) => MORSE[c]).map((c) => MORSE[c]).join(" ")).join(" / "));
  T("unmorse", "Kode morse ke teks (kata dipisah /)", (s) => s.trim().split(/\s*\/\s*/).map((w) => w.split(/\s+/).map((c) => UNMORSE[c] ?? "?").join("")).join(" "));
  T("base32", "Teks ke Base32", (s) => {
    const A = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
    let bits = "", out = "";
    for (const b of Buffer.from(s, "utf8")) bits += b.toString(2).padStart(8, "0");
    for (let i = 0; i < bits.length; i += 5) out += A[parseInt(bits.slice(i, i + 5).padEnd(5, "0"), 2)];
    return out + "=".repeat((8 - (out.length % 8)) % 8);
  });
  T("base64url", "Teks ke Base64 aman URL", (s) => Buffer.from(s, "utf8").toString("base64url"));
  T("unbase64url", "Base64 aman URL ke teks", (s) => Buffer.from(s, "base64url").toString("utf8"));
  T("htmlescape", "Escape karakter HTML", (s) => esc(s));
  T("htmlunescape", "Kembalikan karakter HTML", (s) => s.replace(/&(amp|lt|gt|quot|apos|#39);/g, (m, x) => ({ amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", "#39": "'" }[x])));
  T("striphtml", "Hapus tag HTML", (s) => s.replace(/<[^>]*>/g, ""));
  T("unicodeescape", "Teks ke \\uXXXX", (s) => [...s].map((c) => (c.charCodeAt(0) > 127 ? "\\u" + c.charCodeAt(0).toString(16).padStart(4, "0") : c)).join(""));
  const stat = (name, desc, fn) => add("text", name, desc, ["text"], (q) => ({ hasil: fn(q.text) }));
  stat("countchars", "Hitung jumlah karakter", (s) => [...s].length);
  stat("countwords", "Hitung jumlah kata", (s) => s.trim().split(/\s+/).filter(Boolean).length);
  stat("countlines", "Hitung jumlah baris", (s) => s.split("\n").length);
  stat("countvowels", "Hitung huruf vokal", (s) => (s.match(/[aiueoAIUEO]/g) || []).length);
  stat("countconsonants", "Hitung huruf konsonan", (s) => (s.match(/[b-df-hj-np-tv-zB-DF-HJ-NP-TV-Z]/g) || []).length);
  stat("countsentences", "Hitung jumlah kalimat", (s) => (s.match(/[^.!?]+[.!?]*/g) || []).filter((x) => x.trim()).length);
  stat("palindrome", "Cek apakah teks palindrom", (s) => { const c = s.toLowerCase().replace(/[^a-z0-9]/g, ""); return c.length > 0 && c === [...c].reverse().join(""); });
  stat("anagramkey", "Kunci anagram (huruf terurut) untuk membandingkan anagram", (s) => [...s.toLowerCase().replace(/[^a-z0-9]/g, "")].sort().join(""));
  stat("extractemail", "Ambil semua email dari teks", (s) => s.match(/[^\s@<>()]+@[^\s@<>()]+\.[^\s@<>()]+/g) || []);
  stat("extracturl", "Ambil semua link dari teks", (s) => s.match(/https?:\/\/[^\s<>"')]+/gi) || []);
  stat("extractnumber", "Ambil semua angka dari teks", (s) => (s.match(/-?\d+(?:[.,]\d+)?/g) || []).map((x) => Number(x.replace(",", "."))));
  stat("extracthashtag", "Ambil semua #hashtag dari teks", (s) => s.match(/#[\p{L}\p{N}_]+/gu) || []);
  stat("extractmention", "Ambil semua @mention dari teks", (s) => s.match(/@[\w.]+/g) || []);
  stat("wordfreq", "Frekuensi kemunculan tiap kata", (s) => {
    const f = {};
    for (const w of s.toLowerCase().match(/[\p{L}\p{N}']+/gu) || []) f[w] = (f[w] || 0) + 1;
    return Object.fromEntries(Object.entries(f).sort((a, b) => b[1] - a[1]).slice(0, 100));
  });
  add("text", "bacawaktu", "Perkiraan waktu baca teks (200 kata per menit)", ["text"], (q) => {
    const w = q.text.trim().split(/\s+/).filter(Boolean).length;
    return { kata: w, menit: Math.max(1, Math.ceil(w / 200)) };
  });

  /* =============== FONT UNICODE (cat font) =============== */
  const UP = "ABCDEFGHIJKLMNOPQRSTUVWXYZ", LO = "abcdefghijklmnopqrstuvwxyz";
  const holes = {
    script: { B: 0x212c, E: 0x2130, F: 0x2131, H: 0x210b, I: 0x2110, L: 0x2112, M: 0x2133, R: 0x211b, e: 0x212f, g: 0x210a, o: 0x2134 },
    fraktur: { C: 0x212d, H: 0x210c, I: 0x2111, R: 0x211c, Z: 0x2128 },
    doublestruck: { C: 0x2102, H: 0x210d, N: 0x2115, P: 0x2119, Q: 0x211a, R: 0x211d, Z: 0x2124 },
    italic: { h: 0x210e },
  };
  const block = (name, up, lo, dig, hole) => (s) => [...s].map((c) => {
    const i = UP.indexOf(c), j = LO.indexOf(c), d = "0123456789".indexOf(c);
    if (hole && hole[c]) return String.fromCodePoint(hole[c]);
    if (i >= 0) return String.fromCodePoint(up + i);
    if (j >= 0) return String.fromCodePoint(lo + j);
    if (d >= 0 && dig) return String.fromCodePoint(dig + d);
    return c;
  }).join("");
  const FONTS = {
    bold: block("bold", 0x1d400, 0x1d41a, 0x1d7ce),
    italic: block("italic", 0x1d434, 0x1d44e, 0, holes.italic),
    bolditalic: block("bolditalic", 0x1d468, 0x1d482, 0),
    script: block("script", 0x1d49c, 0x1d4b6, 0, holes.script),
    boldscript: block("boldscript", 0x1d4d0, 0x1d4ea, 0),
    fraktur: block("fraktur", 0x1d504, 0x1d51e, 0, holes.fraktur),
    boldfraktur: block("boldfraktur", 0x1d56c, 0x1d586, 0),
    doublestruck: block("doublestruck", 0x1d538, 0x1d552, 0x1d7d8, holes.doublestruck),
    sans: block("sans", 0x1d5a0, 0x1d5ba, 0x1d7e2),
    sansbold: block("sansbold", 0x1d5d4, 0x1d5ee, 0x1d7ec),
    sansitalic: block("sansitalic", 0x1d608, 0x1d622, 0),
    sansbolditalic: block("sansbolditalic", 0x1d63c, 0x1d656, 0),
    monospace: block("monospace", 0x1d670, 0x1d68a, 0x1d7f6),
    circled: (s) => [...s].map((c) => { const i = UP.indexOf(c), j = LO.indexOf(c); return i >= 0 ? String.fromCodePoint(0x24b6 + i) : j >= 0 ? String.fromCodePoint(0x24d0 + j) : c >= "1" && c <= "9" ? String.fromCodePoint(0x2460 + +c - 1) : c === "0" ? "\u24ea" : c; }).join(""),
    circledblack: (s) => [...s.toUpperCase()].map((c) => { const i = UP.indexOf(c); return i >= 0 ? String.fromCodePoint(0x1f150 + i) : c; }).join(""),
    squared: (s) => [...s.toUpperCase()].map((c) => { const i = UP.indexOf(c); return i >= 0 ? String.fromCodePoint(0x1f130 + i) : c; }).join(""),
    squaredblack: (s) => [...s.toUpperCase()].map((c) => { const i = UP.indexOf(c); return i >= 0 ? String.fromCodePoint(0x1f170 + i) : c; }).join(""),
    fullwidth: (s) => [...s].map((c) => (c === " " ? "\u3000" : c > " " && c <= "~" ? String.fromCodePoint(c.charCodeAt(0) + 0xfee0) : c)).join(""),
    smallcaps: (s) => { const m = "ᴀʙᴄᴅᴇꜰɢʜɪᴊᴋʟᴍɴᴏᴘǫʀsᴛᴜᴠᴡxʏᴢ"; return [...s.toLowerCase()].map((c) => { const j = LO.indexOf(c); return j >= 0 ? [...m][j] : c; }).join(""); },
    flip: (s) => { const a = "abcdefghijklmnopqrstuvwxyz", b = [..."ɐqɔpǝɟƃɥᴉɾʞlɯuodbɹsʇnʌʍxʎz"]; return [...s.toLowerCase()].map((c) => { const j = a.indexOf(c); return j >= 0 ? b[j] : { ".": "˙", ",": "'", "?": "¿", "!": "¡", "(": ")", ")": "(" }[c] || c; }).reverse().join(""); },
    strike: (s) => [...s].map((c) => (c === " " ? c : c + "\u0336")).join(""),
    underline: (s) => [...s].map((c) => (c === " " ? c : c + "\u0332")).join(""),
    slash: (s) => [...s].map((c) => (c === " " ? c : c + "\u0338")).join(""),
    dotted: (s) => [...s].map((c) => (c === " " ? c : c + "\u0307")).join(""),
    bubbleflag: (s) => [...s].map((c) => (c === " " ? c : c + "\u20e3")).join(""),
  };
  for (const [name, fn] of Object.entries(FONTS)) {
    add("font", name, `Ubah teks ke gaya font ${name}`, ["text"], (q) => ({ hasil: fn(q.text) }));
  }
  add("font", "semua", "Hasilkan semua gaya font sekaligus", ["text"], (q) => Object.fromEntries(Object.entries(FONTS).map(([k, fn]) => [k, fn(q.text)])));

  /* =============== CRYPTO / HASH (cat crypto) =============== */
  for (const h of ["md5", "sha1", "sha224", "sha256", "sha384", "sha512", "sha3-256", "sha3-512"]) {
    add("crypto", h, `Hash teks dengan ${h.toUpperCase()}`, ["text"], (q) => ({ algoritma: h, hasil: crypto.createHash(h).update(q.text).digest("hex") }));
  }
  for (const h of ["sha1", "sha256", "sha512"]) {
    add("crypto", `hmac-${h}`, `HMAC-${h.toUpperCase()} dari teks dan kunci`, ["text", "key"], (q) => ({ algoritma: `hmac-${h}`, hasil: crypto.createHmac(h, q.key).update(q.text).digest("hex") }));
  }
  add("crypto", "crc32", "Checksum CRC32 dari teks", ["text"], (q) => {
    let c, crc = 0xffffffff;
    for (const b of Buffer.from(q.text)) { c = (crc ^ b) & 0xff; for (let k = 0; k < 8; k++) c = c & 1 ? (c >>> 1) ^ 0xedb88320 : c >>> 1; crc = (crc >>> 8) ^ c; }
    return { hasil: ((crc ^ 0xffffffff) >>> 0).toString(16).padStart(8, "0") };
  });
  add("crypto", "bcryptlike", "Hash garam acak (PBKDF2-SHA256, 100.000 putaran)", ["text"], (q) => {
    const salt = crypto.randomBytes(16).toString("hex");
    return { salt, putaran: 100000, hasil: crypto.pbkdf2Sync(q.text, salt, 100000, 32, "sha256").toString("hex") };
  });
  add("crypto", "randombytes", "Byte acak aman dalam hex (n 1-128)", ["n?"], (q) => ({ hasil: crypto.randomBytes(int(q.n || "16", "n", 1, 128)).toString("hex") }));

  /* =============== GENERATOR (cat generator) =============== */
  add("generator", "password", "Buat password acak (panjang 4-128, simbol=ya/tidak)", ["panjang?", "simbol?"], (q) => {
    const n = int(q.panjang || "16", "panjang", 4, 128);
    const set = "abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789" + (String(q.simbol || "ya").toLowerCase() === "tidak" ? "" : "!@#$%^&*-_+=?");
    return { password: Array.from({ length: n }, () => set[crypto.randomInt(set.length)]).join("") };
  });
  add("generator", "uuid", "UUID v4 acak", [], () => ({ uuid: crypto.randomUUID() }));
  add("generator", "pin", "PIN angka acak (panjang 3-12)", ["panjang?"], (q) => ({ pin: Array.from({ length: int(q.panjang || "6", "panjang", 3, 12) }, () => crypto.randomInt(10)).join("") }));
  add("generator", "token", "Token hex acak (byte 4-64)", ["byte?"], (q) => ({ token: crypto.randomBytes(int(q.byte || "16", "byte", 4, 64)).toString("hex") }));
  add("generator", "dadu", "Lempar dadu (sisi 2-1000, jumlah 1-20)", ["sisi?", "jumlah?"], (q) => {
    const s = int(q.sisi || "6", "sisi", 2, 1000), n = int(q.jumlah || "1", "jumlah", 1, 20);
    const hasil = Array.from({ length: n }, () => crypto.randomInt(1, s + 1));
    return { sisi: s, hasil, total: hasil.reduce((a, b) => a + b, 0) };
  });
  add("generator", "koin", "Lempar koin", [], () => ({ hasil: pick(["Gambar", "Angka"]) }));
  add("generator", "angka", "Angka acak antara min dan max", ["min?", "max?"], (q) => {
    const a = int(q.min || "1", "min", -1e9, 1e9), b = int(q.max || "100", "max", -1e9, 1e9);
    if (a > b) throw fail("min tidak boleh lebih besar dari max");
    return { min: a, max: b, hasil: crypto.randomInt(a, b + 1) };
  });
  add("generator", "pilih", "Pilih satu dari daftar (pisahkan dengan koma)", ["daftar"], (q) => { const l = items(q.daftar); return { pilihan: pick(l), dari: l.length }; });
  add("generator", "acak", "Acak urutan daftar (pisahkan dengan koma)", ["daftar"], (q) => ({ hasil: items(q.daftar).sort(() => Math.random() - 0.5) }));
  add("generator", "bagitim", "Bagi daftar nama jadi beberapa tim acak", ["daftar", "tim?"], (q) => {
    const l = items(q.daftar).sort(() => Math.random() - 0.5), n = int(q.tim || "2", "tim", 2, 20);
    const tim = Array.from({ length: n }, () => []);
    l.forEach((x, i) => tim[i % n].push(x));
    return { tim: tim.map((anggota, i) => ({ nama: `Tim ${i + 1}`, anggota })) };
  });
  add("generator", "warna", "Warna acak (hex dan rgb)", [], () => { const [r, g, b] = [0, 0, 0].map(() => crypto.randomInt(256)); return { hex: "#" + [r, g, b].map((x) => x.toString(16).padStart(2, "0")).join(""), rgb: `rgb(${r}, ${g}, ${b})` }; });
  add("generator", "lotre", "Nomor lotre acak (jumlah 1-10, rentang 1-49)", ["jumlah?"], (q) => {
    const s = new Set();
    const n = int(q.jumlah || "6", "jumlah", 1, 10);
    while (s.size < n) s.add(crypto.randomInt(1, 50));
    return { nomor: [...s].sort((a, b) => a - b) };
  });
  add("generator", "bola8", "Bola ajaib 8: jawaban atas pertanyaan ya/tidak", ["text"], (q) => ({ pertanyaan: q.text, jawaban: pick(["Pasti.", "Tanpa ragu.", "Ya, tentu.", "Sepertinya iya.", "Tanda-tandanya baik.", "Belum jelas, coba lagi.", "Tanya lagi nanti.", "Lebih baik tidak kujawab sekarang.", "Jangan terlalu berharap.", "Jawabanku tidak.", "Sumber terpercaya bilang tidak.", "Sangat diragukan."]) }));
  const NAMA = ["Budi", "Siti", "Agus", "Dewi", "Rizky", "Putri", "Andi", "Sari", "Fajar", "Wulan", "Bayu", "Ayu", "Dimas", "Intan", "Eko", "Rina", "Hendra", "Maya", "Yoga", "Lestari", "Rahmat", "Nia", "Arif", "Fitri", "Taufik", "Citra", "Galih", "Indah", "Bagas", "Ratna"];
  const MARGA = ["Pratama", "Santoso", "Wijaya", "Hidayat", "Saputra", "Nugroho", "Lestari", "Kusuma", "Setiawan", "Permana", "Ramadhan", "Firmansyah", "Utami", "Wibowo", "Susanto"];
  add("generator", "namaindo", "Nama orang Indonesia acak (jumlah 1-20)", ["jumlah?"], (q) => ({ nama: Array.from({ length: int(q.jumlah || "1", "jumlah", 1, 20) }, () => `${pick(NAMA)} ${pick(MARGA)}`) }));

  /* =============== WAKTU (cat time) =============== */
  const ZONES = {
    jakarta: "Asia/Jakarta", makassar: "Asia/Makassar", jayapura: "Asia/Jayapura", tokyo: "Asia/Tokyo", seoul: "Asia/Seoul", beijing: "Asia/Shanghai",
    hongkong: "Asia/Hong_Kong", singapura: "Asia/Singapore", kualalumpur: "Asia/Kuala_Lumpur", bangkok: "Asia/Bangkok", manila: "Asia/Manila", delhi: "Asia/Kolkata",
    dubai: "Asia/Dubai", mekkah: "Asia/Riyadh", istanbul: "Europe/Istanbul", moskow: "Europe/Moscow", kairo: "Africa/Cairo", lagos: "Africa/Lagos",
    london: "Europe/London", paris: "Europe/Paris", berlin: "Europe/Berlin", roma: "Europe/Rome", madrid: "Europe/Madrid", amsterdam: "Europe/Amsterdam",
    newyork: "America/New_York", chicago: "America/Chicago", denver: "America/Denver", losangeles: "America/Los_Angeles", toronto: "America/Toronto",
    mexico: "America/Mexico_City", saopaulo: "America/Sao_Paulo", buenosaires: "America/Argentina/Buenos_Aires", sydney: "Australia/Sydney", perth: "Australia/Perth",
    auckland: "Pacific/Auckland", honolulu: "Pacific/Honolulu", utc: "UTC",
  };
  const HARI = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
  const zoneNow = (tz, at = new Date()) => {
    const f = new Intl.DateTimeFormat("en-GB", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false });
    const p = Object.fromEntries(f.formatToParts(at).map((x) => [x.type, x.value]));
    const hour = p.hour === "24" ? "00" : p.hour;
    const asUtc = Date.UTC(+p.year, +p.month - 1, +p.day, +hour, +p.minute, +p.second);
    const off = Math.round((asUtc - Math.floor(at.getTime() / 1000) * 1000) / 60000);
    const sign = off >= 0 ? "+" : "-", ab = Math.abs(off);
    return {
      zona: tz, tanggal: `${p.year}-${p.month}-${p.day}`, jam: `${hour}:${p.minute}:${p.second}`,
      hari: HARI[new Date(Date.UTC(+p.year, +p.month - 1, +p.day)).getUTCDay()],
      utc: `UTC${sign}${String(Math.floor(ab / 60)).padStart(2, "0")}:${String(ab % 60).padStart(2, "0")}`, unix: Math.floor(at.getTime() / 1000),
    };
  };
  for (const [name, tz] of Object.entries(ZONES)) add("time", name, `Jam dan tanggal sekarang di ${name} (${tz})`, [], () => zoneNow(tz));
  add("time", "now", "Waktu sekarang dalam UTC dan unix", [], () => ({ iso: new Date().toISOString(), unix: Math.floor(Date.now() / 1000), ms: Date.now() }));
  add("time", "zona", "Waktu sekarang di zona IANA mana pun, contoh Asia/Jakarta", ["zona"], (q) => {
    try { return zoneNow(q.zona); } catch { throw fail("Nama zona tidak dikenal. Contoh: Asia/Jakarta, Europe/London"); }
  });
  add("time", "dariunix", "Unix timestamp (detik) ke tanggal", ["nilai"], (q) => { const v = num(q.nilai); const d = new Date(v * 1000); if (isNaN(d)) throw fail("nilai di luar jangkauan"); return { iso: d.toISOString(), wib: zoneNow("Asia/Jakarta", d) }; });
  add("time", "keunix", "Tanggal (YYYY-MM-DD, jam opsional) ke unix timestamp UTC", ["tanggal", "jam?"], (q) => {
    const d = new Date(`${q.tanggal}T${q.jam || "00:00:00"}Z`);
    if (isNaN(d)) throw fail("Format tanggal YYYY-MM-DD dan jam HH:MM:SS");
    return { unix: Math.floor(d.getTime() / 1000), iso: d.toISOString() };
  });
  const dateOf = (v, name = "tanggal") => {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(v || "").trim());
    if (!m) throw fail(`${name} harus berformat YYYY-MM-DD, contoh 2000-12-31`);
    const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
    if (d.getUTCMonth() !== +m[2] - 1) throw fail(`${name} bukan tanggal yang valid`);
    return d;
  };
  add("time", "hari", "Nama hari dari sebuah tanggal", ["tanggal"], (q) => ({ tanggal: q.tanggal, hari: HARI[dateOf(q.tanggal).getUTCDay()] }));
  add("time", "umur", "Hitung umur dari tanggal lahir", ["tanggal"], (q) => {
    const b = dateOf(q.tanggal), n = new Date();
    let y = n.getUTCFullYear() - b.getUTCFullYear(), m = n.getUTCMonth() - b.getUTCMonth(), d = n.getUTCDate() - b.getUTCDate();
    if (d < 0) { m--; d += new Date(Date.UTC(n.getUTCFullYear(), n.getUTCMonth(), 0)).getUTCDate(); }
    if (m < 0) { y--; m += 12; }
    if (b > n) throw fail("Tanggal lahir tidak boleh di masa depan");
    return { tahun: y, bulan: m, hari: d, totalHari: Math.floor((n - b) / 86400000) };
  });
  add("time", "kabisat", "Cek apakah sebuah tahun kabisat", ["tahun"], (q) => { const y = int(q.tahun, "tahun", 1, 9999); return { tahun: y, kabisat: (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0 }; });
  add("time", "hariperbulan", "Jumlah hari dalam sebuah bulan", ["tahun", "bulan"], (q) => { const y = int(q.tahun, "tahun", 1, 9999), m = int(q.bulan, "bulan", 1, 12); return { tahun: y, bulan: m, hari: new Date(Date.UTC(y, m, 0)).getUTCDate() }; });
  add("time", "tambahhari", "Tambah (atau kurangi, pakai minus) sejumlah hari ke tanggal", ["tanggal", "nilai"], (q) => { const d = dateOf(q.tanggal); d.setUTCDate(d.getUTCDate() + int(q.nilai, "nilai", -100000, 100000)); return { hasil: d.toISOString().slice(0, 10), hari: HARI[d.getUTCDay()] }; });
  add("time", "nomorminggu", "Nomor minggu ISO dari sebuah tanggal", ["tanggal"], (q) => {
    const d = dateOf(q.tanggal); const t = new Date(d); t.setUTCDate(t.getUTCDate() + 4 - (t.getUTCDay() || 7));
    return { tahun: t.getUTCFullYear(), minggu: Math.ceil(((t - new Date(Date.UTC(t.getUTCFullYear(), 0, 1))) / 86400000 + 1) / 7) };
  });
  const ZOD = [[1, 20, "Capricorn"], [2, 19, "Aquarius"], [3, 20, "Pisces"], [4, 20, "Aries"], [5, 21, "Taurus"], [6, 21, "Gemini"], [7, 22, "Cancer"], [8, 23, "Leo"], [9, 23, "Virgo"], [10, 23, "Libra"], [11, 22, "Scorpio"], [12, 22, "Sagitarius"]];
  add("time", "zodiak", "Zodiak dari tanggal lahir", ["tanggal"], (q) => {
    const d = dateOf(q.tanggal), m = d.getUTCMonth() + 1, day = d.getUTCDate();
    const z = ZOD.find(([mm, dd]) => m === mm && day <= dd) || ZOD[m % 12];
    return { tanggal: q.tanggal, zodiak: z[2] };
  });
  add("time", "shio", "Shio dari tahun lahir (perkiraan, tanpa memperhitungkan Imlek)", ["tahun"], (q) => {
    const y = int(q.tahun, "tahun", 1, 9999);
    return { tahun: y, shio: ["Monyet", "Ayam", "Anjing", "Babi", "Tikus", "Kerbau", "Macan", "Kelinci", "Naga", "Ular", "Kuda", "Kambing"][y % 12] };
  });

  /* =============== MATEMATIKA (cat math) =============== */
  const M = (name, desc, params, fn) => add("math", name, desc, params, (q) => ({ hasil: fn(q) }));
  const isPrime = (n) => { if (n < 2) return false; if (n % 2 === 0) return n === 2; for (let i = 3; i * i <= n; i += 2) if (n % i === 0) return false; return true; };
  const gcd = (a, b) => (b ? gcd(b, a % b) : Math.abs(a));
  M("prima", "Cek bilangan prima (sampai 1e12)", ["angka"], (q) => isPrime(int(q.angka, "angka", 0, 1e12)));
  M("primake", "Bilangan prima ke-n (n 1-5000)", ["n"], (q) => { let c = 0, i = 1; const n = int(q.n, "n", 1, 5000); while (c < n) if (isPrime(++i)) c++; return i; });
  M("faktorprima", "Faktorisasi prima (sampai 1e12)", ["angka"], (q) => { let n = int(q.angka, "angka", 2, 1e12); const f = []; for (let i = 2; i * i <= n; i++) while (n % i === 0) { f.push(i); n /= i; } if (n > 1) f.push(n); return f; });
  M("faktor", "Semua faktor sebuah bilangan (sampai 1e9)", ["angka"], (q) => { const n = int(q.angka, "angka", 1, 1e9), r = []; for (let i = 1; i * i <= n; i++) if (n % i === 0) { r.push(i); if (i * i !== n) r.push(n / i); } return r.sort((a, b) => a - b); });
  M("faktorial", "Faktorial (angka 0-170)", ["angka"], (q) => { const n = int(q.angka, "angka", 0, 170); let r = 1; for (let i = 2; i <= n; i++) r *= i; return r; });
  M("fibonacci", "Bilangan Fibonacci ke-n (n 0-1000, hasil string)", ["n"], (q) => { let a = 0n, b = 1n; for (let i = 0; i < int(q.n, "n", 0, 1000); i++) [a, b] = [b, a + b]; return a.toString(); });
  M("deretfibonacci", "Deret Fibonacci sepanjang n (n 1-90)", ["n"], (q) => { const r = [0, 1]; const n = int(q.n, "n", 1, 90); while (r.length < n) r.push(r.at(-1) + r.at(-2)); return r.slice(0, n); });
  M("fpb", "FPB dua bilangan", ["a", "b"], (q) => gcd(int(q.a, "a", 1, 1e15), int(q.b, "b", 1, 1e15)));
  M("kpk", "KPK dua bilangan", ["a", "b"], (q) => { const a = int(q.a, "a", 1, 1e9), b = int(q.b, "b", 1, 1e9); return (a / gcd(a, b)) * b; });
  M("akar", "Akar kuadrat", ["angka"], (q) => { const n = num(q.angka, "angka"); if (n < 0) throw fail("angka tidak boleh negatif"); return round(Math.sqrt(n)); });
  M("akarpangkat3", "Akar pangkat tiga", ["angka"], (q) => round(Math.cbrt(num(q.angka, "angka"))));
  M("kuadrat", "Kuadrat sebuah angka", ["angka"], (q) => round(num(q.angka, "angka") ** 2));
  M("kubik", "Pangkat tiga sebuah angka", ["angka"], (q) => round(num(q.angka, "angka") ** 3));
  M("pangkat", "a pangkat b", ["a", "b"], (q) => { const r = num(q.a, "a") ** num(q.b, "b"); if (!Number.isFinite(r)) throw fail("Hasil terlalu besar"); return round(r); });
  M("modulo", "Sisa bagi a dibagi b", ["a", "b"], (q) => { const b = num(q.b, "b"); if (!b) throw fail("b tidak boleh nol"); return num(q.a, "a") % b; });
  M("mutlak", "Nilai mutlak", ["angka"], (q) => Math.abs(num(q.angka, "angka")));
  M("pembulatan", "Bulatkan angka ke n desimal", ["angka", "n?"], (q) => round(num(q.angka, "angka"), int(q.n || "0", "n", 0, 10)));
  M("persen", "Hitung a persen dari b", ["a", "b"], (q) => round((num(q.a, "a") / 100) * num(q.b, "b")));
  M("persenberapa", "a adalah berapa persen dari b", ["a", "b"], (q) => { const b = num(q.b, "b"); if (!b) throw fail("b tidak boleh nol"); return round((num(q.a, "a") / b) * 100); });
  M("perubahanpersen", "Persentase perubahan dari a ke b", ["a", "b"], (q) => { const a = num(q.a, "a"); if (!a) throw fail("a tidak boleh nol"); return round(((num(q.b, "b") - a) / Math.abs(a)) * 100); });
  M("rata", "Rata-rata daftar angka (pisahkan koma)", ["daftar"], (q) => { const a = nums(q.daftar); return round(a.reduce((x, y) => x + y, 0) / a.length); });
  M("jumlah", "Jumlah daftar angka", ["daftar"], (q) => round(nums(q.daftar).reduce((x, y) => x + y, 0)));
  M("median", "Median daftar angka", ["daftar"], (q) => { const a = nums(q.daftar).sort((x, y) => x - y), m = a.length >> 1; return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2; });
  M("modus", "Modus daftar angka", ["daftar"], (q) => { const f = {}; nums(q.daftar).forEach((x) => (f[x] = (f[x] || 0) + 1)); const mx = Math.max(...Object.values(f)); return Object.keys(f).filter((k) => f[k] === mx).map(Number); });
  M("terkecil", "Angka terkecil dalam daftar", ["daftar"], (q) => Math.min(...nums(q.daftar)));
  M("terbesar", "Angka terbesar dalam daftar", ["daftar"], (q) => Math.max(...nums(q.daftar)));
  M("urutkan", "Urutkan daftar angka (arah: naik/turun)", ["daftar", "arah?"], (q) => nums(q.daftar).sort((x, y) => (q.arah === "turun" ? y - x : x - y)));
  M("simpangan", "Simpangan baku populasi daftar angka", ["daftar"], (q) => { const a = nums(q.daftar), m = a.reduce((x, y) => x + y, 0) / a.length; return round(Math.sqrt(a.reduce((s, x) => s + (x - m) ** 2, 0) / a.length)); });
  M("kombinasi", "Kombinasi C(n,r)", ["n", "r"], (q) => { const n = int(q.n, "n", 0, 1000), r = int(q.r, "r", 0, n); let x = 1n; for (let i = 1n; i <= BigInt(r); i++) x = (x * (BigInt(n) - i + 1n)) / i; return x.toString(); });
  M("permutasi", "Permutasi P(n,r)", ["n", "r"], (q) => { const n = int(q.n, "n", 0, 1000), r = int(q.r, "r", 0, n); let x = 1n; for (let i = 0n; i < BigInt(r); i++) x *= BigInt(n) - i; return x.toString(); });
  M("tobinary", "Desimal ke biner", ["angka"], (q) => int(q.angka, "angka", 0, Number.MAX_SAFE_INTEGER).toString(2));
  M("tooctal", "Desimal ke oktal", ["angka"], (q) => int(q.angka, "angka", 0, Number.MAX_SAFE_INTEGER).toString(8));
  M("tohex", "Desimal ke heksadesimal", ["angka"], (q) => int(q.angka, "angka", 0, Number.MAX_SAFE_INTEGER).toString(16).toUpperCase());
  const fromBase = (s, b, re) => { const t = String(s).trim(); if (!re.test(t)) throw fail("Format angka tidak valid"); return parseInt(t, b); };
  M("frombinary", "Biner ke desimal", ["angka"], (q) => fromBase(q.angka, 2, /^[01]{1,53}$/));
  M("fromoctal", "Oktal ke desimal", ["angka"], (q) => fromBase(q.angka, 8, /^[0-7]{1,17}$/));
  M("fromhex", "Heksadesimal ke desimal", ["angka"], (q) => fromBase(q.angka, 16, /^[0-9a-f]{1,13}$/i));
  M("basis", "Ubah angka dari basis a ke basis b (2-36)", ["angka", "dari", "ke"], (q) => { const a = int(q.dari, "dari", 2, 36), b = int(q.ke, "ke", 2, 36); const n = parseInt(q.angka, a); if (!Number.isFinite(n)) throw fail("angka tidak valid untuk basis asal"); return n.toString(b).toUpperCase(); });
  const ROM = [[1000, "M"], [900, "CM"], [500, "D"], [400, "CD"], [100, "C"], [90, "XC"], [50, "L"], [40, "XL"], [10, "X"], [9, "IX"], [5, "V"], [4, "IV"], [1, "I"]];
  M("romawi", "Angka ke angka Romawi (1-3999)", ["angka"], (q) => { let n = int(q.angka, "angka", 1, 3999), r = ""; for (const [v, s] of ROM) while (n >= v) { r += s; n -= v; } return r; });
  M("dariromawi", "Angka Romawi ke angka", ["text"], (q) => { const s = q.text.toUpperCase().trim(); if (!/^M{0,3}(CM|CD|D?C{0,3})(XC|XL|L?X{0,3})(IX|IV|V?I{0,3})$/.test(s) || !s) throw fail("Angka Romawi tidak valid"); let n = 0, i = 0; for (const [v, r] of ROM) while (s.startsWith(r, i)) { n += v; i += r.length; } return n; });
  const SAT = ["", "satu", "dua", "tiga", "empat", "lima", "enam", "tujuh", "delapan", "sembilan", "sepuluh", "sebelas"];
  const tb = (n) => n < 12 ? SAT[n] : n < 20 ? tb(n - 10) + " belas" : n < 100 ? tb(Math.floor(n / 10)) + " puluh" + (n % 10 ? " " + tb(n % 10) : "") : n < 200 ? "seratus" + (n - 100 ? " " + tb(n - 100) : "") : n < 1000 ? tb(Math.floor(n / 100)) + " ratus" + (n % 100 ? " " + tb(n % 100) : "") : n < 2000 ? "seribu" + (n - 1000 ? " " + tb(n - 1000) : "") : n < 1e6 ? tb(Math.floor(n / 1e3)) + " ribu" + (n % 1e3 ? " " + tb(n % 1e3) : "") : n < 1e9 ? tb(Math.floor(n / 1e6)) + " juta" + (n % 1e6 ? " " + tb(n % 1e6) : "") : n < 1e12 ? tb(Math.floor(n / 1e9)) + " miliar" + (n % 1e9 ? " " + tb(n % 1e9) : "") : tb(Math.floor(n / 1e12)) + " triliun" + (n % 1e12 ? " " + tb(n % 1e12) : "");
  M("terbilang", "Angka ke tulisan bahasa Indonesia (0 sampai 999 triliun)", ["angka"], (q) => { const n = int(q.angka, "angka", 0, 999999999999999); return n === 0 ? "nol" : tb(n); });
  M("luaslingkaran", "Luas lingkaran dari jari-jari", ["angka"], (q) => round(Math.PI * num(q.angka, "angka") ** 2));
  M("kelilinglingkaran", "Keliling lingkaran dari jari-jari", ["angka"], (q) => round(2 * Math.PI * num(q.angka, "angka")));
  M("luaspersegi", "Luas persegi dari sisi", ["angka"], (q) => round(num(q.angka, "angka") ** 2));
  M("luaspersegipanjang", "Luas persegi panjang", ["a", "b"], (q) => round(num(q.a, "a") * num(q.b, "b")));
  M("luassegitiga", "Luas segitiga dari alas (a) dan tinggi (b)", ["a", "b"], (q) => round((num(q.a, "a") * num(q.b, "b")) / 2));
  M("volumetabung", "Volume tabung dari jari-jari (a) dan tinggi (b)", ["a", "b"], (q) => round(Math.PI * num(q.a, "a") ** 2 * num(q.b, "b")));
  M("volumebola", "Volume bola dari jari-jari", ["angka"], (q) => round((4 / 3) * Math.PI * num(q.angka, "angka") ** 3));
  M("volumekubus", "Volume kubus dari sisi", ["angka"], (q) => round(num(q.angka, "angka") ** 3));
  M("pythagoras", "Sisi miring dari dua sisi siku-siku", ["a", "b"], (q) => round(Math.hypot(num(q.a, "a"), num(q.b, "b"))));
  M("derajatkeradian", "Derajat ke radian", ["angka"], (q) => round((num(q.angka, "angka") * Math.PI) / 180));
  M("radiankederajat", "Radian ke derajat", ["angka"], (q) => round((num(q.angka, "angka") * 180) / Math.PI));
  M("sinus", "Sinus (input derajat)", ["angka"], (q) => round(Math.sin((num(q.angka, "angka") * Math.PI) / 180)));
  M("cosinus", "Cosinus (input derajat)", ["angka"], (q) => round(Math.cos((num(q.angka, "angka") * Math.PI) / 180)));
  M("tangen", "Tangen (input derajat)", ["angka"], (q) => { const d = num(q.angka, "angka"); if (d % 180 === 90) throw fail("Tangen tidak terdefinisi"); return round(Math.tan((d * Math.PI) / 180)); });
  M("logaritma", "Logaritma basis 10 (atau basis b)", ["angka", "basis?"], (q) => { const n = num(q.angka, "angka"); if (n <= 0) throw fail("angka harus lebih dari 0"); return round(Math.log(n) / Math.log(q.basis ? num(q.basis, "basis") : 10)); });
  M("logaritmanatural", "Logaritma natural (ln)", ["angka"], (q) => { const n = num(q.angka, "angka"); if (n <= 0) throw fail("angka harus lebih dari 0"); return round(Math.log(n)); });
  M("diskon", "Harga setelah diskon persen", ["harga", "diskon"], (q) => { const h = num(q.harga, "harga"), d = num(q.diskon, "diskon"); return { harga: h, diskon: d, potongan: round((h * d) / 100, 2), bayar: round(h - (h * d) / 100, 2) }; });
  M("ppn", "Hitung PPN (default 11 persen)", ["harga", "persen?"], (q) => { const h = num(q.harga, "harga"), p = q.persen ? num(q.persen, "persen") : 11; return { harga: h, ppn: round((h * p) / 100, 2), total: round(h + (h * p) / 100, 2) }; });
  M("tip", "Hitung tip dan total per orang", ["harga", "persen", "orang?"], (q) => { const h = num(q.harga, "harga"), t = (h * num(q.persen, "persen")) / 100, o = int(q.orang || "1", "orang", 1, 1000); return { tip: round(t, 2), total: round(h + t, 2), perOrang: round((h + t) / o, 2) }; });
  M("bagi", "Bagi rata tagihan ke beberapa orang", ["harga", "orang"], (q) => ({ perOrang: round(num(q.harga, "harga") / int(q.orang, "orang", 1, 100000), 2) }));
  M("bmr", "Kalori dasar harian (rumus Mifflin-St Jeor): berat kg, tinggi cm, umur, gender l/p", ["berat", "tinggi", "umur", "gender"], (q) => { const w = num(q.berat, "berat"), h = num(q.tinggi, "tinggi"), u = num(q.umur, "umur"); const g = String(q.gender).toLowerCase().startsWith("l") ? 5 : -161; return { kaloriPerHari: Math.round(10 * w + 6.25 * h - 5 * u + g) }; });
  M("airharian", "Perkiraan kebutuhan air harian dalam liter (berat kg x 0,033)", ["berat"], (q) => round(num(q.berat, "berat") * 0.033, 2));

  /* =============== WARNA (cat color) =============== */
  const parseHex = (v) => {
    let h = String(v || "").trim().replace(/^#/, "");
    if (/^[0-9a-f]{3}$/i.test(h)) h = [...h].map((c) => c + c).join("");
    if (!/^[0-9a-f]{6}$/i.test(h)) throw fail("hex harus 3 atau 6 digit, contoh ff8800");
    return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
  };
  const toHex = (r, g, b) => "#" + [r, g, b].map((x) => Math.max(0, Math.min(255, Math.round(x))).toString(16).padStart(2, "0")).join("");
  const rgb2hsl = (r, g, b) => {
    r /= 255; g /= 255; b /= 255;
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2, d = mx - mn;
    if (!d) return [0, 0, Math.round(l * 100)];
    const s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn);
    const h = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
    return [Math.round(h * 60), Math.round(s * 100), Math.round(l * 100)];
  };
  const hsl2rgb = (h, s, l) => {
    h = ((h % 360) + 360) % 360; s /= 100; l /= 100;
    const k = (n) => (n + h / 30) % 12, a = s * Math.min(l, 1 - l);
    const f = (n) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
    return [f(0) * 255, f(8) * 255, f(4) * 255];
  };
  const lum = ([r, g, b]) => { const f = (c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
  add("color", "info", "Info warna: hex, rgb, hsl", ["hex"], (q) => { const c = parseHex(q.hex); const [h, s, l] = rgb2hsl(...c); return { hex: toHex(...c), rgb: `rgb(${c.join(", ")})`, hsl: `hsl(${h}, ${s}%, ${l}%)`, terang: lum(c) > 0.5 }; });
  add("color", "hex2rgb", "Hex ke RGB", ["hex"], (q) => { const [r, g, b] = parseHex(q.hex); return { r, g, b, css: `rgb(${r}, ${g}, ${b})` }; });
  add("color", "rgb2hex", "RGB ke hex", ["r", "g", "b"], (q) => ({ hex: toHex(int(q.r, "r", 0, 255), int(q.g, "g", 0, 255), int(q.b, "b", 0, 255)) }));
  add("color", "hex2hsl", "Hex ke HSL", ["hex"], (q) => { const [h, s, l] = rgb2hsl(...parseHex(q.hex)); return { h, s, l, css: `hsl(${h}, ${s}%, ${l}%)` }; });
  add("color", "hsl2hex", "HSL ke hex", ["h", "s", "l"], (q) => ({ hex: toHex(...hsl2rgb(int(q.h, "h", 0, 360), int(q.s, "s", 0, 100), int(q.l, "l", 0, 100))) }));
  const shift = (hex, amt) => { const [h, s, l] = rgb2hsl(...parseHex(hex)); return toHex(...hsl2rgb(h, s, Math.max(0, Math.min(100, l + amt)))); };
  add("color", "lighten", "Terangkan warna (persen 1-100)", ["hex", "persen?"], (q) => ({ hex: shift(q.hex, int(q.persen || "10", "persen", 1, 100)) }));
  add("color", "darken", "Gelapkan warna (persen 1-100)", ["hex", "persen?"], (q) => ({ hex: shift(q.hex, -int(q.persen || "10", "persen", 1, 100)) }));
  add("color", "complement", "Warna komplementer", ["hex"], (q) => { const [h, s, l] = rgb2hsl(...parseHex(q.hex)); return { hex: toHex(...hsl2rgb(h + 180, s, l)) }; });
  add("color", "invert", "Warna kebalikan (negatif)", ["hex"], (q) => { const [r, g, b] = parseHex(q.hex); return { hex: toHex(255 - r, 255 - g, 255 - b) }; });
  add("color", "grayscale", "Ubah warna jadi abu-abu", ["hex"], (q) => { const [r, g, b] = parseHex(q.hex); const y = 0.299 * r + 0.587 * g + 0.114 * b; return { hex: toHex(y, y, y) }; });
  add("color", "mix", "Campur dua warna (hex dan hex2)", ["hex", "hex2"], (q) => { const a = parseHex(q.hex), b = parseHex(q.hex2); return { hex: toHex(...a.map((x, i) => (x + b[i]) / 2)) }; });
  add("color", "kontras", "Rasio kontras WCAG dua warna", ["hex", "hex2"], (q) => { const a = lum(parseHex(q.hex)), b = lum(parseHex(q.hex2)); const r = (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05); return { rasio: round(r, 2), AA: r >= 4.5, AAA: r >= 7 }; });
  add("color", "palet", "Palet 5 warna analog dari satu warna", ["hex"], (q) => { const [h, s, l] = rgb2hsl(...parseHex(q.hex)); return { palet: [-60, -30, 0, 30, 60].map((d) => toHex(...hsl2rgb(h + d, s, l))) }; });
  add("color", "gradasi", "Gradasi n langkah dari dua warna (n 2-20)", ["hex", "hex2", "n?"], (q) => { const a = parseHex(q.hex), b = parseHex(q.hex2), n = int(q.n || "5", "n", 2, 20); return { gradasi: Array.from({ length: n }, (_, i) => toHex(...a.map((x, k) => x + ((b[k] - x) * i) / (n - 1)))) }; });
  add("color", "swatch", "Gambar kotak warna (SVG)", ["hex"], (q) => { const c = toHex(...parseHex(q.hex)); return { svg: `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400"><rect width="400" height="400" fill="${c}"/><text x="200" y="215" font-family="Arial,sans-serif" font-size="40" text-anchor="middle" fill="${lum(parseHex(q.hex)) > 0.5 ? "#000" : "#fff"}">${c.toUpperCase()}</text></svg>` }; }, { out: "image" });

  /* =============== ONE PIECE (cat onepiece) =============== */
  const KRU = [
    { nama: "Monkey D. Luffy", peran: "Kapten", buah: "Hito Hito no Mi Model: Nika", bounty: 3000000000 },
    { nama: "Roronoa Zoro", peran: "Pendekar pedang", buah: null, bounty: 1111000000 },
    { nama: "Nami", peran: "Navigator", buah: null, bounty: 366000000 },
    { nama: "Usopp", peran: "Penembak jitu", buah: null, bounty: 500000000 },
    { nama: "Sanji", peran: "Koki", buah: null, bounty: 1032000000 },
    { nama: "Tony Tony Chopper", peran: "Dokter kapal", buah: "Hito Hito no Mi", bounty: 1000 },
    { nama: "Nico Robin", peran: "Arkeolog", buah: "Hana Hana no Mi", bounty: 930000000 },
    { nama: "Franky", peran: "Tukang kapal", buah: null, bounty: 394000000 },
    { nama: "Brook", peran: "Musisi", buah: "Yomi Yomi no Mi", bounty: 383000000 },
    { nama: "Jinbe", peran: "Juru mudi", buah: null, bounty: 1100000000 },
  ];
  const LAIN = [
    ["Portgas D. Ace", "Komandan Bajak Laut Whitebeard", "Mera Mera no Mi"], ["Sabo", "Kepala Staf Tentara Revolusi", "Mera Mera no Mi"],
    ["Trafalgar D. Water Law", "Kapten Bajak Laut Heart", "Ope Ope no Mi"], ["Eustass Kid", "Kapten Bajak Laut Kid", null],
    ["Shanks", "Kapten Bajak Laut Rambut Merah", null], ["Marshall D. Teach", "Kapten Bajak Laut Blackbeard", "Yami Yami no Mi dan Gura Gura no Mi"],
    ["Edward Newgate", "Kapten Bajak Laut Whitebeard", "Gura Gura no Mi"], ["Gol D. Roger", "Raja Bajak Laut", null],
    ["Dracule Mihawk", "Pendekar pedang terhebat di dunia", null], ["Boa Hancock", "Kaisar Bajak Laut Wanita, Kuja", "Mero Mero no Mi"],
    ["Buggy", "Kapten Bajak Laut Buggy", "Bara Bara no Mi"], ["Kaido", "Gubernur Jenderal Hewan, Bajak Laut Beast", "Uo Uo no Mi Model: Seiryu"],
    ["Charlotte Linlin", "Kapten Bajak Laut Big Mom", "Soru Soru no Mi"], ["Sakazuki", "Laksamana Armada", "Magu Magu no Mi"],
    ["Kuzan", "Mantan Laksamana Armada", "Hie Hie no Mi"], ["Borsalino", "Laksamana Armada", "Pika Pika no Mi"],
    ["Crocodile", "Mantan Shichibukai", "Suna Suna no Mi"], ["Donquixote Doflamingo", "Mantan Shichibukai", "Ito Ito no Mi"],
    ["Monkey D. Garp", "Pahlawan Angkatan Laut", null], ["Koby", "Angkatan Laut", null], ["Smoker", "Angkatan Laut", "Moku Moku no Mi"],
    ["Enel", "Mantan penguasa Skypiea", "Goro Goro no Mi"],
  ].map(([nama, peran, buah]) => ({ nama, peran, buah }));
  const SEMUA = [...KRU.map(({ bounty, ...r }) => ({ ...r, kru: "Bajak Laut Topi Jerami" })), ...LAIN];
  const berry = (n) => "฿ " + Number(n).toLocaleString("en-US");
  add("onepiece", "kru", "Daftar Bajak Laut Topi Jerami beserta bounty terbaru yang diketahui", [], () => KRU.map((k) => ({ ...k, bountyFormat: berry(k.bounty) })));
  add("onepiece", "karakter", "Cari karakter One Piece berdasarkan nama", ["nama"], (q) => {
    const t = q.nama.toLowerCase();
    const r = SEMUA.filter((c) => c.nama.toLowerCase().includes(t));
    if (!r.length) throw fail("Karakter tidak ditemukan di daftar", 404);
    return r;
  });
  add("onepiece", "acak", "Karakter One Piece acak", [], () => pick(SEMUA));
  const BUAH = [
    ["Hito Hito no Mi Model: Nika", "Mythical Zoan", "Monkey D. Luffy (dulu dikenal sebagai Gomu Gomu no Mi)"], ["Mera Mera no Mi", "Logia", "Portgas D. Ace, lalu Sabo"],
    ["Hie Hie no Mi", "Logia", "Kuzan"], ["Magu Magu no Mi", "Logia", "Sakazuki"], ["Pika Pika no Mi", "Logia", "Borsalino"], ["Suna Suna no Mi", "Logia", "Crocodile"],
    ["Moku Moku no Mi", "Logia", "Smoker"], ["Goro Goro no Mi", "Logia", "Enel"], ["Yami Yami no Mi", "Logia", "Marshall D. Teach"],
    ["Gura Gura no Mi", "Paramecia", "Edward Newgate, lalu Marshall D. Teach"], ["Ope Ope no Mi", "Paramecia", "Trafalgar D. Water Law"], ["Hana Hana no Mi", "Paramecia", "Nico Robin"],
    ["Bara Bara no Mi", "Paramecia", "Buggy"], ["Ito Ito no Mi", "Paramecia", "Donquixote Doflamingo"], ["Mero Mero no Mi", "Paramecia", "Boa Hancock"],
    ["Soru Soru no Mi", "Paramecia", "Charlotte Linlin"], ["Yomi Yomi no Mi", "Paramecia", "Brook"], ["Hito Hito no Mi", "Zoan", "Tony Tony Chopper"],
    ["Uo Uo no Mi Model: Seiryu", "Mythical Zoan", "Kaido"],
  ].map(([nama, tipe, pemakai]) => ({ nama, tipe, pemakai }));
  add("onepiece", "buahiblis", "Daftar Buah Iblis (Devil Fruit) beserta tipe dan pemakainya", [], () => BUAH);
  add("onepiece", "buahacak", "Satu Buah Iblis acak", [], () => pick(BUAH));
  add("onepiece", "haki", "Tiga jenis Haki", [], () => [
    { nama: "Kenbunshoku", arti: "Haki Pengamatan: merasakan kehadiran, emosi, dan serangan lawan" },
    { nama: "Busoshoku", arti: "Haki Persenjataan: menguatkan tubuh atau senjata seperti zirah tak kasatmata" },
    { nama: "Haoshoku", arti: "Haki Raja: tekanan kehendak yang bisa menjatuhkan lawan, hanya dimiliki segelintir orang" },
  ]);
  const KATA = ["Laut tidak pernah menanyakan dari mana kamu berasal, hanya seberapa jauh kamu berani berlayar.", "Peta bisa usang, tapi tekad untuk berangkat tidak.", "Nakama bukan soal siapa yang paling kuat, tapi siapa yang tetap tinggal saat badai.", "Mimpi yang ditertawakan orang biasanya yang paling layak dikejar.", "Jangan menunggu angin baik, kibarkan layar dulu.", "Bendera di tiangmu adalah janji yang kamu buat pada dirimu sendiri.", "Luka hari ini adalah cerita yang kamu bawa ke pulau berikutnya.", "Kebebasan itu mahal, dan harganya adalah keberanian.", "Kapal sekecil apa pun bisa sampai ke Grand Line kalau awaknya tidak menyerah.", "Makan dulu, baru bertarung. Perut kosong tidak pernah memenangkan apa-apa.", "Kekuatan sejati terlihat saat kamu melindungi, bukan saat kamu menaklukkan.", "Pulau terakhir selalu terasa jauh sampai suatu pagi dia tampak di cakrawala.", "Satu kompas, satu tujuan, seribu alasan untuk tidak berhenti.", "Berani tersesat adalah syarat menemukan harta karun.", "Orang yang bercerita tentang petualangannya tadinya hanya orang yang berani naik kapal."];
  add("onepiece", "motivasi", "Kata mutiara bergaya bajak laut (ditulis sendiri, bukan kutipan resmi)", [], () => ({ kata: pick(KATA) }));
  const AWAL = ["Si Topi", "Kapten", "Pendekar", "Sang Penjelajah", "Raja", "Hantu", "Si Badai", "Naga", "Elang", "Singa"];
  const AKHIR = ["Samudra", "Layar Merah", "Tiga Badai", "Gelombang", "Karang Hitam", "Jolly Roger", "Angin Timur", "Pelangi", "Kompas Emas", "Ombak Biru"];
  add("onepiece", "namabajaklaut", "Nama bajak laut dari namamu (hasil tetap untuk nama yang sama)", ["nama"], (q) => {
    const s = seed(q.nama);
    return { nama: q.nama, julukan: `${AWAL[Math.floor(s * 997) % AWAL.length]} ${AKHIR[Math.floor(s * 7919) % AKHIR.length]}` };
  });
  const bountyOf = (nama) => Math.max(1000, Math.round((seed(nama) * 3e9) / 1e5) * 1e5);
  add("onepiece", "bounty", "Bounty dirimu di dunia One Piece (hasil tetap untuk nama yang sama)", ["nama"], (q) => { const b = bountyOf(q.nama); return { nama: q.nama, bounty: b, bountyFormat: berry(b) }; });
  add("onepiece", "wanted", "Poster buronan One Piece (gambar SVG). Bounty opsional, bila kosong dihitung dari nama", ["nama", "bounty?"], (q) => {
    const nama = q.nama.trim().slice(0, 28).toUpperCase();
    const b = q.bounty && /^\d{1,13}$/.test(q.bounty.trim()) ? Number(q.bounty) : bountyOf(q.nama);
    const sz = nama.length > 18 ? 40 : nama.length > 12 ? 52 : 64;
    return { svg: `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="850" viewBox="0 0 600 850"><defs><radialGradient id="p" cx="50%" cy="45%" r="75%"><stop offset="0" stop-color="#f3dfb0"/><stop offset="1" stop-color="#d1a964"/></radialGradient></defs><rect width="600" height="850" fill="url(#p)"/><rect x="18" y="18" width="564" height="814" fill="none" stroke="#5a3a1a" stroke-width="8"/><rect x="34" y="34" width="532" height="782" fill="none" stroke="#5a3a1a" stroke-width="2"/><text x="300" y="150" font-family="Georgia,serif" font-weight="700" font-size="118" text-anchor="middle" fill="#3b2410" letter-spacing="6">WANTED</text><rect x="70" y="190" width="460" height="400" fill="#c79a5a" stroke="#5a3a1a" stroke-width="6"/><g fill="#3b2410"><circle cx="300" cy="360" r="86"/><rect x="190" y="276" width="220" height="30" rx="8"/><path d="M215 276q85-110 170 0z"/><rect x="215" y="262" width="170" height="14" fill="#b3261e"/></g><circle cx="270" cy="372" r="14" fill="#c79a5a"/><circle cx="330" cy="372" r="14" fill="#c79a5a"/><path d="M270 410h60l-8 22h-44z" fill="#c79a5a"/><text x="300" y="640" font-family="Georgia,serif" font-weight="700" font-size="34" text-anchor="middle" fill="#3b2410" letter-spacing="4">DEAD OR ALIVE</text><text x="300" y="715" font-family="Georgia,serif" font-weight="700" font-size="${sz}" text-anchor="middle" fill="#3b2410">${esc(nama)}</text><text x="300" y="785" font-family="Georgia,serif" font-weight="700" font-size="46" text-anchor="middle" fill="#8f1d14">${esc(berry(b))}-</text></svg>` };
  }, { out: "image" });
};
