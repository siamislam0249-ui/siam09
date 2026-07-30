const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cookie = require('cookie');

const COOKIE_NAME = 'lunchpoll_session';

function requireSecret() {
  if (!process.env.JWT_SECRET) {
    throw new Error('JWT_SECRET environment variable is not set.');
  }
  return process.env.JWT_SECRET;
}

async function hashPassword(password) {
  return bcrypt.hash(password, 12);
}

async function verifyPassword(password, hash) {
  return bcrypt.compare(password, hash);
}

function signSession(payload) {
  const secret = requireSecret();
  return jwt.sign(payload, secret, { expiresIn: '7d' });
}

function verifySession(token) {
  const secret = requireSecret();
  try {
    return jwt.verify(token, secret);
  } catch (e) {
    return null;
  }
}

function setSessionCookie(res, token) {
  res.setHeader(
    'Set-Cookie',
    cookie.serialize(COOKIE_NAME, token, {
      httpOnly: true,
      secure: true,
      sameSite: 'strict',
      path: '/',
      maxAge: 60 * 60 * 24 * 7,
    })
  );
}

function clearSessionCookie(res) {
  res.setHeader(
    'Set-Cookie',
    cookie.serialize(COOKIE_NAME, '', {
      httpOnly: true,
      secure: true,
      sameSite: 'strict',
      path: '/',
      maxAge: 0,
    })
  );
}

function getSessionFromRequest(req) {
  const cookies = cookie.parse(req.headers.cookie || '');
  const token = cookies[COOKIE_NAME];
  if (!token) return null;
  return verifySession(token);
}

module.exports = {
  hashPassword,
  verifyPassword,
  signSession,
  verifySession,
  setSessionCookie,
  clearSessionCookie,
  getSessionFromRequest,
};
