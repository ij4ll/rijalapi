// Semua endpoint didefinisikan di file ini.
// add(kategori, nama, deskripsi, [param, "param?" = opsional], handler, opsi)
// Handler boleh mengembalikan: objek biasa (jadi JSON), { redirect: url }, atau { svg: "<svg>" }.

const UA = { "user-agent": "rijal-rest-api/1.0" };
const fail = (msg, status = 400) => Object.assign(new Error(msg), { status });
const enc = encodeURIComponent;
const isUrl = (s) => /^https?:\/\/\S+$/i.test(s);

const get = async (url, opt = {}) => {
  const r = await fetch(url, { signal: AbortSignal.timeout(12000), headers: UA, ...opt });
  if (!r.ok) throw fail(`Server sumber membalas ${r.status}`, 502);
  return r;
};
const json = async (url, opt) => (await get(url, opt)).json();

const E = [];
const add = (cat, name, desc, params, run, extra = {}) => {
  if (E.some((e) => e.cat === cat && e.name === name)) throw new Error(`Endpoint ganda: ${cat}/${name}`);
  E.push({ cat, name, desc, params, run, kind: "ready", ...extra });
};

/* ---------- Tools ---------- */
add("tools", "qr", "Buat QR code dari teks", ["text"], (q) => ({
  redirect: `https://api.qrserver.com/v1/create-qr-code/?size=400x400&data=${enc(q.text)}`,
}), { out: "image" });

add("tools", "ssweb", "Screenshot sebuah website", ["url"], (q) => {
  if (!isUrl(q.url)) throw fail("url harus diawali http:// atau https://");
  return { redirect: `https://image.thum.io/get/width/1280/crop/720/${q.url}` };
}, { out: "image" });

add("tools", "shortlink", "Pendekkan link", ["url"], async (q) => {
  if (!isUrl(q.url)) throw fail("url harus diawali http:// atau https://");
  const d = await json(`https://is.gd/create.php?format=json&url=${enc(q.url)}`);
  if (d.errorcode) throw fail(d.errormessage);
  return { short: d.shorturl };
});

add("tools", "cekip", "Lokasi dan provider dari sebuah IP atau domain", ["ip"], async (q) => {
  const d = await json(`http://ip-api.com/json/${enc(q.ip)}?fields=status,message,query,country,regionName,city,isp`);
  if (d.status !== "success") throw fail(d.message || "IP tidak valid");
  return d;
});

add("tools", "tts", "Ubah teks jadi suara (maks 200 karakter)", ["text", "lang?"], (q) => ({
  redirect: `https://translate.google.com/translate_tts?ie=UTF-8&client=tw-ob&tl=${enc(q.lang || "id")}&q=${enc(q.text.slice(0, 200))}`,
}), { out: "audio" });

add("tools", "translate", "Terjemahkan teks (bahasa tujuan default: id)", ["text", "to?"], async (q) => {
  const to = (q.to || "id").toLowerCase();
  const d = await json(`https://api.mymemory.translated.net/get?q=${enc(q.text)}&langpair=autodetect|${enc(to)}`);
  return { to, hasil: d.responseData.translatedText };
});

/* ---------- AI ---------- */
add("ai", "ai", "Tanya jawab dengan AI", ["text"], async (q) => {
  const r = await get(`https://text.pollinations.ai/${enc(q.text)}`);
  return { jawaban: await r.text() };
});

add("ai", "text2img", "Buat gambar dari deskripsi", ["prompt"], (q) => ({
  redirect: `https://image.pollinations.ai/prompt/${enc(q.prompt)}`,
}), { out: "image" });

/* ---------- Maker (dibuat langsung di server) ---------- */
const esc = (s) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" }[c]));
const hex = (v, d) => (/^[0-9a-f]{3}([0-9a-f]{3})?$/i.test(v || "") ? `#${v}` : d);

