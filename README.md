# Catatugas

Pencatatan tugas harian dengan hari dan tanggal otomatis. Frontend statis plus API Express dan MySQL opsional (tetap jalan luring via localStorage).

## Jalankan lokal

```bash
npm install
node server.js
```

Buka `http://localhost:3000/`.

## Konfigurasi database

Salin variabel berikut ke `.env` (jangan commit `.env`):

```
PORT=3000
DB_HOST=localhost
DB_PORT=3306
DB_USER=catatugas_user
DB_PASSWORD=isi-sendiri
DB_NAME=catatugas_db
```

Inisialisasi skema:

```bash
mysql -h localhost -u root -p < schema.sql
```

API: `GET /api/health`, `GET /api/tasks`, `POST /api/tasks`, `PUT /api/tasks/:id`, `DELETE /api/tasks/:id`.
