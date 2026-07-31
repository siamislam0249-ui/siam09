require('dotenv').config();
const { MongoClient } = require('mongodb');

async function main() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error('Set MONGODB_URI in your .env file first.');
    process.exit(1);
  }
  const dbName = process.env.MONGODB_DB || 'lunchpoll';

  const client = new MongoClient(uri);
  await client.connect();
  const db = client.db(dbName);

  await db.collection('users').createIndex({ username: 1 }, { unique: true });
  await db.collection('menuItems').createIndex({ menuDate: 1 });
  await db.collection('votes').createIndex({ userId: 1, voteDate: 1 }, { unique: true });
  await db.collection('votes').createIndex({ voteDate: 1 });

  console.log('MongoDB indexes created successfully.');
  await client.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
