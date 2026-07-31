const { getDb } = require('../lib/mongodb');
const { hashPassword, signSession, setSessionCookie } = require('../lib/auth');

const USERNAME_RE = /^[a-zA-Z0-9_]{3,30}$/;

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { username, password } = req.body || {};

    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required.' });
    }
    if (!USERNAME_RE.test(username)) {
      return res.status(400).json({
        error: 'Username must be 3-30 characters: letters, numbers, or underscore only.',
      });
    }
    if (typeof password !== 'string' || password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters.' });
    }

    const db = await getDb();
    const users = db.collection('users');

    const existing = await users.findOne({ username });
    if (existing) {
      return res.status(409).json({ error: 'That username is already taken.' });
    }

    const passwordHash = await hashPassword(password);
    const result = await users.insertOne({
      username,
      passwordHash,
      isAdmin: false,
      failedAttempts: 0,
      lockedUntil: null,
      createdAt: new Date(),
    });

    const token = signSession({
      userId: result.insertedId.toString(),
      username,
      isAdmin: false,
    });
    setSessionCookie(res, token);

    return res.status(201).json({ username, isAdmin: false });
  } catch (err) {
    console.error('register error:', err);
    return res.status(500).json({ error: 'Something went wrong. Please try again.' });
  }
};
