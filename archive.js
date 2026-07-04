const db = require('./db');
const fs = require('fs');
const path = require('path');

function archiveOldDoneTasks() {
  console.log('Running archive job...');

  // Find tasks that are done and older than 7 days
  const oldTasks = db.prepare(`
    SELECT t.*, e.full_name as employee_name, e.phone as employee_phone
    FROM tasks t
    JOIN employees e ON t.employee_id = e.id
    WHERE t.status = 'done' 
    AND t.done_at IS NOT NULL
    AND julianday('now') - julianday(t.done_at) > 7
  `).all();

  console.log(`Found ${oldTasks.length} tasks to archive`);

  let archivedCount = 0;

  for (const task of oldTasks) {
    try {
      // Get photo and voice counts
      const photoCount = db.prepare('SELECT COUNT(*) as count FROM task_photos WHERE task_id = ?').get(task.id).count;
      const voiceCount = db.prepare('SELECT COUNT(*) as count FROM task_voices WHERE task_id = ?').get(task.id).count;

      // Insert into archived_tasks
      db.prepare(`
        INSERT INTO archived_tasks (
          original_task_id, employee_name, employee_phone, note_text,
          accountant_note, amount, photo_count, voice_count,
          task_created_at, task_done_at, archived_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
      `).run(
        task.id,
        task.employee_name,
        task.employee_phone,
        task.note_text,
        task.accountant_note,
        task.amount,
        photoCount,
        voiceCount,
        task.created_at,
        task.done_at
      );

      // Get all photo paths
      const photos = db.prepare('SELECT file_path FROM task_photos WHERE task_id = ?').all(task.id);
      
      // Delete photo files from disk
      for (const photo of photos) {
        const fullPath = path.join(__dirname, photo.file_path);
        try {
          fs.unlinkSync(fullPath);
        } catch (e) {
          console.error(`Failed to delete photo file: ${fullPath}`, e.message);
        }
      }

      // Get all voice paths
      const voices = db.prepare('SELECT file_path FROM task_voices WHERE task_id = ?').all(task.id);
      
      // Delete voice files from disk
      for (const voice of voices) {
        const fullPath = path.join(__dirname, voice.file_path);
        try {
          fs.unlinkSync(fullPath);
        } catch (e) {
          console.error(`Failed to delete voice file: ${fullPath}`, e.message);
        }
      }

      // Delete from task_photos
      db.prepare('DELETE FROM task_photos WHERE task_id = ?').run(task.id);

      // Delete from task_voices
      db.prepare('DELETE FROM task_voices WHERE task_id = ?').run(task.id);

      // Delete the task itself
      db.prepare('DELETE FROM tasks WHERE id = ?').run(task.id);

      archivedCount++;
      console.log(`Archived task ${task.id} from ${task.employee_name}`);
    } catch (e) {
      console.error(`Error archiving task ${task.id}:`, e.message);
    }
  }

  console.log(`Archive job completed. Archived ${archivedCount} tasks.`);
  return archivedCount;
}

module.exports = { archiveOldDoneTasks };
