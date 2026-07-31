const { MongoClient } = require('mongodb');

let cachedClient = null;
let cachedDb = null;

async function getDb() {
  if (cachedDb) return cachedDb;

  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error('MONGODB_URI environment variable is not set.');
  }

  if (!cachedClient) {
    // Small pool size: serverless functions spin up many parallel instances,
    // and MongoDB Atlas free tier (M0) caps total connections at 500.
    cachedClient = new MongoClient(uri, { maxPoolSize: 5 });
    await cachedClient.connect();
  }

  const dbName = process.env.MONGODB_DB || 'lunchpoll';
  cachedDb = cachedClient.db(dbName);
  return cachedDb;
}

module.exports = { getDb };
