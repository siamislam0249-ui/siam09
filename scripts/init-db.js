require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

async function main() {
  const connectionString = process.env.POSTGRES_URL || process.env.DATABASE_URL;
  if (!connectionString) {
    console.error('Set POSTGRES_URL or DATABASE_URL in your .env file first.');
    process.exit(1);
  }

  const pool = new Pool({ connectionString, ssl: { rejectUnauthorized: false } });
  const schema = fs.readFileSync(path.join(__dirname, '..', 'schema.sql'), 'utf8');

  await pool.query(schema);
  console.log('Database schema created successfully.');

  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
