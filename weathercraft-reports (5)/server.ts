import express from 'express';
import { createServer as createViteServer } from 'vite';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import cookieParser from 'cookie-parser';
import { v4 as uuidv4 } from 'uuid';
import axios from 'axios';
import db from './src/db';
import crypto from 'crypto';

// Ensure uploads directory exists
const uploadsDir = path.join(process.cwd(), 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir);
}

// Configure Multer
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadsDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ storage: storage });

import authRoutes from './src/auth_routes';

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());
  app.use(cookieParser());
  app.use('/uploads', express.static(uploadsDir));
  
  // Register Auth Callback Route
  app.use('/auth', authRoutes);

  // --- API Routes ---

  // Auth Middleware
  const requireAuth = (req: any, res: any, next: any) => {
    const userId = req.cookies.user_id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }
    req.user = user;
    next();
  };

  // Get Current User
  app.get('/api/me', (req, res) => {
    const userId = req.cookies.user_id;
    if (!userId) return res.json({ user: null });
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
    res.json({ user: user || null });
  });

  // Logout
  app.post('/api/logout', (req, res) => {
    res.clearCookie('user_id');
    res.json({ success: true });
  });

  // --- Plugin Verification Routes ---

  // 1. Initiate Verification (Generate Code)
  app.post('/api/auth/init', async (req, res) => {
    const { username } = req.body;
    if (!username) return res.status(400).json({ error: 'Username required' });

    try {
      // 1. Get UUID from Mojang (optional, but good for avatar preview)
      const mojangRes = await axios.get(`https://api.mojang.com/users/profiles/minecraft/${username}`);
      const { id: uuid, name: correctUsername } = mojangRes.data;

      // 2. Generate Simple Code (e.g. 6 chars)
      const code = crypto.randomBytes(3).toString('hex').toUpperCase();

      // 3. Save to DB
      let user: any = db.prepare('SELECT * FROM users WHERE minecraft_uuid = ?').get(uuid);
      
      if (!user) {
        const id = uuidv4();
        const avatar_url = `https://crafatar.com/avatars/${uuid}?size=100&overlay`;
        db.prepare(`
          INSERT INTO users (id, minecraft_uuid, username, avatar_url, verification_code, verification_expires, verified)
          VALUES (?, ?, ?, ?, ?, datetime('now', '+10 minutes'), 0)
        `).run(id, uuid, correctUsername, avatar_url, code);
        user = { id, minecraft_uuid: uuid };
      } else {
        db.prepare(`
          UPDATE users 
          SET verification_code = ?, verification_expires = datetime('now', '+10 minutes'), username = ?, verified = 0
          WHERE id = ?
        `).run(code, correctUsername, user.id);
      }

      // Return Data
      res.json({ 
        success: true, 
        uuid, 
        username: correctUsername,
        code,
        expiresIn: 600
      });

    } catch (error: any) {
      console.error(error);
      res.status(500).json({ error: 'Failed to initiate verification' });
    }
  });

  // 2. Webhook from Minecraft Server
  app.post('/api/verify', async (req, res) => {
    // Format: { "nick": "...", "uuid": "...", "code": "..." }
    const { nick, uuid, code } = req.body;
    
    console.log('Received webhook:', { nick, uuid, code });

    if (!code || !uuid) {
      return res.status(400).json({ error: 'Missing code or uuid' });
    }

    // Find user with this code
    // We check code AND uuid to be sure, or just code?
    // The code is associated with a UUID in our DB.
    // Note: UUID from plugin might be dashed or undashed. Mojang API returns undashed.
    // Let's normalize UUID (remove dashes).
    const normalizedUuid = uuid.replace(/-/g, '');

    const user: any = db.prepare('SELECT * FROM users WHERE verification_code = ?').get(code);

    if (!user) {
      return res.status(404).json({ error: 'Invalid code' });
    }

    if (new Date(user.verification_expires) < new Date()) {
      return res.status(400).json({ error: 'Code expired' });
    }

    // Verify UUID matches
    if (user.minecraft_uuid !== normalizedUuid) {
      return res.status(403).json({ error: 'UUID mismatch' });
    }

    // Mark as verified
    db.prepare('UPDATE users SET verified = 1, verification_code = NULL WHERE id = ?').run(user.id);

    console.log(`User ${nick} verified successfully!`);
    res.json({ success: true, message: 'Verified' });
  });

  // 3. Check Status (Polling)
  app.get('/api/auth/status/:uuid', (req, res) => {
    const { uuid } = req.params;
    const user: any = db.prepare('SELECT * FROM users WHERE minecraft_uuid = ?').get(uuid);

    if (!user) return res.status(404).json({ error: 'User not found' });

    if (user.verified) {
      // Set Cookie if verified
      res.cookie('user_id', user.id, { 
        httpOnly: true, 
        secure: true, 
        sameSite: 'none',
        maxAge: 30 * 24 * 60 * 60 * 1000
      });
      return res.json({ verified: true, user });
    }

    res.json({ verified: false });
  });


  // Get Reports
  app.get('/api/reports', (req, res) => {
    const reports = db.prepare(`
      SELECT reports.*, users.username as author_name 
      FROM reports 
      LEFT JOIN users ON reports.user_id = users.id 
      ORDER BY created_at DESC
    `).all();
    res.json(reports);
  });

  // Submit Report
  app.post('/api/reports', requireAuth, upload.single('photo'), (req: any, res: any) => {
    try {
      const {
        city,
        time,
        effective_until,
        type,
        clouds,
        moisture,
        act_kind,
        damage_classification,
        title
      } = req.body;

      const photo_url = req.file ? `/uploads/${req.file.filename}` : null;
      const id = uuidv4();

      db.prepare(`
        INSERT INTO reports (
          id, user_id, city, time, effective_until, type, clouds, 
          moisture, act_kind, damage_classification, photo_url, title
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        id, req.user.id, city, time, effective_until, type, clouds || null,
        moisture, act_kind, damage_classification, photo_url, title
      );

      res.json({ success: true, id });
    } catch (err: any) {
      console.error(err);
      res.status(500).json({ error: 'Failed to submit report' });
    }
  });

  // --- Vite Middleware ---
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
