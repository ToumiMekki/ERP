const TelegramBot = require('node-telegram-bot-api');
const db = require('./db');
const fs = require('fs');
const path = require('path');
const https = require('https');
const sharp = require('sharp');
const ffmpeg = require('fluent-ffmpeg');
const { messages } = require('./bot-messages');

const token = process.env.BOT_TOKEN;
if (!token) {
  console.error('BOT_TOKEN not set in .env');
  process.exit(1);
}

const bot = new TelegramBot(token, { polling: true });

// Main menu reply keyboard (2 columns x 2 rows)
const mainMenuKeyboard = {
  reply_markup: {
    keyboard: [
      [messages.buttons.newReport, messages.buttons.finishReport],
      [messages.buttons.myReports, messages.buttons.help]
    ],
    resize_keyboard: true
  }
};

// Phone request keyboard for first-time users
const phoneRequestKeyboard = {
  reply_markup: {
    keyboard: [[{ text: messages.buttons.sharePhone, request_contact: true }]],
    resize_keyboard: true,
    one_time_keyboard: true
  }
};

// Helper function to download file
function downloadFile(url, destPath) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(destPath);
    https.get(url, (response) => {
      response.pipe(file);
      file.on('finish', () => {
        file.close();
        resolve();
      });
    }).on('error', (err) => {
      fs.unlink(destPath, () => {});
      reject(err);
    });
  });
}

// /start command
bot.onText(/\/start/, async (msg) => {
  const chatId = msg.chat.id;
  const telegramId = msg.from.id.toString();

  const employee = db.prepare('SELECT * FROM employees WHERE telegram_id = ?').get(telegramId);

  if (!employee) {
    bot.sendMessage(chatId, messages.askPhone, phoneRequestKeyboard);
  } else if (!employee.is_active) {
    bot.sendMessage(chatId, messages.inactiveAccount);
  } else {
    bot.sendMessage(chatId, messages.welcomeBack(employee.full_name), mainMenuKeyboard);
  }
});

// Contact message (phone number sharing)
bot.on('contact', async (msg) => {
  const chatId = msg.chat.id;
  const telegramId = msg.from.id.toString();
  const phone = msg.contact.phone_number;
  const fullName = `${msg.from.first_name} ${msg.from.last_name || ''}`.trim();
  const username = msg.from.username || null;

  const stmt = db.prepare(`
    INSERT OR IGNORE INTO employees (telegram_id, telegram_username, full_name, phone, is_active)
    VALUES (?, ?, ?, ?, 1)
  `);
  stmt.run(telegramId, username, fullName, phone);

  bot.sendMessage(chatId, messages.activationSuccess(fullName));
  bot.sendMessage(chatId, 'اختر من القائمة بالأسفل للبدء:', mainMenuKeyboard);
});

// Text message handler - handles menu buttons and free text
bot.on('message', async (msg) => {
  // Skip if it's a command (handled separately)
  if (msg.text && msg.text.startsWith('/')) return;

  const chatId = msg.chat.id;
  const telegramId = msg.from.id.toString();
  const text = msg.text || msg.caption;

  if (!text) return;

  const employee = db.prepare('SELECT * FROM employees WHERE telegram_id = ?').get(telegramId);
  if (!employee) {
    bot.sendMessage(chatId, messages.askPhone, phoneRequestKeyboard);
    return;
  }

  if (!employee.is_active) {
    bot.sendMessage(chatId, messages.inactiveAccount);
    return;
  }

  // Check for menu button presses
  if (text === messages.buttons.newReport) {
    handleNewReport(chatId, employee);
    return;
  }

  if (text === messages.buttons.finishReport) {
    handleFinishReport(chatId, employee);
    return;
  }

  if (text === messages.buttons.myReports) {
    handleMyReports(chatId, employee);
    return;
  }

  if (text === messages.buttons.help) {
    bot.sendMessage(chatId, messages.help);
    return;
  }

  // If not a button, treat as free text note
  if (employee.open_task_id) {
    // Append to existing note
    const task = db.prepare('SELECT note_text FROM tasks WHERE id = ?').get(employee.open_task_id);
    const existingNote = task.note_text || '';
    db.prepare('UPDATE tasks SET note_text = ?, updated_at = datetime(\'now\') WHERE id = ?').run(
      existingNote ? existingNote + '\n' + text : text,
      employee.open_task_id
    );
    bot.sendMessage(chatId, messages.noteReceived);
  } else {
    bot.sendMessage(chatId, messages.noOpenTask, mainMenuKeyboard);
  }
});

