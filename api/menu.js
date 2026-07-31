const { getDb } = require('../lib/mongodb');
const { getSessionFromRequest } = require('../lib/auth');

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

module.exports = async (req, res) => {
  const db = await getDb();
  const menuItems = db.collection('menuItems');

  if (req.method === 'GET') {
    const date = req.query.date || todayStr();
    const items = await menuItems
      .find({ menuDate: date })
      .sort({ sortOrder: 1, _id: 1 })
      .toArray();

    return res.status(200).json({
      date,
      items: items.map((i) => ({ id: i._id.toString(), emoji: i.emoji, name: i.name })),
    });
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

    await menuItems.deleteMany({ menuDate: date });
    await menuItems.insertMany(
      cleanItems.map((item, idx) => ({
        menuDate: date,
        emoji: item.emoji,
        name: item.name,
        sortOrder: idx,
      }))
    );

    return res.status(200).json({ ok: true });
  }

  return res.status(405).json({ error: 'Method not allowed' });
};
