// Endpoint "provider": downloader, musik, gambar, video, dan stalk.
// Logikanya dipindahkan dari bot Luffy v4.8 (src/scraper dan plugins), jadi tidak perlu PROVIDER_URL lagi.
// Beberapa layanan pihak ketiga bisa berubah atau down sewaktu-waktu. Itu di luar kendali API ini.
const fs = require("fs");
const os = require("os");
const path = require("path");
const crypto = require("crypto");
const { spawn } = require("child_process");

module.exports = ({ add, fail, enc, isUrl }) => {
  const UA = "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Mobile Safari/537.36";
  const UA_DESKTOP = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";
  // Key komunitas milik bot Luffy. Bisa diganti lewat Environment Variables.
  const FIREFLY_KEY = process.env.FIREFLY_KEY || "OurinNextGen";
  const CUKI_KEY = process.env.CUKI_KEY || "cuki-x";

  const heavy = { heavy: true };
  const MB = 1024 * 1024;

  /* ---------- helper ---------- */
  const req = async (url, opt = {}) => {
    const { timeout = 25000, ...rest } = opt;
    const r = await fetch(url, { signal: AbortSignal.timeout(timeout), ...rest });
    return r;
  };
  const getJson = async (url, opt = {}) => {
    const r = await req(url, { ...opt, headers: { "user-agent": UA_DESKTOP, accept: "application/json", ...(opt.headers || {}) } });
    if (!r.ok) throw fail(`Server sumber membalas ${r.status}`, 502);
    return r.json();
  };
  const postJson = (url, body, headers = {}, timeout) =>
    getJson(url, { method: "POST", timeout, headers: { "content-type": "application/json", ...headers }, body: JSON.stringify(body) });

  const needUrl = (u, hosts) => {
    if (!isUrl(u)) throw fail("url harus diawali http:// atau https://");
    if (hosts && !hosts.test(new URL(u).hostname)) throw fail("Link tidak sesuai dengan layanan endpoint ini");
    return u;
  };

  const assertPublic = (u) => {
    if (!isUrl(u)) throw fail("url harus diawali http:// atau https://");
    const host = new URL(u).hostname.toLowerCase();
    if (host === "localhost" || host.endsWith(".local") || host.endsWith(".internal") || !host.includes(".") || /^(\[|127\.|10\.|0\.|169\.254\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(host)) {
      throw fail("Alamat internal tidak diizinkan");
    }
  };

  // Unduh file dari url publik dengan batas ukuran (Vercel membatasi respons sekitar 4,5 MB).
  const download = async (u, max = 4 * MB, what = "File") => {
    assertPublic(u);
    const r = await req(u, { headers: { "user-agent": UA_DESKTOP }, timeout: 20000 });
    if (!r.ok) throw fail(`${what} gagal diunduh (status ${r.status})`, 502);
    const len = parseInt(r.headers.get("content-length") || "0", 10);
    if (len > max) throw fail(`${what} terlalu besar (maks ${Math.floor(max / MB)} MB)`);
    const buf = Buffer.from(await r.arrayBuffer());
    if (buf.length > max) throw fail(`${what} terlalu besar (maks ${Math.floor(max / MB)} MB)`);
    if (!buf.length) throw fail(`${what} kosong`);
    return { buf, type: r.headers.get("content-type") || "" };
  };

  const sharpLib = () => {
    try { return require("sharp"); } catch { throw fail("Modul sharp belum terpasang di server", 501); }
  };

  const ytId = (u) => String(u || "").match(/(?:youtube\.com\/(?:[^/]+\/.+\/|(?:v|e(?:mbed)?|shorts)\/|.*[?&]v=)|youtu\.be\/)([^"&?/\s]{11})/)?.[1] || null;
  const isYt = (u) => /(^|\.)(youtube\.com|youtu\.be)$/i.test(new URL(u).hostname);

  /* ---------- YouTube (scraper ytmp3.mobi seperti di bot) ---------- */
  const ymcdn = async (url, format = "mp3") => {
    const id = ytId(url);
    if (!id) throw fail("Link YouTube tidak valid");
    const h = { "user-agent": "Mozilla/5.0 (Linux; Android 16; NX729J) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.7271.123 Mobile Safari/537.36", referer: "https://id.ytmp3.mobi/" };
    const j = async (u) => {
      const r = await req(u, { headers: h, timeout: 20000 });
      if (!r.ok) throw fail(`Server sumber membalas ${r.status}`, 502);
      return r.json();
    };
    const init = await j(`https://d.ymcdn.org/api/v1/init?p=y&23=1llum1n471&_=${Math.random()}`);
    if (!init?.convertURL) throw fail("Gagal menginisialisasi server YouTube", 502);
    const sep = init.convertURL.includes("?") ? "&" : "?";
    const conv = await j(`${init.convertURL}${sep}v=${id}&f=${format}&_=${Math.random()}`);
    if (!conv?.progressURL || !conv?.downloadURL) throw fail("Gagal mendapatkan data konversi", 502);
    let progress = 0, title = conv.title || "";
    for (let i = 0; i < 40 && progress < 3; i++) {
      const p = await j(conv.progressURL);
      if ((p?.error || 0) > 0) throw fail(`Error dari server sumber: ${p.error}`, 502);
      progress = Number(p?.progress || 0);
      title = p?.title || title;
      if (progress < 3) await new Promise((r) => setTimeout(r, 400));
    }
    if (progress < 3) throw fail("Proses konversi terlalu lama", 504);
    return { id, title, download: conv.downloadURL, format };
  };

  const ytAudio = async (url) => {
    try {
      const d = await getJson(`https://my.izuka-api.xyz/api/downloader/ytmp3?url=${enc(url)}`, { timeout: 40000 });
      if (d?.result?.download_url) return { title: d.result.title, download: d.result.download_url, sumber: "izuka" };
    } catch {}
    const f = await ymcdn(url, "mp3");
    return { title: f.title, download: f.download, sumber: "ymcdn" };
  };

  const ytVideo = async (url) => {
    try {
      const d = await getJson(`https://my.izuka-api.xyz/api/downloader/ytmp4?url=${enc(url)}`, { timeout: 40000 });
      const v = (d?.result?.video_normal || []).filter((x) => x.ext === "mp4" && x.url).sort((a, b) => parseInt(b.quality) - parseInt(a.quality));
      if (v[0]) return { title: d.result.title, kualitas: v[0].quality, download: v[0].url, sumber: "izuka" };
    } catch {}
    const f = await ymcdn(url, "mp4");
    return { title: f.title, kualitas: "mp4", download: f.download, sumber: "ymcdn" };
  };

  /* ---------- TikTok (tikwm) ---------- */
  const tikwm = async (url) => {
    const q = new URLSearchParams({ url, count: "12", cursor: "0", web: "1", hd: "1" });
    const j = await getJson(`https://www.tikwm.com/api/?${q}`, {
      method: "POST",
      headers: { origin: "https://www.tikwm.com", referer: "https://www.tikwm.com/", "x-requested-with": "XMLHttpRequest", "content-type": "application/x-www-form-urlencoded; charset=UTF-8", "user-agent": UA },
    });
    const d = j?.data;
    if (!d) throw fail(j?.msg || "Video TikTok tidak ditemukan", 404);
    const abs = (u) => (u ? (/^https?:/i.test(u) ? u : `https://www.tikwm.com${u}`) : null);
    return {
      judul: d.title,
      author: d.author?.nickname,
      username: d.author?.unique_id,
      avatar: abs(d.author?.avatar),
      cover: abs(d.cover),
      durasi: d.duration,
      video: d.duration === 0 ? null : { hd: abs(d.hdplay), tanpaWatermark: abs(d.play), watermark: abs(d.wmplay) },
      gambar: (d.images || []).map(abs),
      musik: abs(d.music),
      statistik: { views: d.play_count, likes: d.digg_count, komentar: d.comment_count, share: d.share_count },
    };
  };

  /* ---------- Instagram / Facebook (azbry) ---------- */
  const instagram = async (url) => {
    const d = await getJson(`https://api.azbry.com/api/download/instagramv2?url=${enc(url)}`, { timeout: 40000 });
    if (!d?.status || !Array.isArray(d.links) || !d.links.length) throw fail("Gagal mengambil media Instagram. Pastikan postingannya publik.", 502);
    const first = d.links[0];
    return {
      username: d.author && d.author !== "Unknown" ? d.author : null,
      caption: first.text && first.text !== "null" ? first.text.trim() : "",
      thumbnail: first.thumbnail || d.thumbnail || null,
      media: d.links.map((x) => ({ type: /video|mp4/i.test(x.type || "") || /\.mp4/i.test(x.url || "") ? "video" : "image", url: x.url, thumbnail: x.thumbnail || null })),
    };
  };

  const facebook = async (url) => {
    const d = await getJson(`https://api.azbry.com/api/download/facebook?url=${enc(url)}`, { timeout: 40000 });
    if (!d?.status) throw fail(d?.message || "Gagal mengambil video Facebook. Pastikan videonya publik.", 502);
    const { status, ...rest } = d;
    return rest;
  };

  /* ---------- Twitter / X (x2twitter) ---------- */
  const twitter = async (url) => {
    const cf = ["0", crypto.randomBytes(16).toString("hex"), crypto.randomBytes(32).toString("base64url"), crypto.randomBytes(64).toString("base64url"), crypto.randomBytes(32).toString("hex")].join(".");
    const r = await req("https://x2twitter.com/api/ajaxSearch", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded; charset=UTF-8", "x-requested-with": "XMLHttpRequest", origin: "https://x2twitter.com", referer: "https://x2twitter.com/id", "user-agent": UA_DESKTOP, cookie: `_session=${crypto.randomBytes(16).toString("hex")}; lang=id` },
      body: new URLSearchParams({ q: url, lang: "id", cftoken: cf }),
    });
    if (!r.ok) throw fail(`Server sumber membalas ${r.status}`, 502);
    const j = await r.json();
    if (j.status !== "ok") throw fail("Gagal mengambil data dari x2twitter. Pastikan tweet publik dan berisi video.", 502);
    const html = j.data;
    const videos = [...html.matchAll(/href="https:\/\/dl\.snapcdn\.app\/get\?token=([^"]+)"/g)]
      .map((m) => {
        try {
          const dec = JSON.parse(Buffer.from(m[1].split(".")[1], "base64").toString("utf8"));
          if (dec.filename && /\.(jpe?g|png)$/i.test(dec.filename)) return null;
          return { resolusi: dec.filename ? dec.filename.split("_").pop().replace(".mp4", "") : "unknown", url: `https://dl.snapcdn.app/get?token=${m[1]}` };
        } catch { return null; }
      })
      .filter(Boolean);
    if (!videos.length) throw fail("Video tidak ditemukan di tweet ini", 404);
    return { thumbnail: (html.match(/<img\s+src="([^"]+)"/) || [])[1] || null, durasi: (html.match(/<p>(\d+:\d+)<\/p>/) || [])[1] || null, video: videos };
  };

  /* ---------- Threads (threadsvid) ---------- */
  const threads = async (url) => {
    const q = new URLSearchParams({ url, action: "info" });
    const d = await getJson(`https://workers-playground-cool-wood-c008.accoutydusra.workers.dev/?${q}`, {
      timeout: 40000,
      headers: { origin: "https://threadsvid.com", referer: "https://threadsvid.com/", "user-agent": UA },
    });
    const info = d?.data || {};
    const uniq = (l = []) => { const s = new Set(); return l.filter((x) => x?.url && !s.has(x.url) && s.add(x.url)); };
    const media = [
      ...uniq(info.video?.qualities).map((v) => ({ type: "video", kualitas: v.quality || null, url: v.url })),
      ...uniq(info.images?.urls).map((v) => ({ type: "image", url: v.url })),
    ];
    if (d?.success !== true || !media.length) throw fail(d?.message || d?.error || "Gagal mengambil Threads. Postingan mungkin privat atau sudah dihapus.", 502);
    return { author: info.author || null, teks: String(info.title || info.description || "").trim(), media };
  };

  /* ---------- CapCut / Pinterest (btch-downloader) ---------- */
  const btch = async () => {
    try { return await import("btch-downloader"); } catch { throw fail("Modul btch-downloader belum terpasang di server", 501); }
  };

  const capcut = async (url) => {
    const { capcut: cc } = await btch();
    const d = await cc(url);
    if (!d?.status || !d?.originalVideoUrl) throw fail("Video CapCut tidak ditemukan", 404);
    return { judul: d.title || null, thumbnail: d.thumbnail || null, video: d.originalVideoUrl };
  };

  /* ---------- MediaFire ---------- */
  const mediafire = async (url) => {
    const r = await req(url, { headers: { "user-agent": "Mozilla/5.0", accept: "text/html,application/xhtml+xml" }, timeout: 25000 });
    if (!r.ok) throw fail(`MediaFire membalas ${r.status}`, 502);
    const cheerio = require("cheerio");
    const $ = cheerio.load(await r.text());
    const link = $("#downloadButton").attr("href") || $('a[aria-label="Download file"]').attr("href") || "";
    if (!link) throw fail("Link download MediaFire tidak ditemukan", 404);
    const label = $("#downloadButton").text().trim();
    return {
      nama: $('meta[property="og:title"]').attr("content") || $("title").text().trim() || null,
      deskripsi: $('meta[property="og:description"]').attr("content") || null,
      ukuran: (label.match(/\(([^)]+)\)/) || [])[1] || null,
      download: link,
    };
  };

  /* ---------- savefbs (cadangan umum untuk aio) ---------- */
  const savefbs = async (url) => {
    const H = { accept: "*/*", "content-type": "application/json", referer: "https://savefbs.com/all-in-one-video-downloader/", "user-agent": UA };
    const base = "https://savefbs.com/api/v1/aio";
    const html = await (await req(`${base}/html`, { method: "POST", headers: H, body: JSON.stringify({ vid: url, prefix: "savefbs.com", ex: "", format: "" }) })).text();
    const cheerio = require("cheerio");
    const $ = cheerio.load(html);
    const token = $(".aio-format-btn").first().attr("data-loader-id");
    const formats = [];
    $(".aio-format-btn").each((_, el) => { const m = ($(el).attr("onclick") || "").match(/'([^']+)'/); if (m) formats.push(m[1]); });
    if (!token || !formats.length) throw fail("Layanan sumber tidak mengembalikan data untuk link ini", 502);
    const best = ["1080", "720", "480", "360"].find((f) => formats.includes(f)) || formats.find((f) => !["mp3", "wav"].includes(f)) || formats[0];
    const dl = await (await req(`${base}/download`, { method: "POST", headers: H, body: JSON.stringify({ token, format: best }) })).json();
    const u = dl?.url || dl?.download || dl?.data?.url;
    if (!u) throw fail("Layanan sumber tidak memberi link download", 502);
    return { judul: $("h3.text-sm").text().trim() || null, thumbnail: $("img.aio-thumbnail").attr("src") || null, media: [{ type: ["mp3", "wav"].includes(best) ? "audio" : "video", kualitas: best, url: u }] };
  };

  const host = (u) => new URL(u).hostname.toLowerCase();
  const TT = /(^|\.)tiktok\.com$/, IG = /(^|\.)instagram\.com$/, FB = /(^|\.)(facebook\.com|fb\.watch|fb\.com)$/, TW = /(^|\.)(twitter\.com|x\.com)$/, TH = /(^|\.)threads\.(net|com)$/, CC = /(^|\.)capcut\.com$/, MF = /(^|\.)mediafire\.com$/;

  /* ---------- Endpoint: Download ---------- */
  add("download", "tiktok", "Download video TikTok tanpa watermark", ["url"], (q) => tikwm(needUrl(q.url, TT)), heavy);
  add("download", "instagram", "Download post, reel, atau story Instagram", ["url"], (q) => instagram(needUrl(q.url, IG)), heavy);
  add("download", "facebook", "Download video Facebook", ["url"], (q) => facebook(needUrl(q.url, FB)), heavy);
  add("download", "twitter", "Download video dari X/Twitter", ["url"], (q) => twitter(needUrl(q.url, TW)), heavy);
  add("download", "threads", "Download media dari Threads", ["url"], (q) => threads(needUrl(q.url, TH)), heavy);
  add("download", "capcut", "Download template CapCut", ["url"], (q) => capcut(needUrl(q.url, CC)), heavy);
  add("download", "mediafire", "Link download dari MediaFire", ["url"], (q) => mediafire(needUrl(q.url, MF)), heavy);

  add("download", "youtube", "Info dan link download YouTube (video MP4 dan audio MP3)", ["url"], async (q) => {
    needUrl(q.url);
    if (!isYt(q.url)) throw fail("Link harus dari YouTube");
    const id = ytId(q.url);
    if (!id) throw fail("Link YouTube tidak valid");
    const [v, a] = await Promise.allSettled([ytVideo(q.url), ytAudio(q.url)]);
    if (v.status === "rejected" && a.status === "rejected") throw v.reason;
    return {
      id,
      judul: (v.value || a.value).title,
      thumbnail: `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
      video: v.status === "fulfilled" ? { kualitas: v.value.kualitas, url: v.value.download } : null,
      audio: a.status === "fulfilled" ? { url: a.value.download } : null,
    };
  }, heavy);

  add("download", "ytmp3", "YouTube ke audio MP3", ["url"], async (q) => {
    needUrl(q.url);
    if (!isYt(q.url)) throw fail("Link harus dari YouTube");
    const r = await ytAudio(q.url);
    return { judul: r.title, download: r.download, format: "mp3" };
  }, heavy);

  add("download", "ytmp4", "YouTube ke video MP4", ["url"], async (q) => {
    needUrl(q.url);
    if (!isYt(q.url)) throw fail("Link harus dari YouTube");
    const r = await ytVideo(q.url);
    return { judul: r.title, kualitas: r.kualitas, download: r.download, format: "mp4" };
  }, heavy);

  add("download", "aio", "Download dari TikTok, Instagram, Facebook, YouTube, Twitter, Threads, CapCut, dan lainnya", ["url"], async (q) => {
    needUrl(q.url);
    const h = host(q.url);
    const wrap = (platform, judul, thumbnail, media) => ({ platform, judul, thumbnail, media });
    try {
      if (TT.test(h)) {
        const d = await tikwm(q.url);
        const media = d.video ? [d.video.hd && { type: "video", kualitas: "HD", url: d.video.hd }, d.video.tanpaWatermark && { type: "video", kualitas: "NoWM", url: d.video.tanpaWatermark }].filter(Boolean) : d.gambar.map((u) => ({ type: "image", url: u }));
        return wrap("tiktok", d.judul, d.cover, media);
      }
      if (IG.test(h)) { const d = await instagram(q.url); return wrap("instagram", d.caption || d.username, d.thumbnail, d.media); }
      if (isYt(q.url)) {
        const [v, a] = await Promise.allSettled([ytVideo(q.url), ytAudio(q.url)]);
        const media = [];
        if (v.status === "fulfilled") media.push({ type: "video", kualitas: v.value.kualitas, url: v.value.download });
        if (a.status === "fulfilled") media.push({ type: "audio", kualitas: "mp3", url: a.value.download });
        if (!media.length) throw v.reason;
        return wrap("youtube", (v.value || a.value).title, `https://i.ytimg.com/vi/${ytId(q.url)}/hqdefault.jpg`, media);
      }
      if (FB.test(h)) { const d = await facebook(q.url); const u = d.HD || d.Normal_video || d.hd || d.sd || d.url; if (!u) throw fail("Video tidak ditemukan"); return wrap("facebook", d.title, d.thumbnail, [{ type: "video", kualitas: d.HD || d.hd ? "HD" : "SD", url: u }]); }
      if (CC.test(h)) { const d = await capcut(q.url); return wrap("capcut", d.judul, d.thumbnail, [{ type: "video", url: d.video }]); }
      if (TW.test(h)) { const d = await twitter(q.url); return wrap("twitter", null, d.thumbnail, d.video.map((v) => ({ type: "video", kualitas: v.resolusi, url: v.url }))); }
      if (TH.test(h)) { const d = await threads(q.url); return wrap("threads", d.teks, null, d.media); }
    } catch (err) {
      // lanjut ke layanan cadangan
      try { const d = await savefbs(q.url); return wrap("savefbs", d.judul, d.thumbnail, d.media); } catch { throw err; }
    }
    const d = await savefbs(q.url);
    return wrap("savefbs", d.judul, d.thumbnail, d.media);
  }, heavy);

  /* ---------- Endpoint: Musik ---------- */
  const yts = async (query, n = 10) => {
    let lib;
    try { lib = require("yt-search"); } catch { throw fail("Modul yt-search belum terpasang di server", 501); }
    const r = await lib(query);
    return (r.videos || []).slice(0, n);
  };

  add("music", "spotify", "Cari lagu Spotify, atau isi link track untuk dapat link download", ["q"], async (q) => {
    if (isUrl(q.q) && /open\.spotify\.com\/track\//i.test(q.q)) {
      const d = await postJson("https://spotyloader.com/api/spotify/track", { url: q.q }, { referer: "https://spotyloader.com/", origin: "https://spotyloader.com" }, 40000);
      if (!d?.downloadLink) throw fail("Gagal mendapatkan link download Spotify", 502);
      return { judul: d.post?.name, artis: d.post?.artist, format: d.post?.mime, download: d.downloadLink };
    }
    const d = await getJson(`https://api.nexray.eu.cc/search/spotify?q=${enc(q.q)}`, { timeout: 30000 });
    if (!d?.status || !Array.isArray(d.result) || !d.result.length) throw fail("Lagu tidak ditemukan", 404);
    return d.result.slice(0, 10);
  }, heavy);

  add("music", "play", "Cari lagu di YouTube lalu beri link audionya", ["q"], async (q) => {
    const [v] = await yts(q.q, 1);
    if (!v) throw fail("Video tidak ditemukan", 404);
    let audio;
    try {
      const d = await getJson(`https://api.azbry.com/api/download/ytmp3?url=${enc(v.url)}`, { timeout: 40000 });
      audio = d?.status && d?.result?.download;
    } catch {}
    if (!audio) audio = (await ymcdn(v.url, "mp3")).download;
    return { judul: v.title, channel: v.author?.name, durasi: v.duration?.timestamp, views: v.views, diunggah: v.ago, thumbnail: v.thumbnail, url: v.url, audio };
  }, heavy);

  add("search", "ytsearch", "Cari video YouTube", ["q"], async (q) => {
    const list = await yts(q.q, 10);
    if (!list.length) throw fail("Video tidak ditemukan", 404);
    return list.map((v) => ({ judul: v.title, id: v.videoId, url: v.url, durasi: v.duration?.timestamp, views: v.views, diunggah: v.ago, channel: v.author?.name, thumbnail: v.thumbnail }));
  });

  add("search", "pinterest", "Cari gambar Pinterest", ["q"], async (q) => {
    const pick = (d) => [d?.result?.result?.result, d?.result?.result, d?.result, d?.data?.results, d?.results].find(Array.isArray) || [];
    const img = (i) => (typeof i === "string" ? i : i?.image_url || i?.image || i?.images?.orig?.url || i?.images?.["736x"]?.url || i?.images?.["564x"]?.url || i?.url || i?.thumbnail || null);
    let list = [];
    try { const { pinterest } = await btch(); list = pick(await pinterest(q.q)).filter(img); } catch {}
    if (!list.length) {
      try { list = pick(await getJson(`https://api.cuki.biz.id/api/search/pinterest?apikey=${enc(CUKI_KEY)}&query=${enc(q.q)}&type=image`, { timeout: 30000 })).filter(img); } catch {}
    }
    if (!list.length) throw fail("Gambar tidak ditemukan", 404);
    return list.slice(0, 10).map((i) => ({ gambar: img(i), judul: i?.title || i?.grid_title || null, url: i?.pin_url || i?.link || null }));
  }, heavy);

  /* ---------- Endpoint: Gambar ---------- */
  const out = (buf, type) => ({ buffer: buf, type });
  const sniff = (buf) => (buf.slice(0, 4).toString("hex") === "89504e47" ? "image/png" : buf.slice(0, 3).toString("hex") === "ffd8ff" ? "image/jpeg" : buf.slice(8, 12).toString() === "WEBP" ? "image/webp" : "image/png");

  add("image", "hdimage", "Perjelas gambar jadi HD (url gambar, maks 4 MB)", ["url", "method?"], async (q) => {
    const { buf } = await download(q.url, 4 * MB, "Gambar");
    const form = new FormData();
    form.set("method", String(Math.min(4, Math.max(1, parseInt(q.method, 10) || 1))));
    form.set("is_pro_version", "true");
    form.set("is_enhancing_more", "false");
    form.set("max_image_size", "high");
    form.set("file", new Blob([buf], { type: "image/jpeg" }), "file.jpg");
    const r = await req("https://ihancer.com/api/enhance", { method: "POST", headers: { "user-agent": UA, referer: "https://ihancer.com/app/" }, body: form, timeout: 55000 });
    if (!r.ok) throw fail(`Server sumber membalas ${r.status}`, 502);
    const o = Buffer.from(await r.arrayBuffer());
    return out(o, sniff(o));
  }, { ...heavy, out: "image" });

  add("image", "removebg", "Hapus latar belakang gambar (url gambar, maks 4 MB)", ["url"], async (q) => {
    const { buf } = await download(q.url, 4 * MB, "Gambar");
    const form = new FormData();
    form.append("image", new Blob([buf], { type: "image/jpeg" }), "image.jpg");
    form.append("format", "png");
    form.append("model", "v1");
    const r = await req("https://api2.pixelcut.app/image/matte/v1", {
      method: "POST", timeout: 55000, body: form,
      headers: { "user-agent": UA, accept: "application/json, text/plain, */*", "x-locale": "en", "x-client-version": "web:pixa.com:4a5b0af2", origin: "https://www.pixa.com", referer: "https://www.pixa.com/", "accept-language": "id-ID,id;q=0.9,en;q=0.7" },
    });
    if (!r.ok) throw fail(`Server sumber membalas ${r.status}`, 502);
    return out(Buffer.from(await r.arrayBuffer()), "image/png");
  }, { ...heavy, out: "image" });

  // Edit gambar dengan AI (upload ke imgupscaler lalu nanobanana), dipakai toanime, tohitam, colorize.
  const aiEdit = async (u, prompt) => {
    const { buf } = await download(u, 4 * MB, "Gambar");
    const H = { "user-agent": UA_DESKTOP, accept: "*/*", origin: "https://imgupscaler.ai", referer: "https://imgupscaler.ai/" };
    const api = "https://api.imgupscaler.ai";
    const f1 = new FormData();
    f1.append("file_name", `${crypto.randomUUID()}.jpg`);
    const reg = await (await req(`${api}/api/common/upload/upload-image`, { method: "POST", headers: H, body: f1 })).json();
    const { url: putUrl, object_name } = reg?.result || {};
    if (!putUrl) throw fail("Gagal menyiapkan upload gambar", 502);
    const put = await req(putUrl, { method: "PUT", headers: { "content-type": "image/jpeg" }, body: buf, timeout: 30000 });
    if (!put.ok) throw fail("Gagal mengunggah gambar ke layanan sumber", 502);
    const f2 = new FormData();
    f2.append("object_name", object_name);
    const signed = await (await req(`${api}/api/common/upload/sign-object`, { method: "POST", headers: H, body: f2 })).json();
    const imgUrl = signed?.result?.url;
    if (!imgUrl) throw fail("Gagal mengambil link gambar yang diunggah", 502);
    const d = await getJson(`https://kyzznekoo.zone.id/api/img/v2/nanobanana?url=${enc(imgUrl)}&prompt=${enc(prompt)}`, { timeout: 55000 });
    const res = d?.data?.result_url;
    if (!d?.status || !res) throw fail("Gagal mengedit gambar dengan AI", 502);
    const o = await download(res, 8 * MB, "Hasil gambar");
    return out(o.buf, sniff(o.buf));
  };

  add("image", "toanime", "Ubah foto jadi gaya anime Ghibli (url gambar, maks 4 MB)", ["url"], (q) =>
    aiEdit(q.url, "Transform this image into Studio Ghibli anime style. Make the characters look like they belong in a Ghibli movie with soft colors, detailed backgrounds, expressive eyes, and that signature warm, magical atmosphere. Keep the original composition but apply the distinct Ghibli artistic style."),
  { ...heavy, out: "image" });

  add("image", "tohitam", "Ubah warna kulit pada foto jadi hitam (url gambar, maks 4 MB)", ["url"], (q) =>
    aiEdit(q.url, "Transform skin tone to a darker complexion, maintain facial features, realistic shadows, high detail, natural skin texture, no distortion"),
  { ...heavy, out: "image" });

  add("image", "colorize", "Beri warna pada foto hitam putih (url gambar, maks 4 MB)", ["url"], (q) =>
    aiEdit(q.url, "Colorize this black and white photo with natural, realistic colors. Keep all details, faces, and the original composition unchanged."),
  { ...heavy, out: "image" });

  add("image", "sticker", "Ubah gambar jadi stiker WebP 512x512 (url gambar, maks 4 MB)", ["url"], async (q) => {
    const sharp = sharpLib();
    const { buf } = await download(q.url, 4 * MB, "Gambar");
    let o;
    try {
      o = await sharp(buf, { animated: true }).resize(512, 512, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } }).webp({ quality: 85 }).toBuffer();
    } catch { throw fail("File bukan gambar yang valid"); }
    return out(o, "image/webp");
  }, { out: "image" });

  add("image", "toimg", "Ubah stiker (WebP) jadi gambar PNG (url stiker, maks 4 MB)", ["url"], async (q) => {
    const sharp = sharpLib();
    const { buf } = await download(q.url, 4 * MB, "Stiker");
    let o;
    try { o = await sharp(buf).png().toBuffer(); } catch { throw fail("File bukan gambar atau stiker yang valid"); }
    return out(o, "image/png");
  }, { out: "image" });

  const memeSeg = (s) => (!s ? "_" : enc(s.replace(/_/g, "__").replace(/-/g, "--").replace(/\s/g, "_").replace(/\?/g, "~q").replace(/%/g, "~p").replace(/#/g, "~h").replace(/\//g, "~s").replace(/"/g, "''")));
  add("image", "smeme", "Stiker meme dengan teks atas dan bawah (url gambar)", ["url", "top", "bottom?"], (q) => {
    assertPublic(q.url);
    return { redirect: `https://api.memegen.link/images/custom/${memeSeg(q.top)}/${memeSeg(q.bottom)}.png?background=${enc(q.url)}` };
  }, { out: "image" });

  /* ---------- Endpoint: Video ---------- */
  let ffBin;
  const ffmpegPath = () => {
    if (ffBin) return ffBin;
    let src;
    try { src = require("ffmpeg-static"); } catch { throw fail("ffmpeg belum terpasang di server", 501); }
    if (!src || !fs.existsSync(src)) throw fail("Binary ffmpeg tidak ditemukan di server", 501);
    const dst = path.join(os.tmpdir(), "ffmpeg-bin");
    if (!fs.existsSync(dst)) { fs.copyFileSync(src, dst); fs.chmodSync(dst, 0o755); }
    return (ffBin = dst);
  };

  const ffmpeg = (input, ext, args, outExt = "mp4") =>
    new Promise((resolve, reject) => {
      const id = crypto.randomBytes(6).toString("hex");
      const inP = path.join(os.tmpdir(), `in-${id}.${ext}`);
      const outP = path.join(os.tmpdir(), `out-${id}.${outExt}`);
      const clean = () => { for (const f of [inP, outP]) try { fs.unlinkSync(f); } catch {} };
      fs.writeFileSync(inP, input);
      let err = "";
      const p = spawn(ffmpegPath(), ["-y", ...args.pre, "-i", inP, ...args.post, outP]);
      const timer = setTimeout(() => p.kill("SIGKILL"), 45000);
      p.stderr.on("data", (d) => (err = (err + d).slice(-400)));
      p.on("error", (e) => { clearTimeout(timer); clean(); reject(fail(`ffmpeg gagal dijalankan: ${e.message}`, 500)); });
      p.on("close", (code) => {
        clearTimeout(timer);
        try {
          if (code !== 0 || !fs.existsSync(outP)) throw fail("Gagal memproses video. Pastikan file valid dan tidak terlalu besar.", 422);
          const buf = fs.readFileSync(outP);
          if (buf.length > 4.4 * MB) throw fail("Hasil video melebihi batas respons server (4,4 MB). Pakai file yang lebih pendek atau kecil.", 413);
          resolve(buf);
        } catch (e) { reject(e); } finally { clean(); }
      });
    });

  add("video", "hdvideo", "Perjelas video jadi HD 2x (url video, maks 3 MB dan 15 detik pertama)", ["url"], async (q) => {
    const { buf } = await download(q.url, 3 * MB, "Video");
    const o = await ffmpeg(buf, "mp4", {
      pre: [],
      post: ["-t", "15", "-vf", "scale='min(1280,iw*2)':-2:flags=lanczos", "-c:v", "libx264", "-preset", "veryfast", "-crf", "26", "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "96k", "-movflags", "faststart"],
    });
    return out(o, "video/mp4");
  }, { ...heavy, out: "video" });

  add("video", "tovid", "Ubah gambar atau stiker animasi jadi video MP4 (url file, maks 4 MB)", ["url"], async (q) => {
    const sharp = sharpLib();
    const { buf } = await download(q.url, 4 * MB, "File");
    let meta;
    try { meta = await sharp(buf, { animated: true }).metadata(); } catch { throw fail("File bukan gambar yang valid"); }
    const post = ["-movflags", "faststart", "-pix_fmt", "yuv420p", "-vf", "scale=trunc(iw/2)*2:trunc(ih/2)*2", "-c:v", "libx264", "-preset", "veryfast", "-crf", "26"];
    let o;
    if ((meta.pages || 1) > 1) {
      const gif = await sharp(buf, { animated: true, pages: -1 }).gif({ loop: 0 }).toBuffer();
      o = await ffmpeg(gif, "gif", { pre: [], post });
    } else {
      const png = await sharp(buf).png().toBuffer();
      o = await ffmpeg(png, "png", { pre: ["-loop", "1", "-t", "5"], post: ["-t", "5", ...post] });
    }
    return out(o, "video/mp4");
  }, { ...heavy, out: "video" });

  add("video", "bratvid", "Video animasi gaya brat (maks 100 karakter)", ["text"], (q) => ({
    redirect: `https://api-faa.my.id/faa/bratvid?text=${enc(q.text.slice(0, 100))}`,
  }), { out: "video" });

  /* ---------- Endpoint: Stalk ---------- */
  add("stalk", "stalkff", "Profil Free Fire dari ID", ["id"], async (q) => {
    if (!/^\d{5,15}$/.test(q.id)) throw fail("id Free Fire harus berupa angka");
    const d = await getJson(`https://api.nexray.eu.cc/stalker/freefire?uid=${q.id}`, { timeout: 30000 });
    if (!d?.status || !d?.result) throw fail(`ID ${q.id} tidak ditemukan`, 404);
    return d.result;
  }, heavy);

  add("stalk", "stalkml", "Profil Mobile Legends dari ID dan zone", ["id", "zone"], async (q) => {
    if (!/^\d{4,15}$/.test(q.id) || !/^\d{1,6}$/.test(q.zone)) throw fail("id dan zone harus berupa angka");
    const d = await getJson(`https://api.isan.eu.org/nickname/ml?id=${q.id}&server=${q.zone}`, { timeout: 15000 });
    if (!d?.success) throw fail("Akun tidak ditemukan. Periksa id dan zone", 404);
    return { id: q.id, zone: q.zone, nickname: d.name };
  }, heavy);

  add("stalk", "stalktt", "Profil publik TikTok", ["user"], async (q) => {
    const user = q.user.replace(/^@/, "");
    if (!/^[\w.]{1,40}$/.test(user)) throw fail("username tidak valid");
    const d = await getJson(`https://firefly.maiku.my.id/api/stalk-tiktok?apikey=${enc(FIREFLY_KEY)}&username=${enc(user)}`, { timeout: 30000 });
    if (!d?.status || !d?.data) throw fail(`Username @${user} tidak ditemukan`, 404);
    const x = d.data;
    return { username: x.username, nama: x.nickname, verified: !!x.verified, private: !!x.private, avatar: x.avatar, bio: x.signature, statistik: x.stats, url: `https://tiktok.com/@${x.username}` };
  }, heavy);

  add("stalk", "stalkig", "Profil publik Instagram", ["user"], async (q) => {
    const user = q.user.replace(/^@/, "");
    if (!/^[\w.]{1,40}$/.test(user)) throw fail("username tidak valid");
    const d = await getJson(`https://firefly.maiku.my.id/api/stalk-instagram?apikey=${enc(FIREFLY_KEY)}&username=${enc(user)}`, { timeout: 30000 });
    if (!d?.status || !d?.data?.username) throw fail(`Username @${user} tidak ditemukan`, 404);
    return { ...d.data, url: `https://instagram.com/${d.data.username}` };
  }, heavy);

  // Kode negara umum untuk stalkwa
  const CC_TABLE = { 1: "Amerika Serikat/Kanada", 7: "Rusia/Kazakhstan", 20: "Mesir", 27: "Afrika Selatan", 31: "Belanda", 33: "Prancis", 34: "Spanyol", 39: "Italia", 44: "Inggris", 49: "Jerman", 51: "Peru", 52: "Meksiko", 54: "Argentina", 55: "Brasil", 60: "Malaysia", 61: "Australia", 62: "Indonesia", 63: "Filipina", 64: "Selandia Baru", 65: "Singapura", 66: "Thailand", 81: "Jepang", 82: "Korea Selatan", 84: "Vietnam", 86: "Tiongkok", 90: "Turki", 91: "India", 92: "Pakistan", 93: "Afganistan", 94: "Sri Lanka", 95: "Myanmar", 212: "Maroko", 234: "Nigeria", 880: "Bangladesh", 886: "Taiwan", 966: "Arab Saudi", 971: "Uni Emirat Arab", 974: "Qatar", 673: "Brunei", 855: "Kamboja", 856: "Laos" };
  add("stalk", "stalkwa", "Info format nomor WhatsApp (negara dan link wa.me)", ["number"], (q) => {
    const n = q.number.replace(/\D/g, "").replace(/^0/, "62");
    if (n.length < 7 || n.length > 15) throw fail("Nomor tidak valid. Pakai format internasional, contoh: 628123456789");
    const code = [3, 2, 1].map((l) => n.slice(0, l)).find((c) => CC_TABLE[c]);
    return {
      nomor: n,
      kodeNegara: code ? `+${code}` : null,
      negara: code ? CC_TABLE[code] : "Tidak dikenali",
      link: `https://wa.me/${n}`,
      catatan: "API publik tidak bisa memeriksa apakah nomor terdaftar, foto, atau bio, karena itu butuh sesi WhatsApp bot.",
    };
  });

  /* ---------- Endpoint: Tools ---------- */
  add("tools", "cekidch", "Info saluran WhatsApp dari link (nama, deskripsi, gambar)", ["url"], async (q) => {
    const m = /^https?:\/\/(?:www\.)?whatsapp\.com\/channel\/([\w-]{10,})/i.exec(q.url.trim());
    if (!m) throw fail("Link harus berformat https://whatsapp.com/channel/xxxx");
    const r = await req(`https://whatsapp.com/channel/${m[1]}`, { headers: { "user-agent": "WhatsApp/2.23 A", "accept-language": "id,en;q=0.8" } });
    if (!r.ok) throw fail("Saluran tidak ditemukan", 404);
    const html = await r.text();
    const og = (k) => (html.match(new RegExp(`<meta[^>]+property="og:${k}"[^>]+content="([^"]*)"`, "i")) || [])[1];
    const dec = (s) => (s || "").replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#039;|&#x27;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">");
    return {
      kode: m[1],
      nama: dec(og("title")) || null,
      deskripsi: dec(og("description")) || null,
      gambar: og("image") || null,
      url: `https://whatsapp.com/channel/${m[1]}`,
      catatan: "ID numerik (@newsletter) hanya bisa diambil lewat sesi bot WhatsApp. Gunakan kode di atas untuk newsletterMetadata.",
    };
  }, heavy);
};
