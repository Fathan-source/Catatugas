const HARI = ["Minggu","Senin","Selasa","Rabu","Kamis","Jumat","Sabtu"];
const HARI_SINGKAT = ["Min","Sen","Sel","Rab","Kam","Jum","Sab"];
const BULAN = ["Januari","Februari","Maret","April","Mei","Juni","Juli","Agustus","September","Oktober","November","Desember"];
const API_BASE = "http://localhost:3000/api/tasks";
const LS_KEY = "catatugas.v1";

const el = (id) => document.getElementById(id);
const todayDay = el("todayDay");
const todayDate = el("todayDate");
const todayClock = el("todayClock");
const weekStrip = el("weekStrip");
const daftar = el("daftar");
const emptyState = el("emptyState");
const q = el("q");
const fPrioritas = el("fPrioritas");
const sortir = el("sortir");
const form = el("formTugas");
const inJudul = el("inJudul");
const inCatatan = el("inCatatan");
const inTanggal = el("inTanggal");
const inJam = el("inJam");
const inPrioritas = el("inPrioritas");
const inKategori = el("inKategori");
const hariOtomatis = el("hariOtomatis");
const formErr = el("formErr");
const btnSimpan = el("btnSimpan");
const btnBatal = el("btnBatal");
const toast = el("toast");
const dlgHapus = el("dlgHapus");
const dlgText = el("dlgText");
const stTotal = el("stTotal");
const stAktif = el("stAktif");
const stSelesai = el("stSelesai");
const stTerlewat = el("stTerlewat");
const footCount = el("footCount");

let tasks = [];
let activeFilter = "semua";
let selectedDate = "";
let editingId = "";
let pendingDeleteId = "";
let serverOk = false;

function pad(n){ return String(n).padStart(2,"0"); }
function toISODate(d){ return d.getFullYear() + "-" + pad(d.getMonth()+1) + "-" + pad(d.getDate()); }
function parseISODate(s){
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s || "");
  if(!m) return null;
  const d = new Date(Number(m[1]), Number(m[2])-1, Number(m[3]));
  if(d.getFullYear() !== Number(m[1]) || (d.getMonth()+1) !== Number(m[2]) || d.getDate() !== Number(m[3])) return null;
  return d;
}
function formatTanggalPanjang(iso){
  const d = parseISODate(iso);
  if(!d) return iso || "Tanggal tidak valid";
  return HARI[d.getDay()] + ", " + d.getDate() + " " + BULAN[d.getMonth()] + " " + d.getFullYear();
}
function namaHari(iso){
  const d = parseISODate(iso);
  if(!d) return "Tanggal belum valid";
  return HARI[d.getDay()];
}
function todayISO(){ return toISODate(new Date()); }
function escapeText(s){ return String(s == null ? "" : s); }
function uid(){ return "t" + Date.now().toString(36) + Math.random().toString(36).slice(2,8); }

function showToast(msg){
  toast.textContent = msg;
  toast.classList.remove("hidden");
  clearTimeout(showToast.t);
  showToast.t = setTimeout(() => toast.classList.add("hidden"), 2600);
}
function showErr(msg){
  formErr.textContent = msg;
  formErr.classList.remove("hidden");
}
function clearErr(){ formErr.classList.add("hidden"); formErr.textContent = ""; }

function loadLocal(){
  try{
    const raw = localStorage.getItem(LS_KEY);
    if(!raw) return [];
    const arr = JSON.parse(raw);
    if(!Array.isArray(arr)) return [];
    return arr.filter(validTaskShape);
  }catch{ return []; }
}
function saveLocal(){ try{ localStorage.setItem(LS_KEY, JSON.stringify(tasks)); }catch{} }
function validTaskShape(t){
  if(!t || typeof t !== "object") return false;
  if(typeof t.judul !== "string" || !t.judul.trim()) return false;
  if(!parseISODate(t.tanggal)) return false;
  return true;
}
function sanitizeInput(v, max){
  let s = String(v == null ? "" : v).replace(/[\u0000-\u001F\u007F]/g, "").trim();
  if(s.length > max) s = s.slice(0, max);
  return s;
}
function validJam(v){
  if(!v) return true;
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(v);
}

