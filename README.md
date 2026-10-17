# Rijal Rest API

REST API publik (method GET dan POST, tanpa API key) + dashboard dokumentasi bertema One Piece.

## Jalankan lokal
    npm install
    npm start        # http://localhost:3000

## Deploy ke Vercel
1. Push folder ini ke GitHub, lalu Import di Vercel (atau pakai bot: `.deploy rijal-api-v2 user/repo`).
2. Tidak ada Environment Variables wajib. Semua endpoint langsung aktif.
   Opsional: FIREFLY_KEY (stalktt, stalkig) dan CUKI_KEY (cadangan pinterest) bila ingin pakai key sendiri.
3. Atur nama domain di Settings > Domains > Edit domain .vercel.app menjadi rijal-api-v2.vercel.app.

## Endpoint
817 endpoint, semua bisa lewat GET dan POST, tanpa API key. Daftar lengkap ada di /api/endpoints atau dashboard.

| Kategori | Isi | Sumber |
|---|---|---|
| am (7) | amprem, amsend, amverif, amverify, ambulk, ambulkrandom, ambulkcustom (Alight Motion) | Hyerls dan Alby, diambil dari plugin Luffy |
| convert (300) | konversi satuan: panjang, massa, volume, luas, kecepatan, data, waktu, energi, tekanan, suhu, contoh /api/convert/km-ke-mil | server sendiri |
| text (65), font (26), crypto (14), generator (14) | alat teks, gaya font unicode, hash, password dan acak | server sendiri |
| time (49), math (62), color (15), onepiece (10) | jam di 37 kota, hitungan, warna, data dan poster buronan One Piece | server sendiri |
| game (28) | tebak gambar, family100, asah otak, caklontong, truth, dare, cek jawaban, dll | data Luffy v4.8, diproses di server sendiri |
| utility, fun, islami, tools | kalkulator, konversi, weton, hijriah, jodoh, sandi, dll | diproses di server sendiri |
| maker (27), image (28), random (10) | fake lobby ML/FF, fake story IG, iqc, brat, edit foto AI, cecan, dll | provider dari plugin Luffy (nexray, api-faa, zenzxz, deline, cuki, nexadev, dll) |
| ai (15), search (21), stalk (16), download (15), music, info | AI chat, pencarian, profil, downloader | provider dari Luffy |

Endpoint yang diproses di server sendiri (612 endpoint) tidak bisa down dan tidak butuh internet. Endpoint provider bergantung pada layanan pihak ketiga:
bila layanan itu mati, API membalas JSON error yang rapi (bukan crash) dan bot bisa menampilkannya ke pengguna.
Endpoint gambar dan video menerima parameter url (maks 3 sampai 4 MB) karena respons Vercel dibatasi sekitar 4,5 MB.

## Method POST
Semua endpoint menerima GET (parameter di query) maupun POST (parameter di body JSON atau form). Hasilnya sama.

    curl -X POST https://DOMAINKAMU/api/text/upper -H "Content-Type: application/json" -d '{"text":"halo"}'
    curl -X POST https://DOMAINKAMU/api/am/amprem -H "Content-Type: application/json" -d '{"email":"nama@gmail.com"}'

Body maksimal 200 KB, nilai angka dan teks sama-sama diterima.

## Alight Motion (amprem, amverif, ambulk)
Diambil dari plugin Luffy v4.8. Alurnya sama dengan bot: kirim email dengan /api/am/amprem, buka inbox, lalu kirim email dan full link verifikasi ke /api/am/amverif.
/api/am/ambulk membuat 1 sampai 10 akun sekaligus (isi prefix untuk email custom).
Kunci API sumber disimpan di server. Untuk mengganti, isi Environment Variables Vercel: HYERLS_KEY dan ALBY_KEY.
Penting: repo GitHub yang publik akan memperlihatkan nilai awal kunci di lib/am.js. Pakai repo privat, atau kosongkan nilai awalnya dan hanya pakai Environment Variables.

