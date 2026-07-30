const { Pool } = require('pg');

let pool;

function getPool() {
  if (!pool) {
    const connectionString = process.env.POSTGRES_URL || process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error(
        'Database connection string not set. Add POSTGRES_URL or DATABASE_URL as an environment variable.'
      );
    }
    pool = new Pool({
      connectionString,
      ssl: { rejectUnauthorized: false },
    });
  }
  return pool;
}

async function query(text, params) {
  return getPool().query(text, params);
}

module.exports = { query, getPool };
