import express from 'express';
import session from 'express-session';
import passport from 'passport';
import { Strategy as LocalStrategy } from 'passport-local';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import pgSession from 'connect-pg-simple';
import bcrypt from 'bcryptjs';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import crypto from 'crypto';
import pool from './db.js';
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import jwt from 'jsonwebtoken';

dotenv.config();

/** Supabase PostgREST uses this JWT so RLS policies see auth.uid() = sub (Passport user id). */
function mintSupabaseAccessToken(userId) {
  const secret = process.env.SUPABASE_JWT_SECRET;
  if (!secret) return null;
  const now = Math.floor(Date.now() / 1000);
  return jwt.sign(
    {
      sub: userId,
      role: 'authenticated',
      aud: 'authenticated',
      iss: process.env.SUPABASE_JWT_ISS || 'supabase',
      iat: now,
      exp: now + 60 * 60 * 24,
    },
    secret,
    { algorithm: 'HS256' }
  );
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const pgStore = pgSession(session);
const app = express();

// Required when running behind Dokploy's Traefik reverse proxy.
// Without this Express won't see the HTTPS connection and secure cookies won't be set.
app.set('trust proxy', 1);

// Reuse the main pool for sessions — it already has the correct SSL config for production.

app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:8080',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

app.use(session({
  store: new pgStore({ pool: pool, tableName: 'session' }),
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
    secure: process.env.NODE_ENV === 'production',
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax'
  }
}));

app.use(passport.initialize());
app.use(passport.session());

// Configure multer storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 } // 5MB limit
});

// Serve uploads folder as static
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// --- Passport Local Strategy ---
passport.use(new LocalStrategy({ usernameField: 'email' }, async (email, password, done) => {
  try {
    const emailLower = email.toLowerCase();
    console.log('Login attempt for:', emailLower);

    const { rows } = await pool.query('SELECT * FROM public.users WHERE LOWER(email) = $1', [emailLower]);
    const user = rows[0];
    console.log('User found in public.users:', user ? 'Yes' : 'No');

    // If no user found in public.users, check if it's a staff member
    if (!user) {
      const { rows: staffRows } = await pool.query(
        'SELECT * FROM public.staff_members WHERE LOWER(system_email) = $1 AND is_active = true',
        [emailLower]
      );
      const staff = staffRows[0];
      console.log('Staff found in public.staff_members:', staff ? 'Yes' : 'No');

      if (staff) {
        console.log('Provided password:', password);
        console.log('Expected password:', `bn_${staff.pin_code}`);
        if (password === `bn_${staff.pin_code}`) {
          return done(null, { id: staff.id, email: staff.system_email, isStaff: true });
        }
      }
      return done(null, false, { message: 'Incorrect email or PIN.' });
    }

    // If user exists, check if it's a staff member (synced from auth.users or legacy)
    if (!user.password_hash) {
      const { rows: staffRows } = await pool.query(
        'SELECT * FROM public.staff_members WHERE LOWER(system_email) = $1 AND is_active = true',
        [emailLower]
      );
      const staff = staffRows[0];
      console.log('Staff found for synced user:', staff ? 'Yes' : 'No');

      if (staff && password === `bn_${staff.pin_code}`) {
        return done(null, { ...user, isStaff: true });
      }
      return done(null, false, { message: 'Use Google Login or check your PIN.' });
    }

    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) return done(null, false, { message: 'Incorrect password.' });

    return done(null, user);
  } catch (err) {
    console.error('Passport Strategy Error:', err);
    return done(err);
  }
}));

// --- Passport Google Strategy ---
console.log('Google OAuth Config:', { 
  hasClientId: !!process.env.GOOGLE_CLIENT_ID, 
  clientId: process.env.GOOGLE_CLIENT_ID?.substring(0, 20) + '...',
  isPlaceholder: process.env.GOOGLE_CLIENT_ID === 'PLACEHOLDER_GOOGLE_CLIENT_ID'
});

