import { Router } from 'express';
import { db } from '../lib/db.js';
import { generateToken } from '../lib/auth.js';
import crypto from 'crypto';

const router = Router();

router.post('/register', (req, res) => {
  const { email, password, name } = req.body;
  
  try {
    const id = crypto.randomUUID();
    // In a real app, hash the password!
    db.prepare('INSERT INTO users (id, email, password, name) VALUES (?, ?, ?, ?)').run(id, email, password, name);
    
    const token = generateToken(id);
    res.cookie('token', token, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'none' });
    res.json({ user: { id, email, name }, token });
  } catch (e: any) {
    if (e.message.includes('UNIQUE constraint failed')) {
      return res.status(400).json({ error: 'Email already exists' });
    }
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/login', (req, res) => {
  const { email, password } = req.body;
  
  const user = db.prepare('SELECT * FROM users WHERE email = ? AND password = ?').get(email, password) as any;
  
  if (!user) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  // Get household if any
  const member = db.prepare('SELECT household_id FROM household_members WHERE user_id = ?').get(user.id) as any;
  const householdId = member?.household_id;

  const token = generateToken(user.id, householdId);
  res.cookie('token', token, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'none' });
  res.json({ user: { id: user.id, email: user.email, name: user.name, householdId }, token });
});

router.post('/logout', (req, res) => {
  res.clearCookie('token');
  res.json({ success: true });
});

export default router;
