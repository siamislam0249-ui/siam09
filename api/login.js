const { getDb } = require('../lib/mongodb');
const { verifyPassword, signSession, setSessionCookie } = require('../lib/auth');

const MAX_ATTEMPTS = 5;
const LOCK_MINUTES = 15;
const GENERIC_ERROR = 'Incorrect username or password.';

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { username, password } = req.body || {};
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required.' });
    }

    const db = await getDb();
    const users = db.collection('users');
    const user = await users.findOne({ username });

    // Same generic message whether the username exists or not, to avoid leaking
    // which usernames are registered.
    if (!user) {
      return res.status(401).json({ error: GENERIC_ERROR });
    }

    if (user.lockedUntil && new Date(user.lockedUntil) > new Date()) {
      const minsLeft = Math.ceil((new Date(user.lockedUntil) - new Date()) / 60000);
      return res
        .status(429)
        .json({ error: `Too many failed attempts. Try again in ${minsLeft} minute(s).` });
    }

    const valid = await verifyPassword(password, user.passwordHash);

    if (!valid) {
      const attempts = (user.failedAttempts || 0) + 1;
      const lockedUntil =
        attempts >= MAX_ATTEMPTS ? new Date(Date.now() + LOCK_MINUTES * 60000) : null;

      await users.updateOne(
        { _id: user._id },
        { $set: { failedAttempts: attempts >= MAX_ATTEMPTS ? 0 : attempts, lockedUntil } }
      );

      if (lockedUntil) {
        return res
          .status(429)
          .json({ error: `Too many failed attempts. Try again in ${LOCK_MINUTES} minute(s).` });
      }
      return res.status(401).json({ error: GENERIC_ERROR });
    }

    await users.updateOne({ _id: user._id }, { $set: { failedAttempts: 0, lockedUntil: null } });

    const token = signSession({
      userId: user._id.toString(),
      username: user.username,
      isAdmin: !!user.isAdmin,
    });
    setSessionCookie(res, token);

    return res.status(200).json({ username: user.username, isAdmin: !!user.isAdmin });
  } catch (err) {
    console.error('login error:', err);
    return res.status(500).json({ error: 'Something went wrong. Please try again.' });
  }
};