## Dipakai dari bot WhatsApp
Format respons sukses (JSON):
    { "ok": true, "status": true, "creator": "Rijal", "data": {...}, "result": {...} }
`data` dan `result` isinya sama, pakai mana saja. Format gagal:
    { "ok": false, "status": false, "error": "pesan error", "message": "pesan error" }
Endpoint gambar, audio, dan video membalas file aslinya langsung (Content-Type image/*, audio/*, video/*).

Contoh Baileys / axios:
    const base = "https://rijal-api-v2.vercel.app";
    // JSON
    const { data } = await axios.get(`${base}/api/game/tebakgambar`, { validateStatus: () => true });
    if (!data.ok) return m.reply(data.error);
    await m.reply(data.result.jawaban);
    // Gambar
    const r = await axios.get(`${base}/api/maker/fakenote`, { params: { name, message }, responseType: "arraybuffer", validateStatus: () => true });
    if (!String(r.headers["content-type"]).startsWith("image/")) return m.reply(JSON.parse(Buffer.from(r.data)).error);
    await sock.sendMessage(m.chat, { image: Buffer.from(r.data) }, { quoted: m });
Selalu cek `ok` (atau Content-Type) sebelum memakai hasilnya. Nama parameter yang umum dipakai bot
(query, teks, link, user) otomatis dipetakan ke parameter yang benar, dan nama endpoint tidak peduli huruf besar kecil.

## Background video
Dashboard memutar video dari https://u.pone.rs/mgmihqou.mp4 (elemen #bgVideo di public/index.html). Ganti alamatnya di situ bila perlu. Pengguna dengan pengaturan "kurangi gerakan" otomatis melihat latar gradasi laut.

## Uji
    npm test
Menjalankan semua endpoint memakai fetch tiruan dalam 6 kondisi (normal, media langsung, error 500, respons sampah, internet mati, timeout)
dan memastikan setiap respons rapi, tidak crash, dan endpoint lokal tetap jalan saat internet mati. Ini menguji kode, bukan apakah layanan pihak ketiga hidup.

## Domain otomatis
Tidak ada yang perlu diubah di kode. Setelah deploy berhasil, dashboard memanggil /api/config dan seluruh contoh URL, tombol salin, dan kolom Base URL langsung memakai domain deploy:
- di Vercel (production): domain production project, yaitu custom domain bila sudah dipasang, kalau belum domain .vercel.app
- di preview deploy atau lokal: alamat yang sedang dibuka
Pasang custom domain di bagian bawah, dan Base URL berubah sendiri tanpa deploy ulang kode.

## Pasang domain sendiri (Vercel)
1. Beli domain (Niagahoster, Rumahweb, Namecheap, Cloudflare, dll).
2. Vercel > project > Settings > Domains > Add, isi domain (mis. api.domainkamu.com).
3. Atur DNS di tempat domain dikelola:
   - Subdomain (api.domainkamu.com):  CNAME  api  ->  cname.vercel-dns.com
   - Domain utama (domainkamu.com):   A      @    ->  76.76.21.21
   Jika memakai Cloudflare, set proxy ke "DNS only" (awan abu-abu) selama verifikasi.
4. Tunggu beberapa menit sampai status di Vercel menjadi Valid Configuration. HTTPS aktif otomatis.
5. Tes: https://api.domainkamu.com/api/endpoints
Nilai DNS yang tertulis di halaman Domains Vercel adalah yang paling benar, ikuti itu bila berbeda.

## Tambah endpoint
Edit lib/luffy.js (provider), lib/local.js dan lib/mega.js (lokal), lib/am.js (Alight Motion), lib/games.js (game), lib/more.js, atau lib/providers.js, panggil add(kategori, nama, deskripsi, [param], handler).
Dashboard ikut berubah otomatis. Jalankan `npm test` setelah menambah endpoint.
