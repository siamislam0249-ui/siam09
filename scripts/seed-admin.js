require('dotenv').config();
const bcrypt = require('bcryptjs');
const { MongoClient } = require('mongodb');

async function main() {
  const username = process.env.ADMIN_USERNAME;
  const password = process.env.ADMIN_PASSWORD;
  const uri = process.env.MONGODB_URI;

  if (!username || !password) {
    console.error('Set ADMIN_USERNAME and ADMIN_PASSWORD in your .env file first.');
    process.exit(1);
  }
  if (password.length < 8) {
    console.error('ADMIN_PASSWORD must be at least 8 characters.');
    process.exit(1);
  }
  if (!uri) {
    console.error('Set MONGODB_URI in your .env file first.');
    process.exit(1);
  }

  const dbName = process.env.MONGODB_DB || 'lunchpoll';
  const client = new MongoClient(uri);
  await client.connect();
  const db = client.db(dbName);
  const users = db.collection('users');

  const passwordHash = await bcrypt.hash(password, 12);
  const existing = await users.findOne({ username });

  if (existing) {
    await users.updateOne({ _id: existing._id }, { $set: { passwordHash, isAdmin: true } });
    console.log(`Updated existing user "${username}" to admin with the new password.`);
  } else {
    await users.insertOne({
      username,
      passwordHash,
      isAdmin: true,
      failedAttempts: 0,
      lockedUntil: null,
      createdAt: new Date(),
    });
    console.log(`Created admin user "${username}".`);
  }

  await client.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