if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_ID !== 'PLACEHOLDER_GOOGLE_CLIENT_ID') {
  console.log('Initializing Google OAuth strategy...');
  passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: "/auth/google/callback"
  }, async (accessToken, refreshToken, profile, done) => {
    try {
      const email = profile.emails[0].value;
      const { rows } = await pool.query('SELECT * FROM public.users WHERE google_id = $1 OR email = $2', [profile.id, email]);
      let user = rows[0];

      if (!user) {
        // Create new user
        const { rows: newUsers } = await pool.query(
          'INSERT INTO public.users (email, google_id) VALUES ($1, $2) RETURNING *',
          [email, profile.id]
        );
        user = newUsers[0];

        // Create profile — new users start as pending until admin approves
        await pool.query(
          'INSERT INTO public.profiles (user_id, full_name, role, account_status) VALUES ($1, $2, $3, $4)',
          [user.id, profile.displayName, 'owner', 'pending']
        );
      } else if (!user.google_id) {
        // Link google account
        const { rows: updatedUsers } = await pool.query(
          'UPDATE public.users SET google_id = $1 WHERE id = $2 RETURNING *',
          [profile.id, user.id]
        );
        user = updatedUsers[0];
      }

      return done(null, user);
    } catch (err) {
      console.error('Error in Google OAuth strategy:', err);
        
      // If there's a foreign key violation, try to create the profile separately
      if (err.code === '23503') { // Foreign key violation
        console.log('Foreign key violation detected. User might exist without profile.');
          
        // Try to find the user and create profile separately
        const email = profile.emails[0].value;
        const { rows: existingUsers } = await pool.query(
          'SELECT * FROM public.users WHERE google_id = $1 OR email = $2', 
          [profile.id, email]
        );
          
        if (existingUsers.length > 0) {
          const existingUser = existingUsers[0];
          console.log('Found existing user, checking profile...');
            
          const { rows: existingProfiles } = await pool.query(
            'SELECT * FROM public.profiles WHERE user_id = $1',
            [existingUser.id]
          );
            
          if (existingProfiles.length === 0) {
            console.log('Creating missing profile for existing user...');
            try {
              await pool.query(
                'INSERT INTO public.profiles (user_id, full_name, role, account_status) VALUES ($1, $2, $3, $4)',
                [existingUser.id, profile.displayName, 'owner', 'pending']
              );
              console.log('Profile created successfully');
            } catch (profileErr) {
              console.error('Still failed to create profile:', profileErr);
            }
          }
            
          return done(null, existingUser);
        }
      }
        
      return done(err);
    }
  }));
}

passport.serializeUser((user, done) => done(null, user.id));
passport.deserializeUser(async (id, done) => {
  try {
    console.log('Deserializing user from session:', id);
    
    // Test database connection first
    try {
      await pool.query('SELECT NOW()');
      console.log('Database connection OK');
    } catch (dbErr) {
      console.error('Database connection failed during deserialize:', dbErr.message);
      throw dbErr;
    }
    
    const { rows } = await pool.query(`
      SELECT u.*, p.is_admin, p.account_status, p.role as profile_role, p.full_name
      FROM public.users u
      LEFT JOIN public.profiles p ON u.id = p.user_id
      WHERE u.id = $1
    `, [id]);
    let user = rows[0];

    if (!user) {
      console.log('User not found in users table, checking staff_members...');
      const { rows: staffRows } = await pool.query('SELECT * FROM public.staff_members WHERE id = $1', [id]);
      user = staffRows[0];
      if (user) {
        user.email = user.system_email;
        user.isStaff = true;
        console.log('Found staff member:', user.id);
      } else {
        console.log('User not found in staff_members either');
      }
    } else {
      console.log('Found user:', user.id, user.email);
    }

    if (!user) {
      console.warn('No user found for session, clearing session');
      return done(null, false); // User doesn't exist, clear session
    }

    done(null, user);
  } catch (err) {
    console.error('Error deserializing user:', err);
    done(err);
  }
});

