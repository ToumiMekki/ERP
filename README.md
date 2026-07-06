# CHAOS ERP - Field Report Management System

A comprehensive Telegram bot and web dashboard for managing field reports with multi-language support, real-time notifications, and efficient task handling.

## 📋 Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Tech Stack](#tech-stack)
- [Architecture](#architecture)
- [Installation](#installation)
- [Configuration](#configuration)
- [Database Schema](#database-schema)
- [API Endpoints](#api-endpoints)
- [Telegram Bot Setup](#telegram-bot-setup)
- [Deployment](#deployment)
- [Usage Guide](#usage-guide)
- [Multi-Language Support](#multi-language-support)
- [Troubleshooting](#troubleshooting)

## 🎯 Overview

CHAOS ERP is a field report management system designed for teams to collect, process, and track reports through Telegram. Employees can send photos, voice notes, and text messages which are automatically organized into tasks that accountants can review, process, and archive.

**Key Benefits:**
- **Mobile-First:** Employees use Telegram to submit reports from anywhere
- **Real-Time:** Instant notifications when new reports arrive
- **Multi-Language:** Supports Arabic, French, and English
- **Efficient:** Automatic duplicate prevention and cleanup
- **Concurrent:** Handles multiple users simultaneously

## ✨ Features

### For Employees (Telegram Bot)
- Send photos with automatic compression
- Record voice notes with audio compression
- Add text notes to reports
- Multi-file support per report
- Automatic task creation
- Confirmation messages on submission

### For Accountants (Web Dashboard)
- Real-time task dashboard
- Multi-language interface (AR/FR/EN)
- Advanced filtering (status, employee, date range)
- Search by name, username, or phone
- Task status management (Pending → Received → Reviewing → Done)
- Add accountant notes
- Set amounts for reports
- View photos and listen to voice notes
- Archive completed tasks
- Responsive design for all devices
- Notification sounds and unread counts
- Auto-status change when viewing tasks

### System Features
- **Duplicate Prevention:** Prevents duplicate file uploads
- **Auto-Cleanup:** Deletes empty tasks after 5 minutes
- **Multi-User:** Concurrent user support
- **Data Persistence:** SQLite database
- **File Compression:** Automatic photo/voice compression
- **Security:** Password-protected dashboard

## 🛠 Tech Stack

### Backend
- **Node.js** - Runtime environment
- **Express.js** - Web framework
- **SQLite** (better-sqlite3) - Database
- **node-telegram-bot-api** - Telegram Bot API
- **sharp** - Image processing
- **fluent-ffmpeg** - Audio processing
- **multer** - File uploads
- **node-cron** - Scheduled tasks
- **dotenv** - Environment variables
- **cookie-parser** - Session management

### Frontend
- **HTML5** - Structure
- **Tailwind CSS v4** - Styling
- **Vanilla JavaScript** - Interactivity
- **Web Audio API** - Notification sounds
- **Google Fonts** - Typography (Inter, Playfair Display)

### External Services
- **Telegram Bot API** - Bot functionality
- **FFmpeg** - Audio compression (system dependency)

## 🏗 Architecture

```
┌─────────────────┐
│  Telegram Bot   │
│  (bot.js)       │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Express Server │
│  (server.js)    │
└────────┬────────┘
         │
    ┌────┴────┐
    ▼         ▼
┌────────┐ ┌────────┐
│ SQLite │ │ Uploads│
│  DB    │ │ Folder │
└────────┘ └────────┘
         │
         ▼
┌─────────────────┐
│  Web Dashboard │
│  (index.html)  │
└─────────────────┘
```

## 📦 Installation

### Prerequisites
- Node.js (v18 or higher)
- npm or yarn
- FFmpeg (for audio compression)
- Git

### Step 1: Clone Repository
```bash
git clone <repository-url>
cd jsonERP
```

### Step 2: Install Dependencies
```bash
npm install
```

### Step 3: Install FFmpeg

**Windows:**
1. Download FFmpeg from https://ffmpeg.org/download.html
2. Extract and add `ffmpeg.exe` to project root or system PATH

**Linux:**
```bash
sudo apt-get install ffmpeg
```

**macOS:**
```bash
brew install ffmpeg
```

### Step 4: Create Environment File
Create a `.env` file in the project root:
```env
BOT_TOKEN=your_telegram_bot_token
ADMIN_PASSWORD=your_admin_password
PORT=3000
```

### Step 5: Create Upload Directories
```bash
mkdir -p uploads/photos
mkdir -p uploads/voice
```

### Step 6: Start Server
```bash
npm start
```

The server will start on `http://localhost:3000`

## ⚙️ Configuration

### Environment Variables

| Variable | Description | Required | Default |
|----------|-------------|----------|---------|
| `BOT_TOKEN` | Telegram Bot Token from BotFather | Yes | - |
| `ADMIN_PASSWORD` | Password for web dashboard | Yes | - |
| `PORT` | Server port | No | 3000 |

### Getting Telegram Bot Token

1. Open Telegram and search for @BotFather
2. Send `/newbot`
3. Follow instructions to create your bot
4. Copy the bot token provided
5. Add to `.env` file

### Setting Up Webhook (Optional for Production)

For production hosting, set up a webhook instead of polling:

```javascript
// In bot.js, replace polling with:
const webhookUrl = 'https://your-domain.com/bot';
bot.setWebHook(webhookUrl);
```

## 🗄 Database Schema

### Tables

#### employees
```sql
CREATE TABLE employees (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  telegram_id TEXT UNIQUE NOT NULL,
  full_name TEXT NOT NULL,
  phone TEXT,
  telegram_username TEXT,
  is_active BOOLEAN DEFAULT 1,
  open_task_id INTEGER,
  FOREIGN KEY (open_task_id) REFERENCES tasks(id)
);
```

#### tasks
```sql
CREATE TABLE tasks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  employee_id INTEGER NOT NULL,
  status TEXT DEFAULT 'unread',
  note_text TEXT,
  accountant_note TEXT,
  amount REAL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  archived_at DATETIME,
  FOREIGN KEY (employee_id) REFERENCES employees(id)
);
```

#### task_photos
```sql
CREATE TABLE task_photos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  task_id INTEGER NOT NULL,
  file_path TEXT NOT NULL,
  file_id TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (task_id) REFERENCES tasks(id)
);
```

#### task_voices
```sql
CREATE TABLE task_voices (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  task_id INTEGER NOT NULL,
  file_path TEXT NOT NULL,
  duration_seconds INTEGER,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (task_id) REFERENCES tasks(id)
);
```

## 🔌 API Endpoints

### Authentication
- `POST /login` - Login to dashboard
  - Body: `{ "password": "your_password" }`
  - Response: Sets session cookie

### Tasks
- `GET /api/tasks` - Get all tasks with pagination and filters
  - Query params: `page`, `limit`, `status`, `employee`, `dateFrom`, `dateTo`, `search`
- `GET /api/tasks/:id` - Get single task details
- `PATCH /api/tasks/:id` - Update task
  - Body: `{ "status": "done", "accountant_note": "...", "amount": 100 }`

### Employees
- `GET /api/employees` - Get all employees
- `POST /api/employees` - Register new employee (via Telegram)

### Files
- `GET /uploads/photos/:filename` - Serve photo files
- `GET /uploads/voice/:filename` - Serve voice files

## 🤖 Telegram Bot Setup

### Bot Commands
The bot uses inline keyboards and message handlers instead of text commands:

#### Message Handlers
- **Text Messages:** Added as notes to current task
- **Photos:** Compressed and added to current task
- **Voice Notes:** Compressed and added to current task
- **Contact Messages:** Used for employee registration

#### Inline Keyboards
- **Main Menu:** Start Report, My Reports, Help
- **Report Actions:** Finish Report, Add Photo, Add Voice, Cancel
- **Confirmation:** Yes/No for report submission

### Employee Registration Flow
1. User sends `/start` or contacts the bot
2. Bot requests phone number
3. User shares contact
4. Employee record created/updated
5. User can start sending reports

### Report Submission Flow
1. User sends "Start Report"
2. Task created with status 'unread'
3. User adds photos/voices/text
4. User clicks "Finish Report"
5. Task status changes to 'received'
6. Accountant receives notification

## 🚀 Deployment

### Quick Start with Ngrok (Development/Testing)

#### Step 1: Install Ngrok

**Windows:**
1. Download ngrok from https://ngrok.com/download
2. Extract the zip file
3. Move `ngrok.exe` to a folder in your PATH or project root
4. Verify installation: `ngrok version`

**Linux/Mac:**
```bash
# Using Homebrew (Mac)
brew install ngrok

# Or download from https://ngrok.com/download
# Extract and move to /usr/local/bin
```

#### Step 2: Sign Up and Authenticate
1. Go to https://ngrok.com/signup
2. Create free account
3. Get your authtoken from dashboard
4. Authenticate:
```bash
ngrok config add-authtoken YOUR_AUTH_TOKEN
```

#### Step 3: Start Your Server
```bash
# In one terminal
cd jsonERP
node server.js
```

#### Step 4: Start Ngrok
```bash
# In another terminal
ngrok http 3000
```

Ngrok will provide a URL like: `https://xxxx-xx-xx-xx-xx.ngrok-free.app`

#### Step 5: Set Telegram Webhook
```bash
# Replace YOUR_BOT_TOKEN and NGROK_URL
curl -F "url=https://your-ngrok-url.ngrok-free.app/bot" \
  https://api.telegram.org/botYOUR_BOT_TOKEN/setWebhook
```

#### Step 6: Update .env File
Add webhook URL to your `.env` file:
```env
BOT_TOKEN=your_telegram_bot_token
DASHBOARD_PASSWORD=your_admin_password
PORT=3000
WEBHOOK_URL=https://your-ngrok-url.ngrok-free.app/bot
```

**Note:** The code has been updated to automatically switch between polling and webhook based on the WEBHOOK_URL environment variable. No code changes needed!

#### Step 7: Test
- Access dashboard: `https://your-ngrok-url.ngrok-free.app`
- Test Telegram bot
- Check ngrok dashboard for traffic

**Important Notes:**
- Free ngrok URL changes on restart
- Free tier has rate limits
- Use for testing only, not production
- Consider paid ngrok or hosting for production

### Free Hosting Options

#### 1. Render (Recommended)
- **Backend:** Render.com
- **Database:** Render SQLite (or upgrade to PostgreSQL)
- **Steps:**
  1. Create account at render.com
  2. Connect GitHub repository
  3. Select "Web Service"
  4. Set build command: `npm install`
  5. Set start command: `node server.js`
  6. Add environment variables
  7. Deploy

#### 2. Railway
- **Backend:** Railway.app
- **Steps:**
  1. Create account at railway.app
  2. New Project → Deploy from GitHub
  3. Add environment variables
  4. Deploy

#### 3. Fly.io
- **Backend:** Fly.io
- **Steps:**
  1. Install Fly CLI: `curl -L https://fly.io/install.sh | sh`
  2. Login: `fly auth login`
  3. Initialize: `fly launch`
  4. Set environment variables
  5. Deploy: `fly deploy`

#### 4. Heroku (Free Tier Limited)
- **Backend:** Heroku
- **Steps:**
  1. Install Heroku CLI
  2. Login: `heroku login`
  3. Create app: `heroku create your-app-name`
  4. Set variables: `heroku config:set BOT_TOKEN=xxx ADMIN_PASSWORD=xxx`
  5. Deploy: `git push heroku main`

### Production Checklist
- [ ] Set strong admin password
- [ ] Use HTTPS (SSL certificate)
- [ ] Set up webhook instead of polling
- [ ] Configure regular database backups
- [ ] Monitor server logs
- [ ] Set up error tracking (Sentry, etc.)
- [ ] Test all features in production
- [ ] Configure domain name

### Docker Deployment (Optional)

Create `Dockerfile`:
```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install --production
COPY . .
RUN apk add --no-cache ffmpeg
EXPOSE 3000
CMD ["node", "server.js"]
```

Create `docker-compose.yml`:
```yaml
version: '3'
services:
  app:
    build: .
    ports:
      - "3000:3000"
    environment:
      - BOT_TOKEN=${BOT_TOKEN}
      - ADMIN_PASSWORD=${ADMIN_PASSWORD}
    volumes:
      - ./uploads:/app/uploads
      - ./database:/app/database
```

Deploy:
```bash
docker-compose up -d
```

## 📖 Usage Guide

### For Employees

#### Starting a Report
1. Open Telegram and find your bot
2. Send `/start` or tap the menu button
3. Tap "Start Report" (ابدأ التقرير / Commencer le rapport)
4. Send photos, voice notes, or text
5. Tap "Finish Report" (إنهاء التقرير / Terminer le rapport)

#### Adding Multiple Files
- Send multiple photos - they'll all be added to the same report
- Record multiple voice notes - they'll all be added
- Add text notes at any time
- Only click "Finish Report" when done

#### Viewing Reports
- Tap "My Reports" (تقاريري / Mes rapports)
- See status of each report
- View accountant notes and amounts

### For Accountants

#### Accessing Dashboard
1. Open browser to `http://your-domain.com`
2. Enter admin password
3. Dashboard loads with all pending tasks

#### Managing Tasks
1. **View Task:** Click any task card to see details
2. **Change Status:** Use dropdown to change status
   - Pending (قيد الانتظار) → Received (مستلم)
   - Received → Reviewing (قيد المراجعة)
   - Reviewing → Done (مكتمل)
3. **Add Note:** Write accountant notes
4. **Set Amount:** Enter amount in Dzd
5. **Save:** Click "Save Changes"

#### Filtering Tasks
- Use search bar to find by name/phone
- Filter by employee from dropdown
- Filter by status (All, Pending, Received, Reviewing, Done)
- Filter by date range
- Status buttons for quick filtering

#### Archiving Tasks
- Tasks marked as "Done" are automatically archived after 30 days
- View archived tasks in "Archived" tab
- Archived tasks cannot be modified

## 🌍 Multi-Language Support

### Supported Languages
- **Arabic (العربية)** - RTL layout
- **French (Français)** - LTR layout
- **English** - LTR layout

### Language Features
- Automatic RTL/LTR switching
- Localized date/time formats
- Translated UI elements
- Language selector in header
- Persistent language preference

### Adding New Languages
Edit `public/index.html` translations object:
```javascript
const translations = {
  en: { /* English */ },
  fr: { /* French */ },
  ar: { /* Arabic */ },
  es: { /* Add Spanish */ }
};
```

## 🔧 Troubleshooting

### Common Issues

#### Bot Not Responding
- Check bot token is correct
- Verify bot is running: Check logs
- Ensure only one bot instance is running
- Check internet connection

#### Photo Upload Errors
- Verify FFmpeg is installed
- Check upload directory permissions
- Ensure sufficient disk space
- Check file size limits

#### Voice Upload Errors
- Verify FFmpeg is installed and in PATH
- Check audio format compatibility
- Ensure upload directory exists

#### Database Errors
- Check database file permissions
- Verify SQLite is working
- Check foreign key constraints
- Ensure employee exists before creating tasks

#### Duplicate Records
- Check duplicate prevention logic
- Verify file_id uniqueness
- Check cleanup job isn't deleting active tasks

#### Notification Not Working
- Check browser notification permissions
- Verify Web Audio API support
- Check notification sound settings
- Ensure polling interval is correct

### Log Monitoring
```bash
# View logs
node server.js

# Check for errors
grep "Error" logs.txt

# Monitor bot activity
grep "Telegram" logs.txt
```

### Performance Optimization
- Compress images before upload
- Use CDN for static files
- Implement database indexing
- Cache frequently accessed data
- Use pagination for large datasets

## 📝 License

This project is proprietary software. All rights reserved.

## 🤝 Support

For support and issues:
- Check troubleshooting section
- Review logs for error messages
- Verify configuration settings
- Test in development environment first

## 🔄 Version History

### Current Version: 1.0.0
- Initial release
- Multi-language support (AR/FR/EN)
- Real-time notifications
- Duplicate prevention
- Auto-cleanup of empty tasks
- Multi-user concurrent support
- Responsive design
- Photo and voice compression
- Task management workflow
- Archive system

---

**Last Updated:** 2026-07-05
**Maintained By:** CHAOS ERP Team