function renderClock(){
  const now = new Date();
  if(todayDay) todayDay.textContent = HARI[now.getDay()];
  if(todayDate) todayDate.textContent = now.getDate() + " " + BULAN[now.getMonth()] + " " + now.getFullYear();
  if(todayClock) todayClock.textContent = pad(now.getHours()) + ":" + pad(now.getMinutes()) + ":" + pad(now.getSeconds());
}
function updateHariOtomatis(){
  const v = inTanggal.value;
  const d = parseISODate(v);
  if(!d){ hariOtomatis.textContent = "Pilih tanggal dulu"; return; }
  hariOtomatis.textContent = HARI[d.getDay()] + ", " + d.getDate() + " " + BULAN[d.getMonth()] + " " + d.getFullYear();
}

function buildWeek(){
  weekStrip.textContent = "";
  const base = new Date();
  base.setHours(0,0,0,0);
  for(let i=0;i<7;i++){
    const d = new Date(base);
    d.setDate(base.getDate()+i);
    const iso = toISODate(d);
    const b = document.createElement("button");
    b.type = "button";
    b.className = "day" + (i===0 ? " is_today" : "") + (selectedDate===iso ? " is_sel" : "");
    b.setAttribute("aria-label", formatTanggalPanjang(iso));
    const dEl = document.createElement("span");
    dEl.className = "day_d";
    dEl.textContent = i===0 ? "Hari ini" : HARI_SINGKAT[d.getDay()];
    const nEl = document.createElement("span");
    nEl.className = "day_n";
    nEl.textContent = String(d.getDate());
    b.append(dEl, nEl);
    b.addEventListener("click", () => {
      selectedDate = (selectedDate === iso) ? "" : iso;
      buildWeek();
      renderList();
    });
    weekStrip.append(b);
  }
}

function filteredTasks(){
  const term = q.value.trim().toLowerCase();
  const pr = fPrioritas.value;
  const today = todayISO();
  let out = tasks.slice();
  if(selectedDate) out = out.filter((t) => t.tanggal === selectedDate);
  if(activeFilter === "hari_ini") out = out.filter((t) => t.tanggal === today && !t.selesai);
  if(activeFilter === "mendatang") out = out.filter((t) => t.tanggal > today && !t.selesai);
  if(activeFilter === "terlewat") out = out.filter((t) => t.tanggal < today && !t.selesai);
  if(activeFilter === "selesai") out = out.filter((t) => t.selesai);
  if(pr !== "semua") out = out.filter((t) => t.prioritas === pr);
  if(term) out = out.filter((t) => (t.judul + " " + (t.catatan || "")).toLowerCase().includes(term));
  const bobot = { tinggi:3, sedang:2, rendah:1 };
  if(sortir.value === "prioritas") out.sort((a,b) => ((bobot[b.prioritas]||0)-(bobot[a.prioritas]||0)) || (a.tanggal < b.tanggal ? -1 : 1));
  else if(sortir.value === "dibuat") out.sort((a,b) => (b.dibuat||0)-(a.dibuat||0));
  else out.sort((a,b) => (a.tanggal < b.tanggal ? -1 : a.tanggal > b.tanggal ? 1 : (a.jam||"") < (b.jam||"") ? -1 : 1));
  return out;
}

function renderStats(){
  const today = todayISO();
  const total = tasks.length;
  const selesai = tasks.filter((t) => t.selesai).length;
  const aktif = total - selesai;
  const terlewat = tasks.filter((t) => !t.selesai && t.tanggal < today).length;
  stTotal.textContent = String(total);
  stAktif.textContent = String(aktif);
  stSelesai.textContent = String(selesai);
  stTerlewat.textContent = String(terlewat);
  footCount.textContent = total + " tugas tersimpan";
}

