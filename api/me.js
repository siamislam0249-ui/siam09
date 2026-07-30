const { getSessionFromRequest } = require('../lib/auth');

module.exports = async (req, res) => {
  const session = getSessionFromRequest(req);
  if (!session) {
    return res.status(200).json({ user: null });
  }
  return res.status(200).json({ user: { username: session.username, isAdmin: session.isAdmin } });
};
