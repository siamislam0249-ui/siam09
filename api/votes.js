const { ObjectId } = require('mongodb');
const { getDb } = require('../lib/mongodb');
const { getSessionFromRequest } = require('../lib/auth');

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

module.exports = async (req, res) => {
  const session = getSessionFromRequest(req);
  if (!session) {
    return res.status(401).json({ error: 'Please sign in.' });
  }

  const db = await getDb();
  const menuItems = db.collection('menuItems');
  const votes = db.collection('votes');

  if (req.method === 'GET') {
    const date = req.query.date || todayStr();

    const items = await menuItems.find({ menuDate: date }).sort({ sortOrder: 1, _id: 1 }).toArray();

    const tallyAgg = await votes
      .aggregate([
        { $match: { voteDate: date } },
        { $group: { _id: '$menuItemId', count: { $sum: 1 } } },
      ])
      .toArray();
    const countsByItem = {};
    tallyAgg.forEach((r) => {
      countsByItem[r._id.toString()] = r.count;
    });

    const myVoteDoc = await votes.findOne({ userId: session.userId, voteDate: date });
    const myVote = myVoteDoc ? myVoteDoc.menuItemId.toString() : null;

    const tally = items.map((item) => ({
      id: item._id.toString(),
      emoji: item.emoji,
      name: item.name,
      count: countsByItem[item._id.toString()] || 0,
    }));
    const total = tally.reduce((sum, t) => sum + t.count, 0);

    const payload = { date, myVote, tally, total };

    if (session.isAdmin) {
      const voterDocs = await votes.find({ voteDate: date }).toArray();

      const userIds = voterDocs
        .map((v) => {
          try {
            return new ObjectId(v.userId);
          } catch (e) {
            return null;
          }
        })
        .filter(Boolean);

      const users = db.collection('users');
      const userDocs = await users.find({ _id: { $in: userIds } }).toArray();
      const usernameById = {};
      userDocs.forEach((u) => {
        usernameById[u._id.toString()] = u.username;
      });

      payload.voterList = voterDocs
        .map((v) => ({
          username: usernameById[v.userId] || 'unknown',
          menu_item_id: v.menuItemId.toString(),
        }))
        .sort((a, b) => a.username.localeCompare(b.username));
    }

    return res.status(200).json(payload);
  }

  if (req.method === 'POST') {
    const { date, itemId } = req.body || {};
    if (!date || !itemId) {
      return res.status(400).json({ error: 'Date and item are required.' });
    }

    let itemObjectId;
    try {
      itemObjectId = new ObjectId(itemId);
    } catch (e) {
      return res.status(400).json({ error: 'Invalid menu item for this date.' });
    }

    const itemCheck = await menuItems.findOne({ _id: itemObjectId, menuDate: date });
    if (!itemCheck) {
      return res.status(400).json({ error: 'Invalid menu item for this date.' });
    }

    const existing = await votes.findOne({ userId: session.userId, voteDate: date });
    if (existing) {
      return res.status(409).json({ error: 'You have already voted today.' });
    }

    try {
      await votes.insertOne({
        userId: session.userId,
        menuItemId: itemObjectId,
        voteDate: date,
        createdAt: new Date(),
      });
    } catch (err) {
      // Unique index on (userId, voteDate) guards against a double-submit race.
      if (err && err.code === 11000) {
        return res.status(409).json({ error: 'You have already voted today.' });
      }
      throw err;
    }

    return res.status(200).json({ ok: true });
  }

  return res.status(405).json({ error: 'Method not allowed' });
};