// Admin Middleware
const isAdmin = (req, res, next) => {
  if (req.user && req.user.is_admin) {
    next();
  } else {
    res.status(403).json({ error: 'Admin access required' });
  }
};

// --- Auth Routes ---

app.post('/auth/register', async (req, res) => {
  const { email, password, fullName } = req.body;
  if (!email || !password || !fullName) {
    return res.status(400).json({ error: 'All fields are required' });
  }

  console.log('Registration attempt for:', email, 'Name:', fullName);
  try {
    console.log('Hashing password...');
    const salt = await bcrypt.genSalt(10);
    const hash = await bcrypt.hash(password, salt);

    console.log('Inserting into public.users...');
    const { rows } = await pool.query(
      'INSERT INTO public.users (email, password_hash) VALUES ($1, $2) RETURNING *',
      [email, hash]
    );
    const user = rows[0];
    console.log('User created with ID:', user.id);

    console.log('Inserting into public.profiles...');
    await pool.query(
      'INSERT INTO public.profiles (user_id, full_name, role, account_status) VALUES ($1, $2, $3, $4)',
      [user.id, fullName, 'owner', 'pending']
    );
    console.log('Profile created.');

    console.log('Logging in user...');
    req.login(user, (err) => {
      if (err) {
        console.error('Registration login error:', err);
        return res.status(500).json({ error: err.message });
      }
      req.session.save((saveErr) => {
        if (saveErr) {
          console.error('Registration session save error:', saveErr);
          return res.status(500).json({ error: 'Failed to save session' });
        }
        console.log('Registration login and session saved successfully.');
        res.json({ user });
      });
    });
  } catch (err) {
    console.error('Registration error details:', err);
    res.status(500).json({ error: err.message });
  }
});

app.post('/auth/login', (req, res, next) => {
  passport.authenticate('local', (err, user, info) => {
    if (err) return next(err);
    if (!user) return res.status(401).json({ error: info.message });
    req.login(user, (err) => {
      if (err) return next(err);
      // Explicitly save session before responding
      req.session.save((saveErr) => {
        if (saveErr) {
          console.error('Session save error:', saveErr);
          return res.status(500).json({ error: 'Failed to save session' });
        }
        console.log('=== LOGIN SUCCESSFUL ===');
        console.log('User ID:', user.id);
        console.log('Session ID:', req.sessionID);
        console.log('Session saved. Passport user:', req.user ? req.user.id : 'NONE');
        console.log('========================');
        res.json({ user });
      });
    });
  })(req, res, next);
});

app.get('/auth/google', passport.authenticate('google', { scope: ['profile', 'email'] }));
app.get('/auth/google/callback', passport.authenticate('google', { failureRedirect: '/auth' }), (req, res) => {
  console.log('Google OAuth successful, redirecting to frontend...');
  res.redirect(process.env.FRONTEND_URL || 'http://localhost:8080');
});

// Clear orphaned sessions (for debugging)
app.post('/auth/clear-session', (req, res) => {
  if (req.session) {
    req.session.destroy((err) => {
      if (err) {
        console.error('Error clearing session:', err);
        return res.status(500).json({ error: 'Failed to clear session' });
      }
      console.log('Session cleared successfully');
      res.clearCookie('connect.sid');
      res.json({ success: true });
    });
  } else {
    res.json({ success: true, message: 'No session to clear' });
  }
});

app.get('/auth/me', async (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'Not authenticated' });
  
  if (req.user.isStaff) {
    return res.json({ 
      user: req.user, 
      profile: {
        ...req.user,
        // Map staff role for ProtectedRoute compatibility
        role: req.user.role || 'service',
        account_status: 'approved',
        onboarding_completed: true,
        is_admin: false
      } 
    });
  }

  const { rows } = await pool.query('SELECT * FROM public.profiles WHERE user_id = $1', [req.user.id]);
  res.json({ user: req.user, profile: rows[0] });
});