function pillPrioritas(p){
  if(p === "tinggi") return { text:"Prioritas tinggi", cls:"pill solid" };
  if(p === "rendah") return { text:"Prioritas rendah", cls:"pill" };
  return { text:"Prioritas sedang", cls:"pill" };
}

function renderList(){
  renderStats();
  const list = filteredTasks();
  daftar.textContent = "";
  emptyState.classList.toggle("hidden", list.length > 0);
  const byDate = new Map();
  for(const t of list){
    if(!byDate.has(t.tanggal)) byDate.set(t.tanggal, []);
    byDate.get(t.tanggal).push(t);
  }
  const dates = Array.from(byDate.keys()).sort();
  const today = todayISO();
  for(const iso of dates){
    const group = document.createElement("section");
    group.className = "group";
    group.setAttribute("aria-label", formatTanggalPanjang(iso));
    const head = document.createElement("div");
    head.className = "group_h";
    const title = document.createElement("div");
    title.className = "group_t";
    title.textContent = formatTanggalPanjang(iso);
    const sub = document.createElement("div");
    sub.className = "group_s";
    const n = byDate.get(iso).length;
    let flag = "";
    if(iso === today) flag = "Hari ini";
    else if(iso < today) flag = "Terlewat";
    else flag = "Mendatang";
    sub.textContent = n + " tugas (" + flag + ")";
    head.append(title, sub);
    group.append(head);
    for(const t of byDate.get(iso)){
      group.append(taskRow(t, iso < today && !t.selesai));
    }
    daftar.append(group);
  }
}

function taskRow(t, isOverdue){
  const row = document.createElement("article");
  row.className = "task" + (t.selesai ? " is_done" : "");
  const check = document.createElement("button");
  check.type = "button";
  check.className = "check";
  check.setAttribute("aria-label", t.selesai ? "Tandai belum selesai: " + t.judul : "Tandai selesai: " + t.judul);
  check.textContent = "";
  check.setAttribute("aria-pressed", t.selesai ? "true" : "false");
  check.addEventListener("click", () => toggleDone(t.id));
  const body = document.createElement("div");
  const title = document.createElement("div");
  title.className = "t_title";
  title.textContent = escapeText(t.judul);
  body.append(title);
  if(t.catatan){
    const note = document.createElement("div");
    note.className = "t_note";
    note.textContent = escapeText(t.catatan);
    body.append(note);
  }
  const meta = document.createElement("div");
  meta.className = "t_meta";
  if(t.jam){
    const jam = document.createElement("span");
    jam.className = "pill mono";
    jam.textContent = t.jam;
    meta.append(jam);
  }
  const kat = document.createElement("span");
  kat.className = "pill";
  kat.textContent = labelKategori(t.kategori);
  meta.append(kat);
  const pr = pillPrioritas(t.prioritas);
  const prEl = document.createElement("span");
  prEl.className = pr.cls;
  prEl.textContent = pr.text;
  meta.append(prEl);
  if(t.selesai){
    const s = document.createElement("span");
    s.className = "pill accent";
    s.textContent = "Selesai";
    meta.append(s);
  }else if(isOverdue){
    const s = document.createElement("span");
    s.className = "pill warn";
    s.textContent = "Terlewat";
    meta.append(s);
  }
  body.append(meta);
  const act = document.createElement("div");
  act.className = "t_act";
  const bEdit = document.createElement("button");
  bEdit.type = "button";
  bEdit.className = "iconbtn";
  bEdit.textContent = "Ubah";
  bEdit.setAttribute("aria-label", "Ubah tugas " + t.judul);
  bEdit.addEventListener("click", () => startEdit(t.id));
  const bDel = document.createElement("button");
  bDel.type = "button";
  bDel.className = "iconbtn danger";
  bDel.textContent = "Hapus";
  bDel.setAttribute("aria-label", "Hapus tugas " + t.judul);
  bDel.addEventListener("click", () => askDelete(t.id));
  act.append(bEdit, bDel);
  row.append(check, body, act);
  return row;
}
function labelKategori(k){
  if(k === "kuliah") return "Kuliah";
  if(k === "pribadi") return "Pribadi";
  if(k === "keluarga") return "Keluarga";
  if(k === "lainnya") return "Lainnya";
  return "Kerja";
}

