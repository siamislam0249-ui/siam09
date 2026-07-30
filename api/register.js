const { query } = require('../lib/db');
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

    const existing = await query('SELECT id FROM users WHERE username = $1', [username]);
    if (existing.rows.length > 0) {
      return res.status(409).json({ error: 'That username is already taken.' });
    }

    const passwordHash = await hashPassword(password);
    const result = await query(
      'INSERT INTO users (username, password_hash, is_admin) VALUES ($1, $2, false) RETURNING id, username, is_admin',
      [username, passwordHash]
    );
    const user = result.rows[0];

    const token = signSession({ userId: user.id, username: user.username, isAdmin: user.is_admin });
    setSessionCookie(res, token);

    return res.status(201).json({ username: user.username, isAdmin: user.is_admin });
  } catch (err) {
    console.error('register error:', err);
    return res.status(500).json({ error: 'Something went wrong. Please try again.' });
  }
};
