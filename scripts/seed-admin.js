require('dotenv').config();
const bcrypt = require('bcryptjs');
const { Pool } = require('pg');

async function main() {
  const username = process.env.ADMIN_USERNAME;
  const password = process.env.ADMIN_PASSWORD;
  const connectionString = process.env.POSTGRES_URL || process.env.DATABASE_URL;

  if (!username || !password) {
    console.error('Set ADMIN_USERNAME and ADMIN_PASSWORD in your .env file first.');
    process.exit(1);
  }
  if (password.length < 8) {
    console.error('ADMIN_PASSWORD must be at least 8 characters.');
    process.exit(1);
  }
  if (!connectionString) {
    console.error('Set POSTGRES_URL or DATABASE_URL in your .env file first.');
    process.exit(1);
  }

  const pool = new Pool({ connectionString, ssl: { rejectUnauthorized: false } });
  const passwordHash = await bcrypt.hash(password, 12);

  const existing = await pool.query('SELECT id FROM users WHERE username = $1', [username]);

  if (existing.rows.length > 0) {
    await pool.query('UPDATE users SET password_hash = $1, is_admin = true WHERE username = $2', [
      passwordHash,
      username,
    ]);
    console.log(`Updated existing user "${username}" to admin with the new password.`);
  } else {
    await pool.query('INSERT INTO users (username, password_hash, is_admin) VALUES ($1, $2, true)', [
      username,
      passwordHash,
    ]);
    console.log(`Created admin user "${username}".`);
  }

  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