function resetForm(){
  form.reset();
  editingId = "";
  btnSimpan.textContent = "Simpan tugas";
  btnBatal.classList.add("hidden");
  inTanggal.value = todayISO();
  inJam.value = "09:00";
  updateHariOtomatis();
  clearErr();
}
function startEdit(id){
  const t = tasks.find((x) => x.id === id);
  if(!t) return;
  editingId = id;
  inJudul.value = t.judul;
  inCatatan.value = t.catatan || "";
  inTanggal.value = t.tanggal;
  inJam.value = t.jam || "";
  inPrioritas.value = t.prioritas || "sedang";
  inKategori.value = t.kategori || "kerja";
  updateHariOtomatis();
  btnSimpan.textContent = "Simpan perubahan";
  btnBatal.classList.remove("hidden");
  clearErr();
  form.scrollIntoView({ behavior:"smooth", block:"start" });
  inJudul.focus();
}
function askDelete(id){
  const t = tasks.find((x) => x.id === id);
  if(!t) return;
  pendingDeleteId = id;
  dlgText.textContent = "Hapus tugas " + t.judul + " pada " + formatTanggalPanjang(t.tanggal) + ". Tindakan ini tidak bisa dibatalkan.";
  if(typeof dlgHapus.showModal === "function") dlgHapus.showModal();
  else doDelete(id);
}

async function doDelete(id){
  tasks = tasks.filter((t) => t.id !== id);
  saveLocal();
  buildWeek();
  renderList();
  if(serverOk){ try{ await fetch(API_BASE + "/" + encodeURIComponent(id), { method:"DELETE" }); }catch{} }
  showToast("Tugas dihapus");
}
async function toggleDone(id){
  const t = tasks.find((x) => x.id === id);
  if(!t) return;
  t.selesai = !t.selesai;
  saveLocal();
  buildWeek();
  renderList();
  if(serverOk){
    try{
      await fetch(API_BASE + "/" + encodeURIComponent(id), {
        method:"PUT",
        headers:{ "Content-Type":"application/json" },
        body: JSON.stringify({ selesai: t.selesai })
      });
    }catch{}
  }
  showToast(t.selesai ? "Tugas ditandai selesai" : "Tugas dibuka kembali");
}

