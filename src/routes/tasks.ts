import { Router } from 'express';
import { db } from '../lib/db.js';
import { requireAuth } from '../lib/auth.js';
import { broadcastToHousehold } from '../lib/ws.js';
import crypto from 'crypto';

const router = Router();

router.use(requireAuth);

router.get('/', (req, res) => {
  const householdId = (req as any).user.householdId;
  if (!householdId) return res.status(400).json({ error: 'Not in a household' });

  const tasks = db.prepare(\`
    SELECT t.*, u.name as assignee_name, u.avatar as assignee_avatar, c.name as completed_by_name
    FROM tasks t
    LEFT JOIN users u ON t.assignee_id = u.id
    LEFT JOIN users c ON t.completed_by = c.id
    WHERE t.household_id = ?
    ORDER BY t.created_at DESC
  \`).all(householdId);

  res.json({ tasks });
});

router.post('/', (req, res) => {
  const householdId = (req as any).user.householdId;
  if (!householdId) return res.status(400).json({ error: 'Not in a household' });

  const { title, description, due_date, assignee_id, priority, category, points } = req.body;
  const id = crypto.randomUUID();

  db.prepare(\`
    INSERT INTO tasks (id, household_id, title, description, due_date, assignee_id, priority, category, points)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  \`).run(id, householdId, title, description || null, due_date || null, assignee_id || null, priority || 'medium', category || null, points || 0);

  const task = db.prepare(\`
    SELECT t.*, u.name as assignee_name, u.avatar as assignee_avatar
    FROM tasks t
    LEFT JOIN users u ON t.assignee_id = u.id
    WHERE t.id = ?
  \`).get(id);

  broadcastToHousehold(householdId, 'task:created', task);
  res.json({ task });
});

router.put('/:id', (req, res) => {
  const householdId = (req as any).user.householdId;
  const userId = (req as any).user.userId;
  if (!householdId) return res.status(400).json({ error: 'Not in a household' });

  const { id } = req.params;
  const { title, description, due_date, assignee_id, priority, category, points, status } = req.body;

  const existing = db.prepare('SELECT * FROM tasks WHERE id = ? AND household_id = ?').get(id, householdId) as any;
  if (!existing) return res.status(404).json({ error: 'Task not found' });

  let completed_at = existing.completed_at;
  let completed_by = existing.completed_by;

  if (status === 'done' && existing.status !== 'done') {
    completed_at = new Date().toISOString();
    completed_by = userId;
  } else if (status === 'todo' && existing.status !== 'todo') {
    completed_at = null;
    completed_by = null;
  }

  db.prepare(\`
    UPDATE tasks 
    SET title = COALESCE(?, title),
        description = COALESCE(?, description),
        due_date = ?,
        assignee_id = ?,
        priority = COALESCE(?, priority),
        category = COALESCE(?, category),
        points = COALESCE(?, points),
        status = COALESCE(?, status),
        completed_at = ?,
        completed_by = ?
    WHERE id = ? AND household_id = ?
  \`).run(
    title, description, due_date, assignee_id, priority, category, points, status, completed_at, completed_by, id, householdId
  );

  const task = db.prepare(\`
    SELECT t.*, u.name as assignee_name, u.avatar as assignee_avatar, c.name as completed_by_name
    FROM tasks t
    LEFT JOIN users u ON t.assignee_id = u.id
    LEFT JOIN users c ON t.completed_by = c.id
    WHERE t.id = ?
  \`).get(id);

  broadcastToHousehold(householdId, 'task:updated', task);
  res.json({ task });
});

router.delete('/:id', (req, res) => {
  const householdId = (req as any).user.householdId;
  if (!householdId) return res.status(400).json({ error: 'Not in a household' });

  const { id } = req.params;
  
  const result = db.prepare('DELETE FROM tasks WHERE id = ? AND household_id = ?').run(id, householdId);
  if (result.changes > 0) {
    broadcastToHousehold(householdId, 'task:deleted', { id });
  }

  res.json({ success: true });
});

export default router;
