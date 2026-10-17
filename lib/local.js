// Endpoint tambahan yang diproses sepenuhnya di server sendiri.
// Tidak memakai pihak ketiga, jadi tidak bisa down dan aman dipakai bot kapan saja.

const pick = (a) => a[Math.floor(Math.random() * a.length)];

// Angka tetap dari teks, supaya hasil jodoh/apakah konsisten untuk input yang sama.
const seed = (s) => {
  let h = 2166136261;
  for (const c of String(s).toLowerCase().trim()) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return (h >>> 0) / 4294967296;
};

module.exports = ({ add, fail }) => {
  const num = (v, name) => {
    const n = Number(String(v).replace(",", "."));
    if (!Number.isFinite(n)) throw fail(`${name} harus berupa angka`);
    return n;
  };
  const int = (v, name, min, max) => {
    const n = num(v, name);
    if (!Number.isInteger(n) || n < min || n > max) throw fail(`${name} harus bilangan bulat ${min} sampai ${max}`);
    return n;
  };
  const date = (v, name) => {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(v || "").trim());
    if (!m) throw fail(`${name} harus berformat YYYY-MM-DD, contoh 2000-12-31`);
    const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
    if (d.getUTCMonth() !== +m[2] - 1) throw fail(`${name} bukan tanggal yang valid`);
    return d;
  };
  const today = () => { const n = new Date(); return new Date(Date.UTC(n.getUTCFullYear(), n.getUTCMonth(), n.getUTCDate())); };
  const DAY = 86400000;

  /* ---------- Teks dan encoding ---------- */
  add("utility", "urlencode", "Encode atau decode teks untuk URL (mode: encode/decode)", ["text", "mode?"], (q) => {
    if ((q.mode || "encode") === "decode") {
      try { return { hasil: decodeURIComponent(q.text) }; } catch { throw fail("Teks bukan URL-encoding yang valid"); }
    }
    return { hasil: encodeURIComponent(q.text) };
  });

  add("utility", "hex", "Ubah teks ke hexadesimal atau sebaliknya (mode: encode/decode)", ["text", "mode?"], (q) => {
    if ((q.mode || "encode") === "decode") {
      const h = q.text.replace(/\s+/g, "");
      if (!/^([0-9a-f]{2})+$/i.test(h)) throw fail("Hex tidak valid");
      return { hasil: Buffer.from(h, "hex").toString("utf8") };
    }
    return { hasil: Buffer.from(q.text, "utf8").toString("hex") };
  });

  const caesar = (t, k) => t.replace(/[a-z]/gi, (c) => {
    const b = c <= "Z" ? 65 : 97;
    return String.fromCharCode(((((c.charCodeAt(0) - b + k) % 26) + 26) % 26) + b);
  });
  add("utility", "rot13", "Sandi ROT13", ["text"], (q) => ({ hasil: caesar(q.text, 13) }));
  add("utility", "caesar", "Sandi Caesar dengan geseran bebas (shift 1 sampai 25, mode: encode/decode)", ["text", "shift?", "mode?"], (q) => {
    const k = q.shift ? int(q.shift, "shift", 1, 25) : 3;
    return { shift: k, hasil: caesar(q.text, (q.mode || "encode") === "decode" ? -k : k) };
  });

  add("utility", "jsonformat", "Rapikan atau kecilkan JSON (mode: pretty/minify)", ["text", "mode?"], (q) => {
    let o;
    try { o = JSON.parse(q.text); } catch (e) { throw fail(`JSON tidak valid: ${e.message}`); }
    return { hasil: (q.mode || "pretty") === "minify" ? JSON.stringify(o) : JSON.stringify(o, null, 2) };
  });

  add("utility", "palindrom", "Cek apakah teks adalah palindrom", ["text"], (q) => {
    const n = q.text.toLowerCase().replace(/[^a-z0-9]/g, "");
    return { teks: q.text, palindrom: n.length > 0 && n === [...n].reverse().join("") };
  });

  const STYLES = {
    tebal: [0x1d5d4, 0x1d5ee, 0x1d7ec],
    miring: [0x1d608, 0x1d622, null],
    mono: [0x1d670, 0x1d68a, 0x1d7f6],
    gelembung: [0x24b6, 0x24d0, null],
    kaligrafi: [0x1d4d0, 0x1d4ea, null],
    gothic: [0x1d56c, 0x1d586, null],
  };
  add("utility", "fancytext", `Ubah teks ke huruf unik (gaya: ${Object.keys(STYLES).join(", ")})`, ["text", "gaya?"], (q) => {
    const g = (q.gaya || "tebal").toLowerCase();
    const s = STYLES[g];
    if (!s) throw fail(`gaya tidak dikenal. Pilihan: ${Object.keys(STYLES).join(", ")}`);
    const out = [...q.text.slice(0, 200)].map((c) => {
      if (c >= "A" && c <= "Z") return String.fromCodePoint(s[0] + c.charCodeAt(0) - 65);
      if (c >= "a" && c <= "z") return String.fromCodePoint(s[1] + c.charCodeAt(0) - 97);
      if (c >= "0" && c <= "9" && s[2]) return String.fromCodePoint(s[2] + c.charCodeAt(0) - 48);
      return c;
    });
    return { gaya: g, hasil: out.join("") };
  });

  add("utility", "timestamp", "Ubah timestamp Unix ke tanggal, atau tampilkan waktu sekarang", ["value?"], (q) => {
    let d = new Date();
    if (q.value) {
      const n = num(q.value, "value");
      d = new Date(n < 1e12 ? n * 1000 : n);
    }
    if (isNaN(d)) throw fail("value bukan timestamp yang valid");
    return { detik: Math.floor(d.getTime() / 1000), milidetik: d.getTime(), iso: d.toISOString(), wib: d.toLocaleString("id-ID", { timeZone: "Asia/Jakarta", dateStyle: "full", timeStyle: "medium" }) };
  });

  /* ---------- Matematika dan keuangan ---------- */
  add("utility", "persen", "Hitung a persen dari b, dan b adalah berapa persen dari a", ["a", "b"], (q) => {
    const a = num(q.a, "a"), b = num(q.b, "b");
    return { persenDariNilai: +((a / 100) * b).toFixed(4), nilaiAdalahPersenDari: b === 0 ? null : +((a / b) * 100).toFixed(4) };
  });

  add("utility", "diskon", "Hitung harga setelah diskon dan hemat berapa", ["harga", "diskon"], (q) => {
    const h = num(q.harga, "harga"), d = num(q.diskon, "diskon");
    if (h < 0 || d < 0 || d > 100) throw fail("harga tidak boleh negatif dan diskon harus 0 sampai 100");
    return { harga: h, diskonPersen: d, hemat: +(h * d / 100).toFixed(2), bayar: +(h - (h * d) / 100).toFixed(2) };
  });

  add("utility", "cicilan", "Hitung cicilan per bulan (bunga flat per tahun)", ["pokok", "bunga", "bulan"], (q) => {
    const p = num(q.pokok, "pokok"), b = num(q.bunga, "bunga"), n = int(q.bulan, "bulan", 1, 600);
    if (p <= 0 || b < 0) throw fail("pokok harus lebih dari 0 dan bunga tidak boleh negatif");
    const total = p + p * (b / 100) * (n / 12);
    return { pokok: p, bungaPerTahun: b, bulan: n, totalBayar: Math.round(total), perBulan: Math.round(total / n) };
  });

  add("utility", "zakatmal", "Hitung zakat maal 2,5% dan status nisab (harga emas per gram opsional)", ["harta", "emas?"], (q) => {
    const harta = num(q.harta, "harta");
    const emas = q.emas ? num(q.emas, "emas") : 1500000;
    const nisab = emas * 85;
    return { harta, hargaEmasPerGram: emas, nisab, wajibZakat: harta >= nisab, zakat: harta >= nisab ? Math.round(harta * 0.025) : 0 };
  });

  const CONV = {
    panjang: { mm: 0.001, cm: 0.01, m: 1, km: 1000, inci: 0.0254, kaki: 0.3048, yard: 0.9144, mil: 1609.344 },
    berat: { mg: 0.000001, g: 0.001, kg: 1, ton: 1000, ons: 0.1, pon: 0.45359237 },
  };
  add("utility", "konversi", "Konversi satuan panjang (mm cm m km inci kaki yard mil), berat (mg g kg ton ons pon), dan suhu (c f k)", ["nilai", "dari", "ke"], (q) => {
    const v = num(q.nilai, "nilai"), a = q.dari.toLowerCase(), b = q.ke.toLowerCase();
    if (["c", "f", "k"].includes(a) && ["c", "f", "k"].includes(b)) {
      const c = a === "c" ? v : a === "f" ? ((v - 32) * 5) / 9 : v - 273.15;
      const r = b === "c" ? c : b === "f" ? (c * 9) / 5 + 32 : c + 273.15;
      return { nilai: v, dari: a, ke: b, hasil: +r.toFixed(4) };
    }
    for (const tabel of Object.values(CONV)) {
      if (tabel[a] && tabel[b]) return { nilai: v, dari: a, ke: b, hasil: +((v * tabel[a]) / tabel[b]).toFixed(6) };
    }
    throw fail("Satuan tidak dikenal atau jenisnya berbeda. Contoh: dari=km ke=mil, dari=kg ke=pon, dari=c ke=f");
  });

  const gcd = (a, b) => (b ? gcd(b, a % b) : a);
  add("utility", "fpbkpk", "Hitung FPB dan KPK dua bilangan bulat", ["a", "b"], (q) => {
    const a = int(q.a, "a", 1, 1e9), b = int(q.b, "b", 1, 1e9);
    const f = gcd(a, b);
    return { a, b, fpb: f, kpk: (a / f) * b };
  });

  add("utility", "bilangan", "Info bilangan: ganjil/genap, prima, dan faktornya", ["angka"], (q) => {
    const n = int(q.angka, "angka", 1, 1e9);
    const faktor = [];
    for (let i = 1; i * i <= n; i++) if (n % i === 0) { faktor.push(i); if (i !== n / i) faktor.push(n / i); }
    faktor.sort((x, y) => x - y);
    return { angka: n, jenis: n % 2 ? "ganjil" : "genap", prima: n > 1 && faktor.length === 2, faktor, kuadratSempurna: Number.isInteger(Math.sqrt(n)) };
  });

  add("utility", "faktorial", "Hitung faktorial (maks 170)", ["n"], (q) => {
    const n = int(q.n, "n", 0, 170);
    let r = 1;
    for (let i = 2; i <= n; i++) r *= i;
    return { n, hasil: r, tulisan: r.toExponential(6) };
  });

  add("utility", "fibonacci", "Deret Fibonacci sampai n suku (maks 90)", ["n"], (q) => {
    const n = int(q.n, "n", 1, 90);
    const d = [0n, 1n];
    for (let i = 2; i < n; i++) d.push(d[i - 1] + d[i - 2]);
    return { n, deret: d.slice(0, n).map(String) };
  });

  add("utility", "kuadrat", "Selesaikan persamaan kuadrat ax² + bx + c = 0", ["a", "b", "c"], (q) => {
    const a = num(q.a, "a"), b = num(q.b, "b"), c = num(q.c, "c");
    if (a === 0) throw fail("a tidak boleh 0");
    const D = b * b - 4 * a * c;
    if (D < 0) return { diskriminan: D, akar: [], keterangan: "Tidak punya akar real" };
    const x1 = (-b + Math.sqrt(D)) / (2 * a), x2 = (-b - Math.sqrt(D)) / (2 * a);
    return { diskriminan: D, akar: D === 0 ? [x1] : [x1, x2], keterangan: D === 0 ? "Satu akar kembar" : "Dua akar real berbeda" };
  });

  /* ---------- Tanggal dan kalender ---------- */
  add("utility", "kabisat", "Cek apakah sebuah tahun adalah tahun kabisat", ["tahun"], (q) => {
    const y = int(q.tahun, "tahun", 1, 9999);
    return { tahun: y, kabisat: (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0 };
  });

  add("utility", "selisihtanggal", "Hitung selisih hari antara dua tanggal (YYYY-MM-DD)", ["dari", "ke"], (q) => {
    const a = date(q.dari, "dari"), b = date(q.ke, "ke");
    const hari = Math.round((b - a) / DAY);
    return { dari: q.dari, ke: q.ke, hari, minggu: +(hari / 7).toFixed(2) };
  });

  add("utility", "hitungmundur", "Berapa hari lagi menuju sebuah tanggal (YYYY-MM-DD)", ["tanggal"], (q) => {
    const t = date(q.tanggal, "tanggal");
    const hari = Math.round((t - today()) / DAY);
    return { tanggal: q.tanggal, hariLagi: hari, status: hari > 0 ? "belum tiba" : hari === 0 ? "hari ini" : "sudah lewat" };
  });

  const HARI = new Intl.DateTimeFormat("id-ID", { weekday: "long", timeZone: "UTC" });
  const PASARAN = ["Legi", "Pahing", "Pon", "Wage", "Kliwon"];
  add("utility", "weton", "Hari dan pasaran Jawa (weton) dari sebuah tanggal (YYYY-MM-DD)", ["tanggal"], (q) => {
    const d = date(q.tanggal, "tanggal");
    // Patokan: 17 Agustus 1945 jatuh pada Jumat Legi.
    const selisih = Math.round((d - Date.UTC(1945, 7, 17)) / DAY);
    const pasaran = PASARAN[((selisih % 5) + 5) % 5];
    const hari = HARI.format(d);
    const NEPTU_HARI = { minggu: 5, senin: 4, selasa: 3, rabu: 7, kamis: 8, jumat: 6, sabtu: 9 };
    const NEPTU_PASARAN = { Legi: 5, Pahing: 9, Pon: 7, Wage: 4, Kliwon: 8 };
    return { tanggal: q.tanggal, hari, pasaran, weton: `${hari} ${pasaran}`, neptu: NEPTU_HARI[hari.toLowerCase()] + NEPTU_PASARAN[pasaran] };
  });

  add("islami", "hijriah", "Konversi tanggal Masehi (YYYY-MM-DD) ke Hijriah. Tanpa tanggal berarti hari ini", ["tanggal?"], (q) => {
    const d = q.tanggal ? date(q.tanggal, "tanggal") : today();
    const f = new Intl.DateTimeFormat("id-ID-u-ca-islamic-umalqura", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
    const p = Object.fromEntries(f.formatToParts(d).map((x) => [x.type, x.value]));
    return { masehi: d.toISOString().slice(0, 10), hari: HARI.format(d), hijriah: `${p.day} ${p.month} ${String(p.year).replace(/\D/g, "")} H`, tanggal: +p.day, bulan: p.month, tahun: +String(p.year).replace(/\D/g, "") };
  });

  /* ---------- Hiburan (hasil tetap untuk input yang sama) ---------- */
  add("fun", "jodoh", "Kecocokan dua nama dalam persen", ["nama1", "nama2"], (q) => {
    const k = [q.nama1, q.nama2].map((s) => s.toLowerCase().trim()).sort().join("|");
    const p = Math.floor(seed(k) * 101);
    const ket = p >= 85 ? "Jodoh banget, segera lamar!" : p >= 60 ? "Cocok, tinggal diperjuangkan." : p >= 35 ? "Biasa saja, butuh usaha lebih." : "Kayaknya belum jodoh.";
    return { nama1: q.nama1, nama2: q.nama2, persen: p, keterangan: ket };
  });

  add("fun", "kerangajaib", "Tanya kerang ajaib, jawabannya acak", ["text"], (q) => ({
    pertanyaan: q.text,
    jawaban: pick(["Ya.", "Tidak.", "Mungkin.", "Coba tanya lagi nanti.", "Pasti!", "Jangan berharap.", "Tentu saja tidak.", "Bisa jadi.", "Tanpa keraguan.", "Sebaiknya jangan."]),
  }));

  add("fun", "apakah", "Jawab pertanyaan ya atau tidak (hasil tetap untuk pertanyaan yang sama)", ["text"], (q) => {
    const r = seed(q.text);
    return { pertanyaan: q.text, jawaban: r < 0.45 ? "Ya" : r < 0.9 ? "Tidak" : "Mungkin" };
  });

  add("fun", "kapankah", "Perkiraan waktu untuk sebuah pertanyaan kapan", ["text"], (q) => {
    const n = 1 + Math.floor(seed(q.text) * 30);
    const u = ["hari", "minggu", "bulan", "tahun"][Math.floor(seed(q.text + "u") * 4)];
    return { pertanyaan: q.text, jawaban: `${n} ${u} lagi` };
  });

  add("fun", "seberapa", "Seberapa besar sesuatu dalam persen", ["text"], (q) => ({ pertanyaan: q.text, persen: Math.floor(seed(q.text) * 101) }));

  add("fun", "rate", "Beri nilai 0 sampai 10 untuk sesuatu", ["text"], (q) => ({ yangDinilai: q.text, nilai: +(seed(q.text) * 10).toFixed(1) }));
};
