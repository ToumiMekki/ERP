require('dotenv').config();
const express = require('express');
const cookieParser = require('cookie-parser');
const path = require('path');
const cron = require('node-cron');
const db = require('./db');
const { archiveOldDoneTasks } = require('./archive');
require('./bot');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

// Serve uploaded files
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Login route
app.post('/login', (req, res) => {
  const { password } = req.body;
  if (password === process.env.DASHBOARD_PASSWORD) {
    res.cookie('auth', '1', { httpOnly: true });
    res.json({ success: true });
  } else {
    res.json({ success: false, error: 'Invalid password' });
  }
});

// Auth middleware
const requireAuth = (req, res, next) => {
  if (req.cookies.auth === '1') {
    next();
  } else {
    res.status(401).json({ success: false, error: 'Unauthorized' });
  }
};

// Get all tasks with search/filter
app.get('/api/tasks', requireAuth, (req, res) => {
  const { status, search, employeeId, dateFrom, dateTo, page = 1, limit = 20 } = req.query;
  const offset = (parseInt(page) - 1) * parseInt(limit);
  
  let query = `
    SELECT 
      t.*,
      e.full_name as employee_name,
      e.telegram_username,
      e.phone as employee_phone,
      (SELECT COUNT(*) FROM task_photos WHERE task_id = t.id) as photo_count,
      (SELECT COUNT(*) FROM task_voices WHERE task_id = t.id) as voice_count
    FROM tasks t
    JOIN employees e ON t.employee_id = e.id
    WHERE 1=1
  `;
  const params = [];

  if (status) {
    query += ' AND t.status = ?';
    params.push(status);
  }

  if (employeeId) {
    query += ' AND t.employee_id = ?';
    params.push(employeeId);
  }

  if (search) {
    query += ' AND (e.full_name LIKE ? OR e.telegram_username LIKE ? OR e.phone LIKE ?)';
    const searchPattern = `%${search}%`;
    params.push(searchPattern, searchPattern, searchPattern);
  }

  if (dateFrom) {
    query += ' AND date(t.created_at) >= ?';
    params.push(dateFrom);
  }

  if (dateTo) {
    query += ' AND date(t.created_at) <= ?';
    params.push(dateTo);
  }

  query += ' ORDER BY t.created_at DESC LIMIT ? OFFSET ?';
  params.push(parseInt(limit), offset);

  try {
    const tasks = db.prepare(query).all(...params);
    
    // Get total count for pagination
    let countQuery = `
      SELECT COUNT(*) as total
      FROM tasks t
      JOIN employees e ON t.employee_id = e.id
      WHERE 1=1
    `;
    const countParams = [];

    if (status) {
      countQuery += ' AND t.status = ?';
      countParams.push(status);
    }

    if (employeeId) {
      countQuery += ' AND t.employee_id = ?';
      countParams.push(employeeId);
    }

    if (search) {
      countQuery += ' AND (e.full_name LIKE ? OR e.telegram_username LIKE ? OR e.phone LIKE ?)';
      const searchPattern = `%${search}%`;
      countParams.push(searchPattern, searchPattern, searchPattern);
    }

    if (dateFrom) {
      countQuery += ' AND date(t.created_at) >= ?';
      countParams.push(dateFrom);
    }

    if (dateTo) {
      countQuery += ' AND date(t.created_at) <= ?';
      countParams.push(dateTo);
    }

    const countResult = db.prepare(countQuery).get(...countParams);
    const total = countResult.total;
    const totalPages = Math.ceil(total / parseInt(limit));

    res.json({ 
      success: true, 
      data: tasks,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages
      }
    });
  } catch (err) {
    res.json({ success: false, error: err.message });
  }
});

// Get single task with photos and voices
app.get('/api/tasks/:id', requireAuth, (req, res) => {
  const id = req.params.id;

  try {
    const task = db.prepare(`
      SELECT 
        t.*,
        e.full_name as employee_name,
        e.telegram_username,
        e.phone as employee_phone
      FROM tasks t
      JOIN employees e ON t.employee_id = e.id
      WHERE t.id = ?
    `).get(id);

    if (!task) {
      res.json({ success: false, error: 'Task not found' });
      return;
    }

    // Get photos
    const photos = db.prepare('SELECT * FROM task_photos WHERE task_id = ? ORDER BY created_at').all(id);
    
    // Get voices
    const voices = db.prepare('SELECT * FROM task_voices WHERE task_id = ? ORDER BY created_at').all(id);

    // Auto-change status to 'read' when accountant views the task (from 'received')
    if (task.status === 'received') {
      db.prepare('UPDATE tasks SET status = ? WHERE id = ?').run('read', id);
      task.status = 'read';
    }

    res.json({ 
      success: true, 
      data: {
        ...task,
        photos,
        voices
      }
    });
  } catch (err) {
    res.json({ success: false, error: err.message });
  }
});

// Update task
app.patch('/api/tasks/:id', requireAuth, (req, res) => {
  const id = req.params.id;
  const { accountant_note, amount, status } = req.body;

  let updates = [];
  let params = [];

  if (accountant_note !== undefined) {
    updates.push('accountant_note = ?');
    params.push(accountant_note);
  }

  if (amount !== undefined) {
    updates.push('amount = ?');
    params.push(amount);
  }

  // Auto-change status to 'done' when accountant takes action (adds note or amount)
  if ((accountant_note !== undefined && accountant_note) || (amount !== undefined && amount)) {
    updates.push('status = ?');
    params.push('done');
  } else if (status !== undefined) {
    updates.push('status = ?');
    params.push(status);
  }

  if (updates.length === 0) {
    res.json({ success: false, error: 'No fields to update' });
    return;
  }

  params.push(id);

  try {
    db.prepare(`UPDATE tasks SET ${updates.join(', ')} WHERE id = ?`).run(...params);
    res.json({ success: true });
  } catch (err) {
    res.json({ success: false, error: err.message });
  }
});

// Mark task as done
app.post('/api/tasks/:id/done', requireAuth, (req, res) => {
  const id = req.params.id;

  try {
    db.prepare('UPDATE tasks SET status = ?, done_at = datetime(\'now\') WHERE id = ?').run('done', id);
    res.json({ success: true });
  } catch (err) {
    res.json({ success: false, error: err.message });
  }
});

// Get all employees
app.get('/api/employees', requireAuth, (req, res) => {
  try {
    const employees = db.prepare('SELECT id, full_name, telegram_username, phone FROM employees WHERE is_active = 1 ORDER BY full_name').all();
    res.json({ success: true, data: employees });
  } catch (err) {
    res.json({ success: false, error: err.message });
  }
});

// Get archived tasks
app.get('/api/archived-tasks', requireAuth, (req, res) => {
  try {
    const archived = db.prepare('SELECT * FROM archived_tasks ORDER BY archived_at DESC').all();
    res.json({ success: true, data: archived });
  } catch (err) {
    res.json({ success: false, error: err.message });
  }
});

// Schedule archive job to run daily at 3 AM
cron.schedule('0 3 * * *', () => {
  console.log('Running scheduled archive job...');
  archiveOldDoneTasks();
});

// Run archive job once on server startup for testing
archiveOldDoneTasks();

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
