const { query } = require('../lib/db');
const { getSessionFromRequest } = require('../lib/auth');

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

module.exports = async (req, res) => {
  if (req.method === 'GET') {
    const date = req.query.date || todayStr();
    const result = await query(
      'SELECT id, emoji, name FROM menu_items WHERE menu_date = $1 ORDER BY sort_order ASC, id ASC',
      [date]
    );
    return res.status(200).json({ date, items: result.rows });
  }

  if (req.method === 'POST') {
    const session = getSessionFromRequest(req);
    if (!session || !session.isAdmin) {
      return res.status(403).json({ error: 'Admin access required.' });
    }

    const { date, items } = req.body || {};
    if (!date || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'Date and at least one menu item are required.' });
    }

    const cleanItems = items
      .map((i) => ({
        emoji: String(i.emoji || '🍽️').slice(0, 8),
        name: String(i.name || '').trim().slice(0, 100),
      }))
      .filter((i) => i.name !== '');

    if (cleanItems.length === 0) {
      return res.status(400).json({ error: 'At least one menu item with a name is required.' });
    }

    await query('DELETE FROM menu_items WHERE menu_date = $1', [date]);

    for (let idx = 0; idx < cleanItems.length; idx++) {
      await query(
        'INSERT INTO menu_items (menu_date, emoji, name, sort_order) VALUES ($1, $2, $3, $4)',
        [date, cleanItems[idx].emoji, cleanItems[idx].name, idx]
      );
    }

    return res.status(200).json({ ok: true });
  }

  return res.status(405).json({ error: 'Method not allowed' });
};