add("maker", "brat", "Gambar gaya brat. Warna opsional dalam hex tanpa #", ["text", "bg?", "color?"], (q) => {
  const words = q.text.slice(0, 120).split(/\s+/);
  const lines = [];
  let cur = "";
  for (const w of words) {
    if (cur && (cur + " " + w).length > 16) { lines.push(cur); cur = w; }
    else cur = cur ? cur + " " + w : w;
  }
  if (cur) lines.push(cur);
  const longest = Math.max(...lines.map((l) => l.length), 5);
  const size = Math.min(150, Math.floor(940 / longest), Math.floor(470 / (lines.length * 1.1)));
  const spans = lines.map((l, i) => `<tspan x="24" y="${24 + size * (i * 1.1 + 0.85)}">${esc(l)}</tspan>`).join("");
  return {
    svg: `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">` +
      `<defs><filter id="b"><feGaussianBlur stdDeviation="1.3"/></filter></defs>` +
      `<rect width="512" height="512" fill="${hex(q.bg, "#8ACE00")}"/>` +
      `<text font-family="Arial Narrow, Arial, Helvetica, sans-serif" font-size="${size}" fill="${hex(q.color, "#000000")}" filter="url(#b)">${spans}</text></svg>`,
  };
}, { out: "image" });

/* ---------- Pencarian ---------- */
add("search", "wikipedia", "Ringkasan artikel Wikipedia Indonesia", ["q"], async (q) => {
  const d = await json(`https://id.wikipedia.org/api/rest_v1/page/summary/${enc(q.q)}`);
  return { judul: d.title, ringkasan: d.extract, gambar: d.thumbnail?.source || null, url: d.content_urls?.desktop?.page };
});

add("search", "lirik", "Lirik lagu", ["artist", "title"], async (q) => {
  const d = await json(`https://api.lyrics.ovh/v1/${enc(q.artist)}/${enc(q.title)}`);
  return { artist: q.artist, title: q.title, lirik: d.lyrics };
});

add("search", "quran", "Ayat Al-Quran dengan terjemahan Indonesia", ["surah", "ayat?"], async (q) => {
  const n = parseInt(q.surah, 10);
  if (!(n >= 1 && n <= 114)) throw fail("surah harus 1 sampai 114");
  const [ar, id] = (await json(`https://api.alquran.cloud/v1/surah/${n}/editions/quran-uthmani,id.indonesian`)).data;
  let ayat = ar.ayahs.map((a, i) => ({ ayat: a.numberInSurah, arab: a.text, arti: id.ayahs[i].text }));
  if (q.ayat) ayat = ayat.filter((a) => a.ayat === parseInt(q.ayat, 10));
  return { surah: ar.englishName, nama: ar.name, jumlahAyat: ar.numberOfAyahs, ayat };
});

add("search", "jadwalsholat", "Jadwal sholat hari ini untuk kota di Indonesia", ["kota"], async (q) => {
  const d = (await json(`https://api.aladhan.com/v1/timingsByCity?city=${enc(q.kota)}&country=Indonesia&method=20`)).data;
  const t = d.timings;
  return { kota: q.kota, tanggal: d.date.readable, subuh: t.Fajr, terbit: t.Sunrise, dzuhur: t.Dhuhr, ashar: t.Asr, maghrib: t.Maghrib, isya: t.Isha };
});

add("search", "animesearch", "Cari anime", ["q"], async (q) => {
  const d = await json(`https://api.jikan.moe/v4/anime?q=${enc(q.q)}&limit=5`);
  return d.data.map((a) => ({ judul: a.title, tipe: a.type, episode: a.episodes, skor: a.score, sinopsis: a.synopsis, gambar: a.images?.jpg?.image_url, url: a.url }));
});

/* ---------- Info ---------- */
add("info", "gempa", "Gempa terbaru dari BMKG", [], async () => {
  const g = (await json("https://data.bmkg.go.id/DataMKG/TEWS/autogempa.json")).Infogempa.gempa;
  return { ...g, Shakemap: `https://data.bmkg.go.id/DataMKG/TEWS/${g.Shakemap}` };
});