// Handle new report button
async function handleNewReport(chatId, employee) {
  // Check if there's already an open task
  if (employee.open_task_id) {
    // Show inline keyboard for resume vs new
    bot.sendMessage(chatId, messages.hasOpenTask, {
      reply_markup: {
        inline_keyboard: [
          [
            { text: messages.resumeExisting, callback_data: 'resume_existing' },
            { text: messages.startNew, callback_data: 'start_new' }
          ]
        ]
      }
    });
    return;
  }

  // Create new task
  const stmt = db.prepare(`
    INSERT INTO tasks (employee_id, status, created_at, updated_at)
    VALUES (?, 'unread', datetime(\'now\'), datetime(\'now\'))
  `);
  const result = stmt.run(employee.id);
  const taskId = result.lastInsertRowid;

  // Set open_task_id for employee
  db.prepare('UPDATE employees SET open_task_id = ? WHERE id = ?').run(taskId, employee.id);

  bot.sendMessage(chatId, messages.reportOpened);
}

// Handle finish report button
async function handleFinishReport(chatId, employee) {
  if (!employee.open_task_id) {
    bot.sendMessage(chatId, messages.noOpenTask, mainMenuKeyboard);
    return;
  }

  // Get task stats
  const taskId = employee.open_task_id;
  const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(taskId);
  const photoCount = db.prepare('SELECT COUNT(*) as count FROM task_photos WHERE task_id = ?').get(taskId).count;
  const voiceCount = db.prepare('SELECT COUNT(*) as count FROM task_voices WHERE task_id = ?').get(taskId).count;
  const hasText = task.note_text && task.note_text.trim().length > 0;

  // Check if empty
  if (photoCount === 0 && voiceCount === 0 && !hasText) {
    bot.sendMessage(chatId, messages.emptyReportWarning);
    return;
  }

  // Show summary with inline keyboard
  bot.sendMessage(chatId, messages.reportSummary(photoCount, voiceCount, hasText), {
    reply_markup: {
      inline_keyboard: [
        [
          { text: messages.confirmSend, callback_data: 'confirm_send' },
          { text: messages.cancelSend, callback_data: 'cancel_send' }
        ]
      ]
    }
  });
}

// Handle my reports button
async function handleMyReports(chatId, employee) {
  const tasks = db.prepare(`
    SELECT t.*, 
      (SELECT COUNT(*) FROM task_photos WHERE task_id = t.id) as photo_count,
      (SELECT COUNT(*) FROM task_voices WHERE task_id = t.id) as voice_count
    FROM tasks t
    WHERE t.employee_id = ?
    ORDER BY t.created_at DESC
    LIMIT 5
  `).all(employee.id);

  let reportText = messages.myReportsHeader;
  
  for (const task of tasks) {
    const date = new Date(task.created_at).toLocaleDateString('ar-EG');
    const statusArabic = messages.statusInArabic[task.status] || task.status;
    reportText += messages.reportLine(date, task.photo_count, task.voice_count, statusArabic) + '\n';
  }

  if (tasks.length === 0) {
    reportText += 'لا توجد تقارير بعد';
  }

  bot.sendMessage(chatId, reportText);
}

