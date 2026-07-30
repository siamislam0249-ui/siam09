const { query } = require('../lib/db');
const { getSessionFromRequest } = require('../lib/auth');

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

module.exports = async (req, res) => {
  const session = getSessionFromRequest(req);
  if (!session) {
    return res.status(401).json({ error: 'Please sign in.' });
  }

  if (req.method === 'GET') {
    const date = req.query.date || todayStr();

    const itemsResult = await query(
      'SELECT id, emoji, name FROM menu_items WHERE menu_date = $1 ORDER BY sort_order ASC, id ASC',
      [date]
    );

    const tallyResult = await query(
      `SELECT menu_item_id, COUNT(*)::int AS count
       FROM votes v
       WHERE v.vote_date = $1
       GROUP BY menu_item_id`,
      [date]
    );
    const countsByItem = {};
    tallyResult.rows.forEach((r) => {
      countsByItem[r.menu_item_id] = r.count;
    });

    const myVoteResult = await query(
      'SELECT menu_item_id FROM votes WHERE user_id = $1 AND vote_date = $2',
      [session.userId, date]
    );
    const myVote = myVoteResult.rows[0] ? myVoteResult.rows[0].menu_item_id : null;

    const tally = itemsResult.rows.map((item) => ({
      id: item.id,
      emoji: item.emoji,
      name: item.name,
      count: countsByItem[item.id] || 0,
    }));
    const total = tally.reduce((sum, t) => sum + t.count, 0);

    const payload = { date, myVote, tally, total };

    if (session.isAdmin) {
      const voterListResult = await query(
        `SELECT u.username, v.menu_item_id
         FROM votes v JOIN users u ON v.user_id = u.id
         WHERE v.vote_date = $1
         ORDER BY u.username ASC`,
        [date]
      );
      payload.voterList = voterListResult.rows;
    }

    return res.status(200).json(payload);
  }

  if (req.method === 'POST') {
    const { date, itemId } = req.body || {};
    if (!date || !itemId) {
      return res.status(400).json({ error: 'Date and item are required.' });
    }

    const itemCheck = await query('SELECT id FROM menu_items WHERE id = $1 AND menu_date = $2', [
      itemId,
      date,
    ]);
    if (itemCheck.rows.length === 0) {
      return res.status(400).json({ error: 'Invalid menu item for this date.' });
    }

    const existing = await query('SELECT id FROM votes WHERE user_id = $1 AND vote_date = $2', [
      session.userId,
      date,
    ]);

    if (existing.rows.length > 0) {
      return res.status(409).json({ error: 'You have already voted today.' });
    }

    await query('INSERT INTO votes (user_id, menu_item_id, vote_date) VALUES ($1, $2, $3)', [
      session.userId,
      itemId,
      date,
    ]);

    return res.status(200).json({ ok: true });
  }

  return res.status(405).json({ error: 'Method not allowed' });
};
