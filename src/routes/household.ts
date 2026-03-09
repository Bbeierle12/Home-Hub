import { Router } from 'express';
import { db } from '../lib/db.js';
import { requireAuth, generateToken } from '../lib/auth.js';
import crypto from 'crypto';

const router = Router();

router.post('/create', requireAuth, (req, res) => {
  const { name } = req.body;
  const userId = (req as any).user.userId;

  const householdId = crypto.randomUUID();
  const inviteCode = crypto.randomBytes(4).toString('hex');

  db.transaction(() => {
    db.prepare('INSERT INTO households (id, name, invite_code) VALUES (?, ?, ?)').run(householdId, name, inviteCode);
    db.prepare('INSERT INTO household_members (user_id, household_id, role) VALUES (?, ?, ?)').run(userId, householdId, 'admin');
  })();

  const token = generateToken(userId, householdId);
  res.cookie('token', token, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'none' });
  res.json({ household: { id: householdId, name, inviteCode }, token });
});

router.post('/join', requireAuth, (req, res) => {
  const { inviteCode } = req.body;
  const userId = (req as any).user.userId;

  const household = db.prepare('SELECT id FROM households WHERE invite_code = ?').get(inviteCode) as any;
  if (!household) {
    return res.status(404).json({ error: 'Invalid invite code' });
  }

  try {
    db.prepare('INSERT INTO household_members (user_id, household_id, role) VALUES (?, ?, ?)').run(userId, household.id, 'member');
  } catch (e: any) {
    if (e.message.includes('UNIQUE constraint failed')) {
      return res.status(400).json({ error: 'Already a member' });
    }
    return res.status(500).json({ error: 'Server error' });
  }

  const token = generateToken(userId, household.id);
  res.cookie('token', token, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'none' });
  res.json({ household: { id: household.id }, token });
});

router.get('/members', requireAuth, (req, res) => {
  const householdId = (req as any).user.householdId;
  if (!householdId) {
    return res.status(400).json({ error: 'Not in a household' });
  }

  const members = db.prepare(`
    SELECT u.id, u.name, u.email, hm.role 
    FROM users u 
    JOIN household_members hm ON u.id = hm.user_id 
    WHERE hm.household_id = ?
  `).all(householdId);

  res.json({ members });
});

export default router;