// Callback query handler for inline keyboards
bot.on('callback_query', async (query) => {
  const chatId = query.message.chat.id;
  const telegramId = query.from.id.toString();
  const data = query.data;

  const employee = db.prepare('SELECT * FROM employees WHERE telegram_id = ?').get(telegramId);
  if (!employee) {
    bot.answerCallbackQuery(query.id);
    return;
  }

  // Handle finish report confirmation
  if (data === 'confirm_send') {
    const taskId = employee.open_task_id;
    
    // Clear open_task_id and mark as received
    db.prepare('UPDATE employees SET open_task_id = NULL WHERE id = ?').run(employee.id);
    db.prepare('UPDATE tasks SET status = ?, updated_at = datetime(\'now\') WHERE id = ?').run('received', taskId);
    
    // Remove inline keyboard from the message
    try {
      if (query.message && query.message.chat && query.message.message_id) {
        bot.editMessageReplyMarkup({
          chat_id: query.message.chat.id,
          message_id: query.message.message_id,
          reply_markup: { inline_keyboard: [] }
        });
      }
    } catch (e) {
      // Ignore if message was already deleted or modified
    }
    
    // Send success message with main menu
    bot.sendMessage(chatId, messages.reportSent, mainMenuKeyboard);
    
    bot.answerCallbackQuery(query.id);
  }
  
  else if (data === 'cancel_send') {
    // Remove inline keyboard from the message
    try {
      if (query.message && query.message.chat && query.message.message_id) {
        bot.editMessageReplyMarkup({
          chat_id: query.message.chat.id,
          message_id: query.message.message_id,
          reply_markup: { inline_keyboard: [] }
        });
      }
    } catch (e) {
      // Ignore if message was already deleted or modified
    }
    
    // Send cancel message
    bot.sendMessage(chatId, messages.reportCancelled);
    
    bot.answerCallbackQuery(query.id);
  }
  
  // Handle resume vs new task confirmation
  else if (data === 'resume_existing') {
    // Remove inline keyboard
    try {
      if (query.message && query.message.chat && query.message.message_id) {
        bot.editMessageReplyMarkup({
          chat_id: query.message.chat.id,
          message_id: query.message.message_id,
          reply_markup: { inline_keyboard: [] }
        });
      }
    } catch (e) {
      // Ignore if message was already deleted or modified
    }
    
    // Send message to continue
    bot.sendMessage(chatId, 'يمكنك متابعة إضافة المزيد إلى تقريرك الحالي');
    
    bot.answerCallbackQuery(query.id);
  }
  
  else if (data === 'start_new') {
    const oldTaskId = employee.open_task_id;
    
    // Close old task (mark as received)
    if (oldTaskId) {
      db.prepare('UPDATE tasks SET status = ?, updated_at = datetime(\'now\') WHERE id = ?').run('received', oldTaskId);
    }
    
    // Create new task
    const stmt = db.prepare(`
      INSERT INTO tasks (employee_id, status, created_at, updated_at)
      VALUES (?, 'unread', datetime(\'now\'), datetime(\'now\'))
    `);
    const result = stmt.run(employee.id);
    const taskId = result.lastInsertRowid;
    
    // Set open_task_id for employee
    db.prepare('UPDATE employees SET open_task_id = ? WHERE id = ?').run(taskId, employee.id);
    
    // Remove inline keyboard
    try {
      if (query.message && query.message.chat && query.message.message_id) {
        bot.editMessageReplyMarkup({
          chat_id: query.message.chat.id,
          message_id: query.message.message_id,
          reply_markup: { inline_keyboard: [] }
        });
      }
    } catch (e) {
      // Ignore if message was already deleted or modified
    }
    
    // Send new report opened message
    bot.sendMessage(chatId, messages.reportOpened);
    
    bot.answerCallbackQuery(query.id);
  }
  
  else {
    bot.answerCallbackQuery(query.id);
  }
});