// Bridge Passport session → Supabase client: RLS policies use auth.uid() = JWT sub
app.get('/auth/supabase-token', (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'Not authenticated' });
  const access_token = mintSupabaseAccessToken(req.user.id);
  if (!access_token) {
    console.warn('SUPABASE_JWT_SECRET is not set; browser Supabase queries will fail RLS checks.');
    return res.status(503).json({ error: 'SUPABASE_JWT_SECRET not configured on server' });
  }
  res.json({ access_token });
});

// Outlets — use Postgres directly so the browser does not depend on reaching Supabase REST (avoids "Failed to fetch")
app.get('/api/outlets', async (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'Not authenticated' });
  try {
    if (req.user.isStaff) {
      const { rows } = await pool.query(
        `SELECT o.id, o.name, o.address, o.phone, o.is_active, o.created_at
         FROM public.outlets o
         INNER JOIN public.staff_outlet_assignments a ON a.outlet_id = o.id
         WHERE a.user_id = $1
         ORDER BY o.created_at DESC`,
        [req.user.id]
      );
      return res.json({ outlets: rows });
    }
    const { rows } = await pool.query(
      `SELECT id, name, address, phone, is_active, created_at
       FROM public.outlets
       WHERE owner_id = $1
       ORDER BY created_at DESC`,
      [req.user.id]
    );
    res.json({ outlets: rows });
  } catch (err) {
    console.error('GET /api/outlets:', err);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/outlets', async (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'Not authenticated' });
  if (req.user.isStaff) return res.status(403).json({ error: 'Only owners can create outlets' });
  const { name, address, phone } = req.body || {};
  if (!name || !String(name).trim()) {
    return res.status(400).json({ error: 'Outlet name is required' });
  }
  try {
    const { rows } = await pool.query(
      `INSERT INTO public.outlets (owner_id, name, address, phone)
       VALUES ($1, $2, $3, $4)
       RETURNING id, name, address, phone, is_active, created_at`,
      [req.user.id, name.trim(), address ? String(address).trim() || null : null, phone ? String(phone).trim() || null : null]
    );
    res.status(201).json({ outlet: rows[0] });
  } catch (err) {
    console.error('POST /api/outlets:', err);
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/outlets/:id', async (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'Not authenticated' });
  if (req.user.isStaff) return res.status(403).json({ error: 'Only owners can delete outlets' });
  const { id } = req.params;
  try {
    const { rowCount } = await pool.query(
      'DELETE FROM public.outlets WHERE id = $1 AND owner_id = $2',
      [id, req.user.id]
    );
    if (rowCount === 0) {
      return res.status(404).json({ error: 'Outlet not found or access denied' });
    }
    res.json({ success: true });
  } catch (err) {
    console.error('DELETE /api/outlets:', err);
    res.status(500).json({ error: err.message });
  }
});

