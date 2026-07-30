const { query } = require('../lib/db');
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

    const result = await query(
      'SELECT id, username, password_hash, is_admin, failed_attempts, locked_until FROM users WHERE username = $1',
      [username]
    );
    const user = result.rows[0];

    // Same generic message whether the username exists or not, to avoid leaking
    // which usernames are registered.
    if (!user) {
      return res.status(401).json({ error: GENERIC_ERROR });
    }

    if (user.locked_until && new Date(user.locked_until) > new Date()) {
      const minsLeft = Math.ceil((new Date(user.locked_until) - new Date()) / 60000);
      return res
        .status(429)
        .json({ error: `Too many failed attempts. Try again in ${minsLeft} minute(s).` });
    }

    const valid = await verifyPassword(password, user.password_hash);

    if (!valid) {
      const attempts = (user.failed_attempts || 0) + 1;
      const lockedUntil =
        attempts >= MAX_ATTEMPTS ? new Date(Date.now() + LOCK_MINUTES * 60000) : null;

      await query('UPDATE users SET failed_attempts = $1, locked_until = $2 WHERE id = $3', [
        attempts >= MAX_ATTEMPTS ? 0 : attempts,
        lockedUntil,
        user.id,
      ]);

      if (lockedUntil) {
        return res
          .status(429)
          .json({ error: `Too many failed attempts. Try again in ${LOCK_MINUTES} minute(s).` });
      }
      return res.status(401).json({ error: GENERIC_ERROR });
    }

    await query('UPDATE users SET failed_attempts = 0, locked_until = NULL WHERE id = $1', [
      user.id,
    ]);

    const token = signSession({ userId: user.id, username: user.username, isAdmin: user.is_admin });
    setSessionCookie(res, token);

    return res.status(200).json({ username: user.username, isAdmin: user.is_admin });
  } catch (err) {
    console.error('login error:', err);
    return res.status(500).json({ error: 'Something went wrong. Please try again.' });
  }
};