// Photo message
bot.on('photo', async (msg) => {
  const chatId = msg.chat.id;
  const telegramId = msg.from.id.toString();

  const employee = db.prepare('SELECT * FROM employees WHERE telegram_id = ?').get(telegramId);
  if (!employee) {
    bot.sendMessage(chatId, messages.askPhone, phoneRequestKeyboard);
    return;
  }

  if (!employee.is_active) {
    bot.sendMessage(chatId, messages.inactiveAccount);
    return;
  }

  try {
    // Show typing indicator
    bot.sendChatAction(chatId, 'upload_photo');
    
    // Get the largest photo (last in array)
    const photo = msg.photo[msg.photo.length - 1];
    const fileId = photo.file_id;
    
    let taskId = employee.open_task_id;

    // Auto-create task if none open
    if (!taskId) {
      const stmt = db.prepare(`
        INSERT INTO tasks (employee_id, status, created_at, updated_at)
        VALUES (?, 'unread', datetime(\'now\'), datetime(\'now\'))
      `);
      const result = stmt.run(employee.id);
      taskId = result.lastInsertRowid;
      db.prepare('UPDATE employees SET open_task_id = ? WHERE id = ?').run(taskId, employee.id);
    }

    // Check if this photo was already processed for THIS task
    const existingPhoto = db.prepare('SELECT * FROM task_photos WHERE task_id = ? AND file_id = ?').get(taskId, fileId);
    if (existingPhoto) {
      return; // Skip duplicate for this task
    }
    
    const fileLink = await bot.getFileLink(fileId);
    const timestamp = Date.now();
    const photoPath = `uploads/photos/${timestamp}.jpg`;
    const fullPath = path.join(__dirname, photoPath);

    await downloadFile(fileLink, fullPath);

    // Compress photo using sharp
    await sharp(fullPath)
      .resize(1200, null, { fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 80 })
      .toFile(fullPath.replace('.jpg', '_compressed.jpg'));

    // Replace original with compressed version
    fs.unlinkSync(fullPath);
    fs.renameSync(fullPath.replace('.jpg', '_compressed.jpg'), fullPath);

    // Insert photo with file_id to prevent duplicates
    db.prepare('INSERT INTO task_photos (task_id, file_path, file_id, created_at) VALUES (?, ?, ?, datetime(\'now\'))').run(taskId, photoPath, fileId);
    db.prepare('UPDATE tasks SET updated_at = datetime(\'now\') WHERE id = ?').run(taskId);

    // Get photo count for this task
    const photoCount = db.prepare('SELECT COUNT(*) as count FROM task_photos WHERE task_id = ?').get(taskId).count;
    bot.sendMessage(chatId, messages.photoReceived(photoCount));

  } catch (error) {
    console.error('Error processing photo:', error);
    bot.sendMessage(chatId, 'حدث خطأ في معالجة الصورة. يرجى المحاولة مرة أخرى.');
  }
});

// Voice message
bot.on('voice', async (msg) => {
  const chatId = msg.chat.id;
  const telegramId = msg.from.id.toString();

  const employee = db.prepare('SELECT * FROM employees WHERE telegram_id = ?').get(telegramId);
  if (!employee) {
    bot.sendMessage(chatId, messages.askPhone, phoneRequestKeyboard);
    return;
  }

  if (!employee.is_active) {
    bot.sendMessage(chatId, messages.inactiveAccount);
    return;
  }

  try {
    // Show typing indicator
    bot.sendChatAction(chatId, 'record_voice');
    
    const fileLink = await bot.getFileLink(msg.voice.file_id);
    const timestamp = Date.now();
    const voicePath = `uploads/voice/${timestamp}.ogg`;
    const fullPath = path.join(__dirname, voicePath);
    const duration = msg.voice.duration || null;

    await downloadFile(fileLink, fullPath);

    // Compress voice using ffmpeg
    const compressedPath = fullPath.replace('.ogg', '_compressed.ogg');
    await new Promise((resolve, reject) => {
      ffmpeg(fullPath)
        .audioBitrate('32k')
        .audioChannels(1)
        .toFormat('ogg')
        .on('end', resolve)
        .on('error', reject)
        .save(compressedPath);
    });

    // Replace original with compressed version
    fs.unlinkSync(fullPath);
    fs.renameSync(compressedPath, fullPath);

    let taskId = employee.open_task_id;

    // Auto-create task if none open
    if (!taskId) {
      const stmt = db.prepare(`
        INSERT INTO tasks (employee_id, status, created_at, updated_at)
        VALUES (?, 'unread', datetime(\'now\'), datetime(\'now\'))
      `);
      const result = stmt.run(employee.id);
      taskId = result.lastInsertRowid;
      db.prepare('UPDATE employees SET open_task_id = ? WHERE id = ?').run(taskId, employee.id);
    }

    // Insert voice
    db.prepare('INSERT INTO task_voices (task_id, file_path, duration_seconds, created_at) VALUES (?, ?, ?, datetime(\'now\'))').run(taskId, voicePath, duration);
    db.prepare('UPDATE tasks SET updated_at = datetime(\'now\') WHERE id = ?').run(taskId);

    bot.sendMessage(chatId, messages.voiceReceived);

  } catch (error) {
    console.error('Error processing voice:', error);
    bot.sendMessage(chatId, 'حدث خطأ في معالجة الرسالة الصوتية. يرجى المحاولة مرة أخرى.');
  }
});

console.log('Telegram bot started...');
