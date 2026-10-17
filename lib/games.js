// Endpoint game dan konten acak dari data bot Luffy v4.8 (folder data/).
// Diproses di server sendiri: tanpa pihak ketiga, jadi selalu aktif.
// Setiap file dibaca dengan require statis supaya ikut terbundel saat deploy ke Vercel.

const DATA = {
  asahotak: require("../data/asahotak.json"),
  caklontong: require("../data/caklontong.json"),
  family100: require("../data/family100.json"),
  kataacak: require("../data/kataacak.json"),
  riddle: require("../data/riddle.json"),
  siapakahaku: require("../data/siapakahaku.json"),
  susunkata: require("../data/susunkata.json"),
  tebakbendera: require("../data/tebakbendera2.json"),
  tebakdrakor: require("../data/tebakdrakor.json"),
  tebakepep: require("../data/tebakepep.json"),
  tebakfilm: require("../data/tebakfilm.json"),
  tebakgambar: require("../data/tebakgambar.json"),
  tebakhewan: require("../data/tebakhewan.json"),
  tebakjkt48: require("../data/tebakjkt48.json"),
  tebakkalimat: require("../data/tebakkalimat.json"),
  tebakkata: require("../data/tebakkata.json"),
  tebakkimia: require("../data/tebakkimia.json"),
  tebaklagu: require("../data/tebaklagu.json"),
  tebaklirik: require("../data/tebaklirik.json"),
  tebakmakanan: require("../data/tebakmakanan.json"),
  tebaknegara: require("../data/tebaknegara.json"),
  tebakprofesi: require("../data/tebakprofesi.json"),
  tebaktebakan: require("../data/tebaktebakan.json"),
  tekateki: require("../data/tekateki.json"),
  dare: require("../data/dare.json"),
  truth: require("../data/truth.json"),
  renungan: require("../data/renungan.json"),
};

const pick = (a) => a[Math.floor(Math.random() * a.length)];
const clean = (o) => {
  const r = {};
  for (const [k, v] of Object.entries(o)) if (k !== "index" && v !== undefined && v !== null && v !== "") r[k] = v;
  return r;
};

module.exports = ({ add, fail }) => {
  const game = (name, desc, shape) => {
    const list = DATA[name];
    if (!Array.isArray(list) || !list.length) throw new Error(`Data game ${name} kosong`);
    add("game", name, desc, [], () => {
      const item = pick(list);
      return shape ? shape(item) : clean(item);
    });
  };

  game("asahotak", "Soal asah otak beserta jawabannya");
  game("caklontong", "Soal Cak Lontong beserta jawaban dan penjelasannya");
  game("family100", "Soal Family 100 beserta daftar jawabannya", (i) => ({ soal: i.soal, jawaban: i.jawaban }));
  game("kataacak", "Soal susun huruf acak jadi kata");
  game("riddle", "Teka-teki singkat");
  game("siapakahaku", "Tebak siapakah aku");
  game("susunkata", "Susun huruf menjadi kata");
  game("tebakbendera", "Tebak bendera negara (ada gambar)", (i) => ({ gambar: i.img, jawaban: i.name }));
  game("tebakdrakor", "Tebak judul drama Korea dari gambar", (i) => ({ gambar: i.img, jawaban: i.jawaban, deskripsi: i.deskripsi }));
  game("tebakepep", "Tebak gambar karakter Free Fire", (i) => ({ gambar: i.img || i.fullimg, jawaban: i.jawaban }));
  game("tebakfilm", "Tebak judul film dari petunjuk");
  game("tebakgambar", "Tebak gambar beserta jawabannya", (i) => ({ gambar: i.img, jawaban: i.jawaban, deskripsi: i.deskripsi || undefined }));
  game("tebakhewan", "Tebak nama hewan dari petunjuk");
  game("tebakjkt48", "Tebak member JKT48 dari gambar", (i) => ({ gambar: i.img, jawaban: i.jawaban }));
  game("tebakkalimat", "Lengkapi kalimat yang rumpang");
  game("tebakkata", "Tebak kata dari beberapa petunjuk");
  game("tebakkimia", "Tebak lambang unsur kimia", (i) => ({ soal: `Apa lambang unsur ${i.unsur}?`, unsur: i.unsur, jawaban: i.lambang }));
  game("tebaklagu", "Tebak judul lagu dari potongan lirik");
  game("tebaklirik", "Tebak judul lagu dari lirik");
  game("tebakmakanan", "Tebak makanan khas daerah dari gambar", (i) => ({ gambar: i.img, jawaban: i.jawaban, deskripsi: i.deskripsi }));
  game("tebaknegara", "Tebak negara dari petunjuk");
  game("tebakprofesi", "Tebak nama profesi dari petunjuk");
  game("tebaktebakan", "Tebak-tebakan lucu");
  game("tekateki", "Teka-teki silang kata (TTS) singkat");

  const text = (name, key, desc) => {
    const list = DATA[name];
    add("game", name, desc, [], () => ({ [key]: pick(list) }));
  };
  text("truth", "pertanyaan", "Pertanyaan truth untuk permainan Truth or Dare");
  text("dare", "tantangan", "Tantangan dare untuk permainan Truth or Dare");
  add("game", "renungan", "Gambar renungan acak", [], () => ({ gambar: pick(DATA.renungan) }));

  // Cek jawaban: bot bisa mengirim tebakan lalu membandingkannya dengan jawaban asli.
  add("game", "cekjawaban", "Bandingkan tebakan dengan jawaban (toleran huruf besar dan spasi)", ["tebakan", "jawaban"], (q) => {
    const n = (s) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
    const a = n(q.tebakan), b = n(q.jawaban);
    if (!b) throw fail("jawaban tidak valid");
    const dist = (x, y) => {
      const m = Array.from({ length: x.length + 1 }, (_, i) => [i, ...Array(y.length).fill(0)]);
      for (let j = 1; j <= y.length; j++) m[0][j] = j;
      for (let i = 1; i <= x.length; i++) for (let j = 1; j <= y.length; j++) m[i][j] = Math.min(m[i - 1][j] + 1, m[i][j - 1] + 1, m[i - 1][j - 1] + (x[i - 1] === y[j - 1] ? 0 : 1));
      return m[x.length][y.length];
    };
    const benar = a === b;
    const hampir = !benar && b.length > 3 && dist(a, b) <= 1;
    return { benar, hampir, tebakan: q.tebakan, jawaban: q.jawaban };
  });
};
