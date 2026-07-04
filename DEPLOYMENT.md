# Deployment Guide - CHAOS ERP

## Prerequisites
- Node.js 18+ installed
- Git
- Domain name (optional but recommended)
- Telegram Bot Token (already have in .env)

## Hosting Options

### Option 1: Render (Free Tier - Recommended)
1. Create account at [render.com](https://render.com)
2. Create a new Web Service
3. Connect your GitHub repository
4. Configure:
   - **Build Command**: `npm install`
   - **Start Command**: `node server.js`
   - **Environment Variables**: Add all variables from your .env file
5. Deploy

### Option 2: Railway (Free Tier)
1. Create account at [railway.app](https://railway.app)
2. Click "New Project" → "Deploy from GitHub repo"
3. Select your repository
4. Add environment variables from .env
5. Deploy

### Option 3: DigitalOcean VPS ($4-6/month)
1. Create Ubuntu droplet (1GB RAM minimum)
2. SSH into server: `ssh root@your-server-ip`
3. Install Node.js:
   ```bash
   curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
   sudo apt-get install -y nodejs
   ```
4. Clone your repository
5. Install dependencies: `npm install`
6. Install PM2 for process management:
   ```bash
   npm install -g pm2
   ```
7. Start with PM2:
   ```bash
   pm2 start server.js --name chaos-erp
   pm2 save
   pm2 startup
   ```
8. Setup Nginx reverse proxy (optional but recommended)
9. Setup SSL with Let's Encrypt (optional)

### Option 4: VPS (Any provider)
Same as DigitalOcean, just use your preferred VPS provider.

## Environment Variables Required
Copy these to your hosting platform's environment settings:
```
BOT_TOKEN=your_telegram_bot_token
DASHBOARD_PASSWORD=your_secure_password
PORT=3000
```

## Database
The application uses SQLite (better-sqlite3) which stores data in `db.sqlite`.
- For production, ensure the `db.sqlite` file is persisted
- On Render/Railway, use a disk mount or consider migrating to PostgreSQL for better scalability

## File Uploads
- Photos are stored in `uploads/photos/`
- Voice notes are stored in `uploads/voice/`
- Ensure these directories are created and writable
- For production, consider using cloud storage (AWS S3, Cloudinary) for better performance and scalability

## Security Recommendations
1. Use a strong DASHBOARD_PASSWORD
2. Enable HTTPS (SSL/TLS)
3. Use a firewall to restrict access
4. Keep dependencies updated
5. Regular backups of db.sqlite

## Domain Setup (Optional)
If you have a domain:
1. Point your domain A record to your server IP
2. Setup Nginx reverse proxy
3. Install SSL certificate with Let's Encrypt

## Testing After Deployment
1. Access dashboard at your domain/URL
2. Test login with your password
3. Send a message to your Telegram bot
4. Verify it appears in the dashboard

## Troubleshooting
- **Bot not responding**: Check BOT_TOKEN is correct and bot is running
- **Dashboard not loading**: Check PORT is correct and server is running
- **Uploads failing**: Ensure uploads directory exists and is writable
- **Database errors**: Ensure db.sqlite file exists and has proper permissions

## Monitoring
- Use PM2 logs: `pm2 logs chaos-erp`
- Check server resources: CPU, RAM, disk space
- Monitor Telegram bot API rate limits