// Complete onboarding — sets business info, creates first outlet, marks onboarding_completed = true
app.post('/api/onboarding/complete', async (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'Not authenticated' });
  const { business_type, brand_name, ordering_slug, phone, city } = req.body;
  try {
    await pool.query(
      `UPDATE public.profiles
       SET business_type = $1, brand_name = $2, ordering_slug = $3, phone = COALESCE($4, phone),
           onboarding_completed = true
       WHERE user_id = $5`,
      [business_type || null, brand_name || null, ordering_slug || null, phone || null, req.user.id]
    );
    if (brand_name) {
      await pool.query(
        'INSERT INTO public.outlets (name, phone, address, owner_id) VALUES ($1, $2, $3, $4)',
        [brand_name.trim(), phone || null, city || null, req.user.id]
      );
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Skip onboarding — marks onboarding_completed = true without business details
app.post('/api/onboarding/skip', async (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'Not authenticated' });
  try {
    await pool.query(
      'UPDATE public.profiles SET onboarding_completed = true WHERE user_id = $1',
      [req.user.id]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/subscription', async (req, res) => {
  console.log('=== SUBSCRIPTION REQUEST ===');
  console.log('Session ID:', req.sessionID);
  console.log('Session exists:', !!req.session);
  console.log('User in session:', req.user ? req.user.id : 'NOT AUTHENTICATED');
  console.log('Session data:', JSON.stringify(req.session, null, 2));
  console.log('Cookies:', req.cookies);
  console.log('========================');
  
  if (!req.user) {
    console.log('No user in session - returning 401');
    return res.status(401).json({ error: 'Not authenticated' });
  }
  
  try {
    const { rows } = await pool.query(
      "SELECT * FROM public.subscriptions WHERE user_id = $1 AND status IN ('active', 'trialing', 'past_due') ORDER BY created_at DESC LIMIT 1",
      [req.user.id]
    );
    console.log('Subscription found:', rows[0] ? 'Yes' : 'No');
    res.json(rows[0] || null);
  } catch (err) {
    console.error('Subscription fetch error:', err);
    res.status(500).json({ error: err.message });
  }
});

// --- Admin Endpoints ---

app.get('/api/admin/accounts', isAdmin, async (req, res) => {
  try {
    const { status } = req.query;
    
    let query = `
      SELECT p.id, p.user_id, p.full_name, p.phone, p.business_type, p.role, 
             p.account_status, p.is_admin, p.onboarding_completed, p.created_at,
             u.email
      FROM public.profiles p
      JOIN public.users u ON p.user_id = u.id
      WHERE p.role = 'owner'
    `;
    
    const params = [];
    if (status && status !== 'all') {
      params.push(status);
      query += ` AND p.account_status = $${params.length}`;
    }
    
    query += ` ORDER BY p.created_at DESC`;
    
    const { rows } = await pool.query(query, params);
    res.json({ accounts: rows });
  } catch (err) {
    console.error('Admin list accounts error:', err);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/admin/accounts/action', isAdmin, async (req, res) => {
  try {
    const { target_user_id, action } = req.body;
    if (!target_user_id || !action) {
      return res.status(400).json({ error: 'target_user_id and action required' });
    }

    const newStatus = action === 'approve' ? 'approved' : 'rejected';

    await pool.query(
      'UPDATE public.profiles SET account_status = $1 WHERE user_id = $2',
      [newStatus, target_user_id]
    );

    // Send in-app notification
    const notificationData = action === 'approve'
      ? {
          title: "Account Approved! 🎉",
          message: "Your banaoo.io account has been approved. You can now choose a plan and start managing your restaurant.",
          action_url: "/select-plan",
        }
      : {
          title: "Account Application Update",
          message: "Your banaoo.io account application requires further review. Please contact connect@banaoo.in for assistance.",
          action_url: null,
        };

    await pool.query(
      'INSERT INTO public.notifications (user_id, type, title, message, action_url) VALUES ($1, $2, $3, $4, $5)',
      [target_user_id, 'subscription', notificationData.title, notificationData.message, notificationData.action_url]
    );

    res.json({ success: true, status: newStatus });
  } catch (err) {
    console.error('Admin approve account error:', err);
    res.status(500).json({ error: err.message });
  }
});

app.patch('/auth/password', async (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'Not authenticated' });
  const { password } = req.body;
  try {
    const salt = await bcrypt.genSalt(10);
    const hash = await bcrypt.hash(password, salt);
    await pool.query('UPDATE public.users SET password_hash = $1 WHERE id = $2', [hash, req.user.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/auth/logout', (req, res) => {
  req.logout((err) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ success: true });
  });
});

// --- Payment Routes ---

const BASE_PRICES = {
  starter: 999,
  professional: 2499,
};

const DISCOUNTS = {
  1: 0,
  3: 0.05,
  6: 0.10,
  12: 0.20,
};

function calcAmount(planType, months) {
  const base = BASE_PRICES[planType];
  if (!base) throw new Error(`Unknown plan: ${planType}`);
  const discount = DISCOUNTS[months] ?? 0;
  return Math.round(base * months * (1 - discount));
}

app.post('/api/payments/create-order', async (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'Not authenticated' });
  const { plan_type, period_months } = req.body;

  try {
    const KEY_ID = process.env.RAZORPAY_KEY_ID;
    const KEY_SECRET = process.env.RAZORPAY_KEY_SECRET;
    if (!KEY_ID || !KEY_SECRET) return res.status(500).json({ error: 'Razorpay credentials not configured' });

    const amountRupees = calcAmount(plan_type, period_months);
    const amountPaise = amountRupees * 100;

    const response = await fetch('https://api.razorpay.com/v1/orders', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${Buffer.from(`${KEY_ID}:${KEY_SECRET}`).toString('base64')}`,
      },
      body: JSON.stringify({
        amount: amountPaise,
        currency: 'INR',
        receipt: `sub_${req.user.id.slice(0, 8)}_${Date.now()}`,
        notes: {
          user_id: req.user.id,
          plan_type,
          period_months: String(period_months),
        },
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      return res.status(502).json({ error: `Razorpay: ${err}` });
    }

    const order = await response.json();
    res.json({
      order_id: order.id,
      amount: amountPaise,
      amount_rupees: amountRupees,
      currency: 'INR',
      key_id: KEY_ID,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/payments/verify-payment', async (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'Not authenticated' });
  const { razorpay_order_id, razorpay_payment_id, razorpay_signature, plan_type, period_months } = req.body;

  try {
    const KEY_SECRET = process.env.RAZORPAY_KEY_SECRET;
    const body = `${razorpay_order_id}|${razorpay_payment_id}`;
    const expectedSignature = crypto
      .createHmac('sha256', KEY_SECRET)
      .update(body)
      .digest('hex');

    if (expectedSignature !== razorpay_signature) {
      return res.status(400).json({ error: 'Payment verification failed' });
    }

    const expiresAt = new Date();
    expiresAt.setMonth(expiresAt.getMonth() + Number(period_months));

    await pool.query(
      `INSERT INTO public.subscriptions
       (user_id, plan_type, status, period_months, expires_at, razorpay_order_id, razorpay_payment_id, current_period_start, current_period_end, trial_ends_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       ON CONFLICT (razorpay_order_id) WHERE razorpay_order_id IS NOT NULL DO UPDATE SET
       status = EXCLUDED.status,
       expires_at = EXCLUDED.expires_at,
       razorpay_payment_id = EXCLUDED.razorpay_payment_id`,
      [req.user.id, plan_type, 'active', period_months, expiresAt, razorpay_order_id, razorpay_payment_id, new Date(), expiresAt, null]
    );

    res.json({ success: true, expires_at: expiresAt });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/payments/cancel-subscription', async (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'Not authenticated' });

  try {
    const { rows } = await pool.query(
      "SELECT * FROM public.subscriptions WHERE user_id = $1 AND status IN ('trialing', 'active') LIMIT 1",
      [req.user.id]
    );
    const subscription = rows[0];

    if (!subscription) return res.status(404).json({ error: 'No active subscription found' });

    // Optional: Add Razorpay subscription cancellation if you are using the Subscriptions API.
    // However, the migration.sql says you are using the Orders API (prepaid).
    // For prepaid, cancellation usually just means stopping auto-renewal OR marking as cancelled.

    await pool.query(
      "UPDATE public.subscriptions SET status = 'cancelled', cancelled_at = NOW() WHERE id = $1",
      [subscription.id]
    );

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 5000;
// Upload endpoint
app.post('/api/upload', (req, res) => {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  upload.single('file')(req, res, (err) => {
    if (err) {
      console.error('Upload error:', err);
      return res.status(500).json({ error: err.message });
    }

    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    // Return the relative URL so it works regardless of domain (frontend will prefix with base URL if needed)
    const fileUrl = `/uploads/${req.file.filename}`;
    res.json({ url: fileUrl });
  });
});

app.listen(PORT, () => {
console.log(`Server running on port ${PORT}`);
});