const kode = (c) => (c === 0 ? "Cerah" : c <= 3 ? "Berawan" : c <= 48 ? "Berkabut" : c <= 67 ? "Hujan" : c <= 77 ? "Salju" : c <= 82 ? "Hujan deras" : c <= 86 ? "Salju" : "Badai petir");
add("info", "cuaca", "Cuaca saat ini di sebuah kota", ["kota"], async (q) => {
  const g = (await json(`https://geocoding-api.open-meteo.com/v1/search?name=${enc(q.kota)}&count=1&language=id`)).results?.[0];
  if (!g) throw fail("Kota tidak ditemukan", 404);
  const c = (await json(`https://api.open-meteo.com/v1/forecast?latitude=${g.latitude}&longitude=${g.longitude}&current=temperature_2m,relative_humidity_2m,wind_speed_10m,weather_code&timezone=auto`)).current;
  return { kota: g.name, negara: g.country, cuaca: kode(c.weather_code), suhuC: c.temperature_2m, kelembapan: c.relative_humidity_2m, anginKmh: c.wind_speed_10m, waktu: c.time };
});

add("info", "kurs", "Kurs mata uang (default USD ke IDR)", ["base?", "to?"], async (q) => {
  const base = (q.base || "USD").toUpperCase();
  const to = (q.to || "IDR").toUpperCase();
  const d = await json(`https://open.er-api.com/v6/latest/${enc(base)}`);
  if (d.result !== "success" || !d.rates[to]) throw fail("Kode mata uang tidak dikenal");
  return { base, to, rate: d.rates[to], diperbarui: d.time_last_update_utc };
});

/* ---------- Profil publik ---------- */
add("stalk", "stalkgithub", "Profil publik GitHub", ["user"], async (q) => {
  const d = await json(`https://api.github.com/users/${enc(q.user)}`);
  return { username: d.login, nama: d.name, bio: d.bio, repo: d.public_repos, followers: d.followers, following: d.following, dibuat: d.created_at, avatar: d.avatar_url, url: d.html_url };
});

add("stalk", "stalknpm", "Info paket npm", ["name"], async (q) => {
  const d = await json(`https://registry.npmjs.org/${enc(q.name)}/latest`);
  return { nama: d.name, versi: d.version, deskripsi: d.description, lisensi: d.license, url: `https://www.npmjs.com/package/${d.name}` };
});

add("stalk", "stalkroblox", "Profil publik Roblox", ["user"], async (q) => {
  const h = { ...UA, "content-type": "application/json" };
  const f = await json("https://users.roblox.com/v1/usernames/users", { method: "POST", headers: h, body: JSON.stringify({ usernames: [q.user], excludeBannedUsers: true }) });
  if (!f.data?.[0]) throw fail("User tidak ditemukan", 404);
  const d = await json(`https://users.roblox.com/v1/users/${f.data[0].id}`);
  return { id: d.id, username: d.name, displayName: d.displayName, deskripsi: d.description, dibuat: d.created };
});

/* ---------- Hiburan ---------- */
add("fun", "jokes", "Lelucon acak (bahasa Inggris)", [], async () => {
  const d = await json("https://official-joke-api.appspot.com/random_joke");
  return { setup: d.setup, punchline: d.punchline };
});

add("fun", "quotes", "Kutipan acak", [], async () => {
  const [d] = await json("https://zenquotes.io/api/random");
  return { kutipan: d.q, penulis: d.a };
});

add("fun", "meme", "Meme acak", [], async () => {
  const d = await json("https://meme-api.com/gimme");
  return { judul: d.title, gambar: d.url, sumber: d.postLink };
});

require("./more")({ add, json, get, fail, enc, isUrl, esc, hex });

require("./providers")({ add, fail, enc, isUrl });

require("./luffy")({ add, fail, enc, isUrl });

require("./games")({ add, fail });

require("./local")({ add, fail });

require("./am")({ add, fail });

require("./mega")({ add, fail });

/* ---------- Export ---------- */
const meta = ({ run, ...m }) => ({ ...m, out: m.out || "json", methods: ["GET", "POST"], path: `/api/${m.cat}/${m.name}` });
module.exports = {
  list: () => E.map(meta),
  find: (cat, name) => E.find((e) => e.cat === String(cat).toLowerCase() && e.name === String(name).toLowerCase()),
};
