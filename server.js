require("dotenv").config();
const path = require("path");
const express = require("express");
const cors = require("cors");
const db = require("./db");

const app = express();
app.set("trust proxy", 1);
const PORT = Number(process.env.PORT || 3000);

const allowedOrigins = [
  "http://localhost:3000",
  "http://127.0.0.1:3000",
  "http://localhost:5173"
];
app.use(cors({
  origin: (origin, cb) => {
    if (!origin) return cb(null, true);
    if (allowedOrigins.includes(origin)) return cb(null, true);
    if (/\.vercel\.app$/.test(new URL(origin).hostname || "")) return cb(null, true);
    return cb(null, false);
  },
  maxAge: 86400
}));
app.use(express.json({ limit: "32kb" }));
app.use((req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  next();
});
app.use(express.static(__dirname, { extensions: ["html"] }));

const hit = new Map();
function rateLimit(req, res, next){
  const key = req.ip || "local";
  const now = Date.now();
  const arr = (hit.get(key) || []).filter((t) => now - t < 60000);
  arr.push(now);
  hit.set(key, arr);
  if(arr.length > 120) return res.status(429).json({ error: "Terlalu banyak permintaan. Coba lagi sebentar." });
  next();
}
app.use("/api/", rateLimit);

function cleanStr(v, max){
  let s = String(v == null ? "" : v).replace(/[\u0000-\u001F\u007F]/g, "").trim();
  if(s.length > max) s = s.slice(0, max);
  return s;
}
function validDate(v){ return /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/.test(v || ""); }
function validTime(v){
  if(!v) return true;
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(v);
}
function validTask(body, partial){
  const out = {};
  if(!partial || body.judul !== undefined){
    const judul = cleanStr(body.judul, 120);
    if(!judul) return { error: "Judul wajib diisi." };
    out.judul = judul;
  }
  if(!partial || body.tanggal !== undefined){
    if(!validDate(body.tanggal)) return { error: "Tanggal tidak valid. Gunakan format YYYY-MM-DD." };
    out.tanggal = body.tanggal;
  }
  if(body.jam !== undefined){
    const jam = cleanStr(body.jam, 5);
    if(!validTime(jam)) return { error: "Jam tidak valid. Gunakan format HH:MM." };
    out.jam = jam;
  }
  if(body.catatan !== undefined) out.catatan = cleanStr(body.catatan, 500);
  if(body.prioritas !== undefined){
    if(!["tinggi","sedang","rendah"].includes(body.prioritas)) return { error: "Prioritas tidak dikenal." };
    out.prioritas = body.prioritas;
  }
  if(body.kategori !== undefined){
    if(!["kerja","kuliah","pribadi","keluarga","lainnya"].includes(body.kategori)) return { error: "Kategori tidak dikenal." };
    out.kategori = body.kategori;
  }
  if(body.selesai !== undefined){
    if(typeof body.selesai !== "boolean") return { error: "Status selesai harus boolean." };
    out.selesai = body.selesai ? 1 : 0;
  }
  return { value: out };
}
function rowToTask(r){
  return {
    id: String(r.id),
    judul: r.judul,
    catatan: r.catatan || "",
    tanggal: r.tanggal,
    jam: r.jam || "",
    prioritas: r.prioritas,
    kategori: r.kategori,
    selesai: Number(r.selesai) === 1,
    dibuat: Number(r.dibuat || Date.now())
  };
}

app.get("/api/health", async (req, res) => {
  try{
    await db.query("SELECT 1 AS ok", []);
    res.json({ ok: true });
  }catch(e){ res.status(500).json({ ok: false }); }
});

app.get("/api/tasks", async (req, res) => {
  try{
    const rows = await db.query("SELECT id, judul, catatan, DATE_FORMAT(tanggal, '%Y-%m-%d') AS tanggal, jam, prioritas, kategori, selesai, dibuat FROM tasks ORDER BY tanggal ASC, jam ASC LIMIT 500", []);
    res.json(rows.map(rowToTask));
  }catch(e){ res.status(500).json({ error: "Gagal membaca database." }); }
});

app.post("/api/tasks", async (req, res) => {
  const check = validTask(req.body, false);
  if(check.error) return res.status(400).json({ error: check.error });
  const id = cleanStr(req.body.id, 48) || ("t" + Date.now().toString(36));
  const v = check.value;
  try{
    await db.query(
      "INSERT INTO tasks (id, judul, catatan, tanggal, jam, prioritas, kategori, selesai, dibuat) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE judul=VALUES(judul), catatan=VALUES(catatan), tanggal=VALUES(tanggal), jam=VALUES(jam), prioritas=VALUES(prioritas), kategori=VALUES(kategori), selesai=VALUES(selesai)",
      [id, v.judul, v.catatan || "", v.tanggal, v.jam || "", v.prioritas || "sedang", v.kategori || "kerja", v.selesai ? 1 : 0, Date.now()]
    );
    res.status(201).json({ ok: true, id });
  }catch(e){ res.status(500).json({ error: "Gagal menyimpan tugas." }); }
});

app.put("/api/tasks/:id", async (req, res) => {
  const id = cleanStr(req.params.id, 48);
  if(!id) return res.status(400).json({ error: "ID tidak valid." });
  const check = validTask(req.body, true);
  if(check.error) return res.status(400).json({ error: check.error });
  const v = check.value;
  const fields = [];
  const params = [];
  for(const k of ["judul","catatan","tanggal","jam","prioritas","kategori","selesai"]){
    if(v[k] !== undefined){ fields.push(k + " = ?"); params.push(v[k]); }
  }
  if(!fields.length) return res.status(400).json({ error: "Tidak ada perubahan." });
  params.push(id);
  try{
    await db.query("UPDATE tasks SET " + fields.join(", ") + " WHERE id = ?", params);
    res.json({ ok: true });
  }catch(e){ res.status(500).json({ error: "Gagal memperbarui tugas." }); }
});

app.delete("/api/tasks/:id", async (req, res) => {
  const id = cleanStr(req.params.id, 48);
  if(!id) return res.status(400).json({ error: "ID tidak valid." });
  try{
    await db.query("DELETE FROM tasks WHERE id = ?", [id]);
    res.json({ ok: true });
  }catch(e){ res.status(500).json({ error: "Gagal menghapus tugas." }); }
});

app.get("/", (req, res) => res.sendFile(path.join(__dirname, "index.html")));

module.exports = app;

if (require.main === module && !process.env.VERCEL) {
  app.listen(PORT, () => console.log("Catatugas API aktif pada port " + PORT));
}
