CREATE DATABASE IF NOT EXISTS catatugas_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER IF NOT EXISTS 'catatugas_user'@'localhost' IDENTIFIED BY 'Catatugas_aman_24';
GRANT ALL PRIVILEGES ON catatugas_db.* TO 'catatugas_user'@'localhost';
FLUSH PRIVILEGES;

USE catatugas_db;

CREATE TABLE IF NOT EXISTS tasks (
  id VARCHAR(48) PRIMARY KEY,
  judul VARCHAR(120) NOT NULL,
  catatan VARCHAR(500) NOT NULL DEFAULT '',
  tanggal DATE NOT NULL,
  jam VARCHAR(5) NOT NULL DEFAULT '',
  prioritas ENUM('tinggi','sedang','rendah') NOT NULL DEFAULT 'sedang',
  kategori ENUM('kerja','kuliah','pribadi','keluarga','lainnya') NOT NULL DEFAULT 'kerja',
  selesai TINYINT(1) NOT NULL DEFAULT 0,
  dibuat BIGINT NOT NULL,
  INDEX idx_tanggal (tanggal),
  INDEX idx_selesai (selesai)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
