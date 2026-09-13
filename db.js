require("dotenv").config();
const mysql = require("mysql2/promise");

const pool = mysql.createPool({
  host: process.env.DB_HOST || "localhost",
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || "catatugas_user",
  password: process.env.DB_PASSWORD || "",
  database: process.env.DB_NAME || "catatugas_db",
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

async function query(sql, params){
  const clean = Array.isArray(params) ? params : [];
  const rows = await pool.execute(sql, clean);
  return rows[0];
}

module.exports = { pool, query };