async function syncFromServer(){
  try{
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 2500);
    const res = await fetch(API_BASE, { signal: ctrl.signal });
    clearTimeout(timer);
    if(!res.ok) throw new Error("bad");
    const data = await res.json();
    if(Array.isArray(data)){
      const valid = data.filter(validTaskShape);
      if(valid.length > 0 || tasks.length === 0){
        tasks = valid.length ? valid : tasks;
        saveLocal();
      }
    }
    serverOk = true;
  }catch{
    serverOk = false;
  }
}
async function pushToServer(task){
  if(!serverOk) return;
  try{
    await fetch(API_BASE, {
      method:"POST",
      headers:{ "Content-Type":"application/json" },
      body: JSON.stringify(task)
    });
  }catch{ serverOk = false; }
}
async function updateServer(task){
  if(!serverOk) return;
  try{
    await fetch(API_BASE + "/" + encodeURIComponent(task.id), {
      method:"PUT",
      headers:{ "Content-Type":"application/json" },
      body: JSON.stringify(task)
    });
  }catch{}
}

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  clearErr();
  const judul = sanitizeInput(inJudul.value, 120);
  const catatan = sanitizeInput(inCatatan.value, 500);
  const tanggal = (inTanggal.value || "").trim();
  const jam = (inJam.value || "").trim();
  const prioritas = ["tinggi","sedang","rendah"].includes(inPrioritas.value) ? inPrioritas.value : "sedang";
  const kategori = ["kerja","kuliah","pribadi","keluarga","lainnya"].includes(inKategori.value) ? inKategori.value : "kerja";
  if(!judul){ showErr("Judul wajib diisi. Tulis judul singkat maksimal 120 karakter."); inJudul.focus(); return; }
  if(!parseISODate(tanggal)){ showErr("Tanggal belum valid. Pilih tanggal lewat pemilih tanggal."); inTanggal.focus(); return; }
  if(!validJam(jam)){ showErr("Jam belum valid. Gunakan format 24 jam, contoh 09:00."); inJam.focus(); return; }
  if(editingId){
    const t = tasks.find((x) => x.id === editingId);
    if(!t){ resetForm(); return; }
    t.judul = judul;
    t.catatan = catatan;
    t.tanggal = tanggal;
    t.jam = jam;
    t.prioritas = prioritas;
    t.kategori = kategori;
    saveLocal();
    buildWeek();
    renderList();
    await updateServer(t);
    showToast("Perubahan disimpan untuk " + namaHari(tanggal));
    resetForm();
    return;
  }
  const item = { id: uid(), judul, catatan, tanggal, jam, prioritas, kategori, selesai:false, dibuat: Date.now() };
  tasks.push(item);
  saveLocal();
  buildWeek();
  renderList();
  await pushToServer(item);
  showToast("Tugas tersimpan untuk " + namaHari(tanggal));
  resetForm();
});
btnBatal.addEventListener("click", resetForm);
inTanggal.addEventListener("change", updateHariOtomatis);
inTanggal.addEventListener("input", updateHariOtomatis);
q.addEventListener("input", renderList);
fPrioritas.addEventListener("change", renderList);
sortir.addEventListener("change", renderList);
document.querySelectorAll(".chip").forEach((c) => {
  c.addEventListener("click", () => {
    document.querySelectorAll(".chip").forEach((x) => x.classList.remove("is_on"));
    c.classList.add("is_on");
    activeFilter = c.dataset.filter || "semua";
    renderList();
  });
});
if(dlgHapus){
  dlgHapus.addEventListener("close", () => {
    if(dlgHapus.returnValue === "hapus" && pendingDeleteId){
      const id = pendingDeleteId;
      pendingDeleteId = "";
      doDelete(id);
    }else pendingDeleteId = "";
  });
}

function init(){
  tasks = loadLocal();
  if(!tasks.length){
    const t = todayISO();
    const d = new Date();
    const d2 = new Date(d); d2.setDate(d.getDate()+1);
    const d3 = new Date(d); d3.setDate(d.getDate()+2);
    tasks = [
      { id: uid(), judul:"Siapkan laporan mingguan", catatan:"Rangkum capaian dan kendala pekan ini", tanggal:t, jam:"09:00", prioritas:"tinggi", kategori:"kerja", selesai:false, dibuat:Date.now()-3000 },
      { id: uid(), judul:"Belajar 30 menit untuk kuis", catatan:"Fokus pada catatan bab terakhir", tanggal:toISODate(d2), jam:"19:00", prioritas:"sedang", kategori:"kuliah", selesai:false, dibuat:Date.now()-2000 },
      { id: uid(), judul:"Telepon ibu", catatan:"Tanyakan kabar dan jadwal akhir pekan", tanggal:toISODate(d3), jam:"20:00", prioritas:"rendah", kategori:"keluarga", selesai:false, dibuat:Date.now()-1000 }
    ];
    saveLocal();
  }
  inTanggal.value = todayISO();
  renderClock();
  setInterval(renderClock, 1000);
  updateHariOtomatis();
  buildWeek();
  renderList();
  syncFromServer();
}
init();
