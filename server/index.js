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
import fs from 'fs';
import pool from './db.js';
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';
import jwt from 'jsonwebtoken';
import { isGoogleAuthEnabled } from './load-env.js';
import { sendSubscriptionConfirmation } from './email.js';
import {
  buildEntitlementsPayload,
  calcAddonAmount,
  normalizeAddonQuantity,
  assertWithinOutletLimit,
} from './entitlements.js';
import { registerCustomerOrderRoutes } from './customer-orders.js';
import { registerBillingMobileRoutes } from './billing-mobile.js';
import { registerBillingRoutes } from './billing.js';
import { registerDashboardQuickActionRoutes } from './dashboard-quick-actions.js';
import { registerStaffRoutes } from './staff-api.js';
import { registerInventoryRoutes, warmInventorySchema } from './inventory-api.js';
import { registerShiprocketRoutes } from './shiprocket/routes.js';
import { startShiprocketJobs } from './shiprocket/jobs.js';
import { clearUnmodifiedSampleMenu } from './sample-menu.js';
import { registerCmsRoutes, registerDashboardBannerPublicRoutes, requireAdminAccess, logAdminAction, getCmsAdmin } from './admin/routes.js';
import { extractMenuItemsFromImage } from './menu-extract.js';
import { ensureNotificationsInfra } from './notifications-bootstrap.js';
import { getDefaultOperationMode } from './business-types.js';
import { CURRENT_TERMS_VERSION, extractClientIp } from './legal.js';

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
  origin: function (origin, callback) {
    // Allow requests with no origin (mobile apps, curl, etc.)
    if (!origin) return callback(null, true);

    const envOrigins = process.env.FRONTEND_URL
      ? process.env.FRONTEND_URL.split(',').map((value) => value.trim()).filter(Boolean)
      : [];
    const localDevOrigins = [
      'http://localhost:8080',
      'http://127.0.0.1:8080',
      'http://localhost:5173',
      'http://127.0.0.1:5173',
      'http://localhost:3000',
      'http://127.0.0.1:3000',
    ];
    const allowedOrigins = [...new Set([...envOrigins, ...localDevOrigins])];

    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json({ limit: '10mb' }));  // Increased for base64 image uploads
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());

app.use(session({
  store: new pgStore({ pool: pool, tableName: 'session' }),
  secret: process.env.SESSION_SECRET || 'dev-only-change-session-secret-in-env',
  resave: false,
  saveUninitialized: false,
  cookie: {
    maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
    secure: process.env.NODE_ENV === 'production',
    // 'lax' works for same-site requests (nginx proxies /auth to backend on same domain).
    // 'none' is only needed for cross-site (different domains) and breaks same-site cookies.
    sameSite: 'lax'
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

function resolveDownloadsDir() {
  const candidates = [
    path.join(__dirname, 'downloads'),
    path.join(__dirname, '../public/downloads'),
  ];
  for (const dir of candidates) {
    if (fs.existsSync(dir)) return dir;
  }
  return null;
}

const downloadsDir = resolveDownloadsDir();
if (downloadsDir) {
  app.use('/downloads', express.static(downloadsDir));
}

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
const googleAuthEnabled = isGoogleAuthEnabled();
console.log('Google OAuth Config:', {
  enabled: googleAuthEnabled,
  hasClientId: !!process.env.GOOGLE_CLIENT_ID,
  hasClientSecret: !!process.env.GOOGLE_CLIENT_SECRET,
});

if (!googleAuthEnabled) {
  console.warn(
    '[auth] Google sign-in is disabled. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in .env (see .env.example).'
  );
}

if (googleAuthEnabled) {
  console.log('Initializing Google OAuth strategy...');
  passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: "/auth/google/callback",
    // passReqToCallback exposes the Express `req` so we can read the
    // pre-redirect T&C acceptance the client stashed via /auth/google/prepare.
    passReqToCallback: true,
  }, async (req, accessToken, refreshToken, profile, done) => {
    try {
      const email = profile.emails[0].value;
      const { rows } = await pool.query('SELECT * FROM public.users WHERE google_id = $1 OR email = $2', [profile.id, email]);
      let user = rows[0];

      // Pull the acceptance that the client stashed before redirect (signup
      // tab). For login-tab Google clicks this is undefined — we treat that
      // as implicit acceptance (`oauth-implicit`) so we never end up with a
      // NULL row that would block the new user.
      const pending = req?.session?.pending_terms;
      if (req?.session) delete req.session.pending_terms;

      if (!user) {
        const { rows: newUsers } = await pool.query(
          'INSERT INTO public.users (email, google_id) VALUES ($1, $2) RETURNING *',
          [email, profile.id]
        );
        user = newUsers[0];

        // New profile — record T&C acceptance.
        await pool.query(
          `INSERT INTO public.profiles
             (user_id, full_name, role, account_status,
              terms_accepted_at, terms_version,
              terms_accepted_ip, terms_accepted_user_agent)
           VALUES ($1, $2, 'owner', 'pending', now(), $3, $4, $5)`,
          [
            user.id,
            profile.displayName,
            pending?.version || 'oauth-implicit',
            pending?.ip || extractClientIp(req) || null,
            pending?.user_agent || (req?.get && req.get('user-agent')) || null,
          ]
        );
      } else if (!user.google_id) {
        const { rows: updatedUsers } = await pool.query(
          'UPDATE public.users SET google_id = $1 WHERE id = $2 RETURNING *',
          [profile.id, user.id]
        );
        user = updatedUsers[0];

        // Existing user linking Google — if they never had T&C recorded,
        // backfill it now with the same implicit marker used for legacy users.
        await pool.query(
          `UPDATE public.profiles
              SET terms_accepted_at        = COALESCE(terms_accepted_at, now()),
                  terms_version            = COALESCE(terms_version, $1),
                  terms_accepted_ip        = COALESCE(terms_accepted_ip, $2),
                  terms_accepted_user_agent = COALESCE(terms_accepted_user_agent, $3)
            WHERE user_id = $4`,
          [
            pending?.version || 'oauth-implicit',
            pending?.ip || extractClientIp(req) || null,
            pending?.user_agent || (req?.get && req.get('user-agent')) || null,
            user.id,
          ]
        );
      }

      return done(null, user);
    } catch (err) {
      console.error('Error in Google OAuth strategy:', err);

      // If there's a foreign key violation, try to create the profile separately
      if (err.code === '23503') { // Foreign key violation
        console.log('Foreign key violation detected. User might exist without profile.');

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
              const pendingFallback = req?.session?.pending_terms;
              if (req?.session) delete req.session.pending_terms;
              await pool.query(
                `INSERT INTO public.profiles
                   (user_id, full_name, role, account_status,
                    terms_accepted_at, terms_version,
                    terms_accepted_ip, terms_accepted_user_agent)
                 VALUES ($1, $2, 'owner', 'pending', now(), $3, $4, $5)`,
                [
                  existingUser.id,
                  profile.displayName,
                  pendingFallback?.version || 'oauth-implicit',
                  pendingFallback?.ip || extractClientIp(req) || null,
                  pendingFallback?.user_agent || (req?.get && req.get('user-agent')) || null,
                ]
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

passport.serializeUser((user, done) => {
  if (!user || !user.id) {
    return done(new Error('Invalid user for session serialization'));
  }
  return done(null, user.id);
});
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

// Admin access: CMS session (req.session.cmsAdmin) OR legacy profiles.is_admin owner.

const requireAuth = (req, res, next) => {
  if (!req.user) return res.status(401).json({ error: 'Not authenticated' });
  return next();
};

function generateAffiliateReferralCode(name = 'AFF') {
  const base = String(name || 'AFF').replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(0, 5) || 'AFF';
  const random = Math.random().toString(36).slice(2, 7).toUpperCase();
  return `${base}${random}`;
}

// --- Auth Routes ---

app.post('/auth/register', async (req, res) => {
  const { email, password, fullName, phone, terms_version } = req.body;
  if (!email || !password || !fullName || !phone) {
    return res.status(400).json({ error: 'All fields are required' });
  }

  const phoneRegex = /^[+]?[\d\s-]{10,}$/;
  if (!phoneRegex.test(phone)) {
    return res.status(400).json({ error: 'Please enter a valid phone number (at least 10 digits)' });
  }

  // T&C acceptance is mandatory at signup. Any non-empty version string is
  // accepted so older clients keep working, but the server records the
  // current version when the client doesn't send one.
  if (terms_version === undefined || terms_version === null) {
    return res
      .status(400)
      .json({ error: 'You must accept the Terms & Policies to create an account' });
  }
  const acceptedVersion = String(terms_version || '').trim() || CURRENT_TERMS_VERSION;
  const acceptedIp = extractClientIp(req);
  const acceptedUserAgent = req.get('user-agent') || null;

  console.log('Registration attempt for:', email, 'Name:', fullName, 'Phone:', phone);
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
      `INSERT INTO public.profiles
         (user_id, full_name, phone, role, account_status,
          terms_accepted_at, terms_version,
          terms_accepted_ip, terms_accepted_user_agent)
       VALUES ($1, $2, $3, 'owner', 'pending', now(), $4, $5, $6)`,
      [user.id, fullName, phone, acceptedVersion, acceptedIp, acceptedUserAgent]
    );
    console.log('Profile created with terms acceptance v' + acceptedVersion);

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
    if (err?.code === '23505' && err?.constraint === 'users_email_key') {
      return res.status(409).json({ error: 'Email is already registered. Please sign in instead.' });
    }
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

app.get('/auth/providers', (_req, res) => {
  res.json({ google: googleAuthEnabled });
});

function rejectGoogleAuthDisabled(req, res) {
  const fallback = process.env.FRONTEND_URL || 'http://localhost:8080';
  const accept = req.headers.accept || '';
  if (accept.includes('text/html') || req.method === 'GET') {
    res.redirect(`${fallback.replace(/\/+$/, '')}/auth?mode=login&google_unavailable=1`);
    return true;
  }
  res.status(503).json({
    error: 'Google sign-in is not configured on this server',
    code: 'google_auth_disabled',
  });
  return true;
}

// Stash T&C acceptance in the session BEFORE the Google OAuth redirect, so
// the Google strategy callback can persist it onto the new profile.
app.post('/auth/google/prepare', (req, res) => {
  if (!googleAuthEnabled) {
    return res.status(503).json({
      error: 'Google sign-in is not configured on this server',
      code: 'google_auth_disabled',
    });
  }
  const { terms_version } = req.body || {};
  if (!terms_version) {
    return res.status(400).json({ error: 'Terms acceptance required' });
  }
  req.session.pending_terms = {
    version: String(terms_version).trim() || CURRENT_TERMS_VERSION,
    ip: extractClientIp(req),
    user_agent: req.get('user-agent') || null,
    accepted_at: new Date().toISOString(),
  };
  req.session.save((err) => {
    if (err) {
      console.error('Failed to save Google T&C prepare session:', err);
      return res.status(500).json({ error: 'Could not record acceptance' });
    }
    res.json({ ok: true });
  });
});

app.get('/auth/google', (req, res, next) => {
  if (!googleAuthEnabled) {
    rejectGoogleAuthDisabled(req, res);
    return;
  }
  const redirectUri = typeof req.query.redirect_uri === 'string' ? req.query.redirect_uri : '';
  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(redirectUri)) {
    req.session.oauth_redirect_uri = redirectUri;
  }
  const state = redirectUri ? Buffer.from(redirectUri, 'utf8').toString('base64url') : undefined;
  const authenticator = passport.authenticate('google', {
    scope: ['profile', 'email'],
    ...(state ? { state } : {}),
  });
  authenticator(req, res, next);
});
function finishGoogleRedirect(req, res) {
  console.log('Google OAuth successful, redirecting...');
  const fallback = process.env.FRONTEND_URL || 'http://localhost:8080';
  const state = typeof req.query.state === 'string' ? req.query.state : '';
  const redirectFromSession =
    typeof req.session?.oauth_redirect_uri === 'string' ? req.session.oauth_redirect_uri : '';
  if (req.session?.oauth_redirect_uri) delete req.session.oauth_redirect_uri;

  if (state) {
    try {
      const redirectUri = Buffer.from(state, 'base64url').toString('utf8');
      if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(redirectUri)) {
        const separator = redirectUri.includes('?') ? '&' : '?';
        res.redirect(`${redirectUri}${separator}auth=success`);
        return;
      }
    } catch (error) {
      console.warn('Invalid OAuth redirect state:', error);
    }
  }

  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(redirectFromSession)) {
    const separator = redirectFromSession.includes('?') ? '&' : '?';
    res.redirect(`${redirectFromSession}${separator}auth=success`);
    return;
  }

  res.redirect(fallback);
}

app.get('/auth/google/callback', (req, res, next) => {
  if (!googleAuthEnabled) {
    rejectGoogleAuthDisabled(req, res);
    return;
  }
  passport.authenticate('google', (err, user) => {
    if (err || !user) {
      console.error('Google callback auth failure:', err?.message || 'No user returned');
      const fallback = process.env.FRONTEND_URL || 'http://localhost:8080';
      res.redirect(`${fallback.replace(/\/+$/, '')}/auth?mode=login&google_error=1`);
      return;
    }

    req.logIn(user, (loginErr) => {
      if (loginErr) {
        console.error('Google callback session login failure:', loginErr.message);
        const fallback = process.env.FRONTEND_URL || 'http://localhost:8080';
        res.redirect(`${fallback.replace(/\/+$/, '')}/auth?mode=login&google_error=1`);
        return;
      }
      finishGoogleRedirect(req, res);
    });
  })(req, res, next);
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

app.get('/api/affiliate/me', requireAuth, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT a.*, u.email, p.full_name, p.phone
       FROM public.affiliates a
       JOIN public.users u ON u.id = a.user_id
       LEFT JOIN public.profiles p ON p.user_id = a.user_id
       WHERE a.user_id = $1
       LIMIT 1`,
      [req.user.id]
    );
    res.json({ affiliate: rows[0] || null });
  } catch (err) {
    console.error('GET /api/affiliate/me:', err);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/affiliate/apply', requireAuth, async (req, res) => {
  const {
    phone,
    business_name,
    business_type,
    reason,
    payment_details = {},
  } = req.body || {};

  try {
    const { rows: existing } = await pool.query(
      'SELECT id, status, referral_code FROM public.affiliates WHERE user_id = $1 LIMIT 1',
      [req.user.id]
    );
    if (existing[0]) {
      return res.status(409).json({ error: 'Affiliate application already exists', affiliate: existing[0] });
    }

    const { rows: profileRows } = await pool.query(
      'SELECT full_name FROM public.profiles WHERE user_id = $1 LIMIT 1',
      [req.user.id]
    );
    const fullName = profileRows[0]?.full_name || 'AFF';
    const referralCode = generateAffiliateReferralCode(fullName);

    const details = {
      ...(payment_details || {}),
      application: {
        reason: reason || null,
        business_name: business_name || null,
        business_type: business_type || null,
        contact_phone: phone || null,
      },
    };

    await pool.query(
      `INSERT INTO public.affiliates (user_id, referral_code, status, payment_details)
       VALUES ($1, $2, 'pending', $3::jsonb)`,
      [req.user.id, referralCode, JSON.stringify(details)]
    );

    if (phone || business_type) {
      await pool.query(
        `UPDATE public.profiles
         SET phone = COALESCE($1, phone),
             business_type = COALESCE($2, business_type)
         WHERE user_id = $3`,
        [phone || null, business_type || null, req.user.id]
      );
    }

    const { rows: createdRows } = await pool.query(
      'SELECT id, status, referral_code, created_at FROM public.affiliates WHERE user_id = $1 LIMIT 1',
      [req.user.id]
    );

    res.status(201).json({ success: true, affiliate: createdRows[0] });
  } catch (err) {
    console.error('POST /api/affiliate/apply:', err);
    res.status(500).json({ error: err.message });
  }
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

function getMobileApkDownloadFileName() {
  try {
    const appJsonPath = path.join(__dirname, '../mobile/app.json');
    const appJson = JSON.parse(fs.readFileSync(appJsonPath, 'utf8'));
    const version = String(appJson?.expo?.version || '0.0.0');
    const parts = version.split('.');
    const label = parts.length >= 3 ? `0.${parts[1]}${parts[2]}` : version.replace(/\./g, '');
    return `banaoo-app-V.${label}.apk`;
  } catch {
    return 'banaoo-latest.apk';
  }
}

function androidApkCandidates() {
  const versioned = getMobileApkDownloadFileName();
  return [
    path.join(__dirname, 'downloads/banaoo-latest.apk'),
    path.join(__dirname, '../public/downloads/banaoo-latest.apk'),
    path.join(__dirname, '../public/downloads', versioned),
    path.join(__dirname, '../mobile/android/app/build/outputs/apk/release', versioned),
    path.join(__dirname, '../mobile/android/app/build/outputs/apk/release/banaoo-app-v0.6.apk'),
    path.join(__dirname, '../mobile/android/app/build/outputs/apk/release/app-release.apk'),
  ];
}

function resolveAndroidApkPath() {
  for (const candidate of androidApkCandidates()) {
    if (fs.existsSync(candidate)) return candidate;
  }
  return null;
}

function getAndroidApkUrl() {
  if (process.env.ANDROID_APK_URL && process.env.ANDROID_APK_URL.trim()) {
    return process.env.ANDROID_APK_URL.trim();
  }
  // Proxied to the backend in production (nginx /api/ → Express).
  return '/api/mobile-app/apk';
}

let mobileAppLeadsTableReady = false;

async function ensureMobileAppLeadsTable() {
  if (mobileAppLeadsTableReady) return;
  await pool.query(`
    CREATE TABLE IF NOT EXISTS public.mobile_app_leads (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      email TEXT NOT NULL,
      phone TEXT NOT NULL,
      source TEXT NOT NULL DEFAULT 'landing_unknown',
      user_agent TEXT,
      ip_address TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_mobile_app_leads_created_at
      ON public.mobile_app_leads (created_at DESC)
  `);
  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_mobile_app_leads_email
      ON public.mobile_app_leads (email)
  `);
  mobileAppLeadsTableReady = true;
}

app.get('/api/mobile-app/apk', (req, res) => {
  const apkPath = resolveAndroidApkPath();
  if (!apkPath) {
    return res.status(404).json({ error: 'Android APK is not available yet' });
  }
  res.setHeader('Cache-Control', 'public, max-age=300');
  res.download(apkPath, getMobileApkDownloadFileName());
});

function parseBooleanEnv(value, fallback = false) {
  if (typeof value !== 'string') return fallback;
  const normalized = value.trim().toLowerCase();
  if (['1', 'true', 'yes', 'on'].includes(normalized)) return true;
  if (['0', 'false', 'no', 'off'].includes(normalized)) return false;
  return fallback;
}

app.get('/api/mobile-app/update-policy', (req, res) => {
  const minVersion = String(process.env.MOBILE_MIN_VERSION || '0.0.0').trim();
  const forceUpdate = parseBooleanEnv(process.env.MOBILE_FORCE_UPDATE, false);
  const message = String(
    process.env.MOBILE_FORCE_UPDATE_MESSAGE ||
    'A critical update is required. Please update the app to continue.'
  ).trim();

  res.setHeader('Cache-Control', 'no-store');
  const payload = {
    minVersion,
    forceUpdate,
    message,
  };

  // If an authenticated owner checks update policy and an update is forced,
  // create a single in-app notification per day so the alert appears in-app too.
  if (forceUpdate && req.user?.id) {
    void pool.query(
      `INSERT INTO public.notifications (user_id, type, title, message, action_url)
       SELECT $1, 'app_update', 'Application Update Required', $2, '/settings?tab=subscription'
       WHERE NOT EXISTS (
         SELECT 1
         FROM public.notifications
         WHERE user_id = $1
           AND type = 'app_update'
           AND created_at >= now() - interval '24 hours'
       )`,
      [req.user.id, message]
    ).catch((err) => {
      console.error('update-policy notification insert:', err.message);
    });
  }

  res.json(payload);
});

app.post('/api/mobile-app/download-request', async (req, res) => {
  const { email, phone, source } = req.body || {};
  const cleanEmail = String(email || '').trim().toLowerCase();
  const cleanPhone = String(phone || '').trim();
  const cleanSource = String(source || 'landing_unknown').trim().slice(0, 80);

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
    return res.status(400).json({ error: 'A valid email is required' });
  }
  if (!/^[+]?[0-9\s-]{10,15}$/.test(cleanPhone)) {
    return res.status(400).json({ error: 'A valid contact number is required' });
  }

  const apkPath = resolveAndroidApkPath();
  if (!apkPath) {
    return res.status(404).json({ error: 'Android APK is not available yet' });
  }

  const downloadUrl = getAndroidApkUrl();

  try {
    await ensureMobileAppLeadsTable();
    await pool.query(
      `INSERT INTO public.mobile_app_leads (email, phone, source, user_agent, ip_address)
       VALUES ($1, $2, $3, $4, $5)`,
      [
        cleanEmail,
        cleanPhone,
        cleanSource,
        String(req.headers['user-agent'] || '').slice(0, 512) || null,
        String(req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').split(',')[0].trim() || null,
      ]
    );
  } catch (err) {
    console.error('POST /api/mobile-app/download-request (lead save):', err);
    // APK download should still work even if lead capture fails.
  }

  res.json({
    success: true,
    downloadUrl,
  });
});

/** At most one outlet per owner may be is_active; fixes legacy rows with multiple enabled. */
async function ensureSingleActiveOutlet(ownerId) {
  const { rows: activeRows } = await pool.query(
    `SELECT id FROM public.outlets
     WHERE owner_id = $1 AND is_active = true
     ORDER BY updated_at DESC NULLS LAST, created_at DESC`,
    [ownerId]
  );
  if (activeRows.length > 1) {
    const keepId = activeRows[0].id;
    await pool.query(
      `UPDATE public.outlets
       SET is_active = false, updated_at = NOW()
       WHERE owner_id = $1 AND id <> $2`,
      [ownerId, keepId]
    );
    await pool.query(
      `UPDATE public.outlets SET is_active = true, updated_at = NOW() WHERE id = $1`,
      [keepId]
    );
    return;
  }
  if (activeRows.length === 0) {
    const { rows: anyOutlet } = await pool.query(
      `SELECT id FROM public.outlets WHERE owner_id = $1 ORDER BY created_at ASC LIMIT 1`,
      [ownerId]
    );
    if (anyOutlet[0]) {
      await pool.query(
        `UPDATE public.outlets SET is_active = true, updated_at = NOW() WHERE id = $1`,
        [anyOutlet[0].id]
      );
    }
  }
}

// Outlets — use Postgres directly so the browser does not depend on reaching Supabase REST (avoids "Failed to fetch")
app.get('/api/outlets', async (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'Not authenticated' });
  try {
    if (req.user.isStaff) {
      const { rows } = await pool.query(
        `SELECT o.id, o.name, o.address, o.phone, o.is_active, o.latitude, o.created_at
         FROM public.outlets o
         INNER JOIN public.staff_outlet_assignments a ON a.outlet_id = o.id
         WHERE a.user_id = $1
         ORDER BY o.created_at DESC`,
        [req.user.id]
      );
      return res.json({ outlets: rows });
    }
    await ensureSingleActiveOutlet(req.user.id);
    const { rows } = await pool.query(
      `SELECT id, name, address, phone, is_active, latitude, created_at
       FROM public.outlets
       WHERE owner_id = $1
       ORDER BY is_active DESC, created_at DESC`,
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
  const { name, address, phone, operation_mode: requestedMode } = req.body || {};
  if (!name || !String(name).trim()) {
    return res.status(400).json({ error: 'Outlet name is required' });
  }
  try {
    await assertWithinOutletLimit(req.user.id);

    // If the client didn't pass operation_mode, derive it from the owner's
    // business_type so the new outlet matches the rest of their fleet.
    let operationMode = requestedMode;
    if (operationMode !== 'standard' && operationMode !== 'self_service') {
      const { rows: profileRows } = await pool.query(
        'SELECT business_type FROM public.profiles WHERE user_id = $1',
        [req.user.id]
      );
      operationMode = getDefaultOperationMode(profileRows[0]?.business_type);
    }

    const { rows: countRows } = await pool.query(
      `SELECT COUNT(*)::int AS total FROM public.outlets WHERE owner_id = $1`,
      [req.user.id]
    );
    const isFirstOutlet = (countRows[0]?.total ?? 0) === 0;

    const { rows } = await pool.query(
      `INSERT INTO public.outlets (owner_id, name, address, phone, operation_mode, is_active)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, name, address, phone, is_active, operation_mode, created_at`,
      [
        req.user.id,
        name.trim(),
        address ? String(address).trim() || null : null,
        phone ? String(phone).trim() || null : null,
        operationMode,
        isFirstOutlet,
      ]
    );
    res.status(201).json({ outlet: rows[0] });
  } catch (err) {
    if (err.code === 'OUTLET_LIMIT') {
      return res.status(err.status || 403).json({ error: err.message, code: err.code });
    }
    console.error('POST /api/outlets:', err);
    res.status(500).json({ error: err.message });
  }
});

app.patch('/api/outlets/:id/activate', async (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'Not authenticated' });
  if (req.user.isStaff) return res.status(403).json({ error: 'Only owners can enable outlets' });
  const { id } = req.params;
  const client = await pool.connect();
  try {
    const { rows: owned } = await client.query(
      `SELECT id FROM public.outlets WHERE id = $1 AND owner_id = $2`,
      [id, req.user.id]
    );
    if (!owned[0]) {
      return res.status(404).json({ error: 'Outlet not found or access denied' });
    }

    await client.query('BEGIN');
    await client.query(
      `UPDATE public.outlets SET is_active = false, updated_at = NOW() WHERE owner_id = $1`,
      [req.user.id]
    );
    const { rows } = await client.query(
      `UPDATE public.outlets
       SET is_active = true, updated_at = NOW()
       WHERE id = $1 AND owner_id = $2
       RETURNING id, name, address, phone, is_active, latitude, created_at`,
      [id, req.user.id]
    );
    await client.query('COMMIT');
    res.json({ outlet: rows[0] });
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('PATCH /api/outlets/:id/activate:', err);
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

app.delete('/api/outlets/:id', async (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'Not authenticated' });
  if (req.user.isStaff) return res.status(403).json({ error: 'Only owners can delete outlets' });
  const { id } = req.params;
  const client = await pool.connect();
  try {
    const { rows: target } = await client.query(
      `SELECT id, is_active FROM public.outlets WHERE id = $1 AND owner_id = $2`,
      [id, req.user.id]
    );
    if (!target[0]) {
      return res.status(404).json({ error: 'Outlet not found or access denied' });
    }

    await client.query('BEGIN');
    await client.query('DELETE FROM public.outlets WHERE id = $1 AND owner_id = $2', [
      id,
      req.user.id,
    ]);

    if (target[0].is_active) {
      const { rows: next } = await client.query(
        `SELECT id FROM public.outlets
         WHERE owner_id = $1
         ORDER BY created_at ASC
         LIMIT 1`,
        [req.user.id]
      );
      if (next[0]) {
        await client.query(
          `UPDATE public.outlets SET is_active = true, updated_at = NOW() WHERE id = $1`,
          [next[0].id]
        );
      }
    }

    await client.query('COMMIT');
    res.json({ success: true });
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('DELETE /api/outlets:', err);
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

// Update owner profile — handles both personal info and branding fields
app.put('/api/profile', async (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'Not authenticated' });
  const { full_name, phone, business_type, brand_name, brand_color, logo_url, app_theme } = req.body;
  if (full_name !== undefined && (!full_name || !full_name.trim())) {
    return res.status(400).json({ error: 'Full name cannot be empty' });
  }
  try {
    // Build SET clause dynamically from provided fields
    const fields = [];
    const values = [];
    let idx = 1;
    if (full_name !== undefined)  { fields.push(`full_name = $${idx++}`);   values.push(full_name.trim()); }
    if (phone !== undefined)      { fields.push(`phone = $${idx++}`);        values.push(phone?.trim() || null); }
    if (business_type !== undefined){ fields.push(`business_type = $${idx++}`); values.push(business_type || null); }
    if (brand_name !== undefined) { fields.push(`brand_name = $${idx++}`);   values.push(brand_name || null); }
    if (brand_color !== undefined){ fields.push(`brand_color = $${idx++}`);  values.push(brand_color); }
    if (logo_url !== undefined)   { fields.push(`logo_url = $${idx++}`);     values.push(logo_url); }
    if (app_theme !== undefined)  { fields.push(`app_theme = $${idx++}`);    values.push(app_theme); }
    if (req.body.upi_vpa !== undefined) { fields.push(`upi_vpa = $${idx++}`); values.push(req.body.upi_vpa?.trim() || null); }
    if (req.body.upi_display_name !== undefined) { fields.push(`upi_display_name = $${idx++}`); values.push(req.body.upi_display_name?.trim() || null); }
    if (req.body.upi_qr_url !== undefined) { fields.push(`upi_qr_url = $${idx++}`); values.push(req.body.upi_qr_url?.trim() || null); }
    if (req.body.online_payments_enabled !== undefined) { fields.push(`online_payments_enabled = $${idx++}`); values.push(!!req.body.online_payments_enabled); }

    if (fields.length === 0) return res.status(400).json({ error: 'No fields to update' });
    values.push(req.user.id);

    const { rows } = await pool.query(
      `UPDATE public.profiles SET ${fields.join(', ')} WHERE user_id = $${idx} RETURNING *`,
      values
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Profile not found' });
    res.json({ profile: rows[0] });
  } catch (err) {
    console.error('PUT /api/profile:', err);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/product-tour/dismiss', async (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'Not authenticated' });
  if (req.user.isStaff) return res.json({ ok: true });
  try {
    const { rows } = await pool.query(
      `UPDATE public.profiles
       SET product_tour_dismissed_at = COALESCE(product_tour_dismissed_at, NOW())
       WHERE user_id = $1
       RETURNING *`,
      [req.user.id]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Profile not found' });
    res.json({ profile: rows[0] });
  } catch (err) {
    console.error('POST /api/product-tour/dismiss:', err);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/product-tour/complete', async (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'Not authenticated' });
  if (req.user.isStaff) return res.json({ ok: true });
  const { module } = req.body || {};
  try {
    const { rows: existing } = await pool.query(
      'SELECT product_tour_modules FROM public.profiles WHERE user_id = $1 LIMIT 1',
      [req.user.id]
    );
    if (existing.length === 0) return res.status(404).json({ error: 'Profile not found' });

    let modules = existing[0].product_tour_modules;
    if (typeof modules === 'string') {
      try { modules = JSON.parse(modules); } catch { modules = []; }
    }
    if (!Array.isArray(modules)) modules = [];

    if (module && typeof module === 'string' && !modules.includes(module)) {
      modules = [...modules, module];
    }

    const { rows } = await pool.query(
      `UPDATE public.profiles
       SET product_tour_modules = $1::jsonb,
           product_tour_completed_at = COALESCE(product_tour_completed_at, NOW())
       WHERE user_id = $2
       RETURNING *`,
      [JSON.stringify(modules), req.user.id]
    );
    res.json({ profile: rows[0] });
  } catch (err) {
    console.error('POST /api/product-tour/complete:', err);
    res.status(500).json({ error: err.message });
  }
});

// Complete onboarding — sets business info, creates first outlet (if none exist),
// marks onboarding_completed = true. Idempotent: running it again will only
// update the profile and will NOT create another outlet.
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
      // Only seed the first outlet if the owner doesn't already have any.
      // Protects against onboarding being submitted twice (duplicate request,
      // re-entering the onboarding page after completion, etc.).
      const { rows: existing } = await pool.query(
        'SELECT id, name FROM public.outlets WHERE owner_id = $1 ORDER BY created_at ASC LIMIT 1',
        [req.user.id]
      );

      const operationMode = getDefaultOperationMode(business_type);

      let outletId;
      if (existing.length === 0) {
        const { rows: created } = await pool.query(
          `INSERT INTO public.outlets (name, phone, address, owner_id, operation_mode)
           VALUES ($1, $2, $3, $4, $5)
           RETURNING id`,
          [brand_name.trim(), phone || null, city || null, req.user.id, operationMode]
        );
        outletId = created[0]?.id;
      } else {
        // Owner already has an outlet (legacy 'My Restaurant' sample row, or
        // an earlier onboarding attempt). Update it in place instead of
        // silently creating a duplicate. Only rewrite the name if it's still
        // the default placeholder so we never overwrite a real name.
        await pool.query(
          `UPDATE public.outlets
             SET name           = CASE WHEN name = 'My Restaurant' THEN $1 ELSE name END,
                 operation_mode = $2
           WHERE id = $3`,
          [brand_name.trim(), operationMode, existing[0].id]
        );
        outletId = existing[0].id;
      }

      if (outletId) {
        await clearUnmodifiedSampleMenu(pool, outletId);
      }
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
    const payload = await buildEntitlementsPayload(req.user.id);
    console.log('Subscription found:', payload.subscription ? 'Yes' : 'No');
    res.json(payload);
  } catch (err) {
    console.error('Subscription fetch error:', err);
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/entitlements', async (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'Not authenticated' });
  try {
    const payload = await buildEntitlementsPayload(req.user.id);
    res.json(payload);
  } catch (err) {
    console.error('GET /api/entitlements:', err);
    res.status(500).json({ error: err.message });
  }
});

// --- Admin Endpoints ---

app.get('/api/admin/accounts', requireAdminAccess, async (req, res) => {
  try {
    const { status } = req.query;
    
    let query = `
      SELECT p.id, p.user_id, p.full_name, p.phone, p.business_type, p.role,
             p.account_status, p.is_admin, p.onboarding_completed, p.created_at,
             p.terms_accepted_at, p.terms_version,
             p.terms_accepted_ip, p.terms_accepted_user_agent,
             p.is_test_account, p.billing_exempt, p.complimentary_plan,
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

app.get('/api/admin/affiliates', requireAdminAccess, async (req, res) => {
  try {
    const status = String(req.query.status || 'all').toLowerCase();
    const values = [];
    let whereSql = '';
    if (status !== 'all') {
      values.push(status);
      whereSql = `WHERE a.status = $${values.length}`;
    }
    const { rows } = await pool.query(
      `SELECT a.id, a.user_id, a.referral_code, a.status, a.created_at, a.approved_at,
              a.payment_details, u.email, p.full_name, p.phone
       FROM public.affiliates a
       JOIN public.users u ON u.id = a.user_id
       LEFT JOIN public.profiles p ON p.user_id = a.user_id
       ${whereSql}
       ORDER BY a.created_at DESC`,
      values
    );
    res.json({ affiliates: rows });
  } catch (err) {
    console.error('GET /api/admin/affiliates:', err);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/admin/affiliates/action', requireAdminAccess, async (req, res) => {
  try {
    const { affiliate_id, action } = req.body || {};
    if (!affiliate_id || !action) {
      return res.status(400).json({ error: 'affiliate_id and action are required' });
    }
    if (!['approve', 'suspend'].includes(action)) {
      return res.status(400).json({ error: 'Invalid action' });
    }

    const nextStatus = action === 'approve' ? 'approved' : 'suspended';
    const { rowCount } = await pool.query(
      `UPDATE public.affiliates
       SET status = $1,
           approved_at = CASE WHEN $1 = 'approved' THEN NOW() ELSE approved_at END
       WHERE id = $2`,
      [nextStatus, affiliate_id]
    );
    if (!rowCount) return res.status(404).json({ error: 'Affiliate not found' });

    res.json({ success: true, status: nextStatus });
  } catch (err) {
    console.error('POST /api/admin/affiliates/action:', err);
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/admin/affiliate-payouts', requireAdminAccess, async (req, res) => {
  try {
    const status = String(req.query.status || 'all').toLowerCase();
    const values = [];
    let whereSql = '';
    if (status !== 'all') {
      values.push(status);
      whereSql = `WHERE ap.status = $${values.length}`;
    }
    const { rows } = await pool.query(
      `SELECT ap.id, ap.affiliate_id, ap.amount, ap.status, ap.payment_method, ap.payment_details,
              ap.transaction_id, ap.requested_at, ap.processed_at, ap.notes,
              a.referral_code, u.email, p.full_name
       FROM public.affiliate_payouts ap
       JOIN public.affiliates a ON a.id = ap.affiliate_id
       JOIN public.users u ON u.id = a.user_id
       LEFT JOIN public.profiles p ON p.user_id = a.user_id
       ${whereSql}
       ORDER BY ap.requested_at DESC`,
      values
    );
    res.json({ payouts: rows });
  } catch (err) {
    console.error('GET /api/admin/affiliate-payouts:', err);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/admin/affiliate-payouts/action', requireAdminAccess, async (req, res) => {
  try {
    const { payout_id, status, transaction_id, notes } = req.body || {};
    if (!payout_id || !status) {
      return res.status(400).json({ error: 'payout_id and status are required' });
    }
    const allowed = ['requested', 'processing', 'completed', 'failed'];
    if (!allowed.includes(status)) {
      return res.status(400).json({ error: 'Invalid payout status' });
    }

    const { rowCount } = await pool.query(
      `UPDATE public.affiliate_payouts
       SET status = $1,
           transaction_id = COALESCE($2, transaction_id),
           notes = COALESCE($3, notes),
           processed_at = CASE WHEN $1 = 'completed' THEN NOW() ELSE processed_at END
       WHERE id = $4`,
      [status, transaction_id || null, notes || null, payout_id]
    );
    if (!rowCount) return res.status(404).json({ error: 'Payout request not found' });
    res.json({ success: true, status });
  } catch (err) {
    console.error('POST /api/admin/affiliate-payouts/action:', err);
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/admin/mobile-app-leads', requireAdminAccess, async (req, res) => {
  try {
    const limitRaw = Number(req.query.limit);
    const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(limitRaw, 1), 1000) : 250;
    const { rows } = await pool.query(
      `SELECT id, email, phone, source, user_agent, ip_address, created_at
       FROM public.mobile_app_leads
       ORDER BY created_at DESC
       LIMIT $1`,
      [limit]
    );
    res.json({ leads: rows });
  } catch (err) {
    console.error('GET /api/admin/mobile-app-leads:', err);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/admin/accounts/action', requireAdminAccess, async (req, res) => {
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

    const cmsAdmin = req.cmsAdmin;
    await logAdminAction({
      adminId: cmsAdmin?.source === 'admin_users' ? cmsAdmin.id : null,
      adminEmail: cmsAdmin?.email || req.user?.email,
      action: `account.${action}`,
      targetType: 'profile',
      targetId: target_user_id,
      metadata: { new_status: newStatus },
      req,
    });

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
    if (!req.session) {
      res.clearCookie('connect.sid');
      return res.json({ success: true });
    }
    req.session.destroy((destroyErr) => {
      if (destroyErr) return res.status(500).json({ error: destroyErr.message });
      res.clearCookie('connect.sid');
      return res.json({ success: true });
    });
  });
});

// --- Payment Routes ---

const BASE_PRICES = {
  starter: 499,
  professional: 699,
};

const BILLING_PERIOD_MONTHS = [3, 6, 12];
const ADDON_BILLING_PERIOD_MONTHS = [1, 3, 6, 12];

const DISCOUNTS = {
  3: 0.05,
  6: 0.10,
  12: 0.20,
};

function assertValidBillingPeriod(months) {
  const m = Number(months);
  if (!BILLING_PERIOD_MONTHS.includes(m)) {
    throw new Error('Invalid period_months. Choose 3, 6, or 12 months.');
  }
  return m;
}

function assertValidAddonBillingPeriod(months) {
  const m = Number(months);
  if (!ADDON_BILLING_PERIOD_MONTHS.includes(m)) {
    throw new Error('Invalid period_months. Choose 1, 3, 6, or 12 months.');
  }
  return m;
}

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
    const months = assertValidBillingPeriod(period_months);
    const KEY_ID = process.env.RAZORPAY_KEY_ID;
    const KEY_SECRET = process.env.RAZORPAY_KEY_SECRET;
    if (!KEY_ID || !KEY_SECRET) return res.status(500).json({ error: 'Razorpay credentials not configured' });

    const amountRupees = calcAmount(plan_type, months);
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
          period_months: String(months),
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
    const months = assertValidBillingPeriod(period_months);
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
    expiresAt.setMonth(expiresAt.getMonth() + months);

    const startDate = new Date();
    
    await pool.query(
      `INSERT INTO public.subscriptions
       (user_id, plan_type, status, period_months, expires_at, razorpay_order_id, razorpay_payment_id, current_period_start, current_period_end, trial_ends_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       ON CONFLICT (razorpay_order_id) WHERE razorpay_order_id IS NOT NULL DO UPDATE SET
       status = EXCLUDED.status,
       expires_at = EXCLUDED.expires_at,
       razorpay_payment_id = EXCLUDED.razorpay_payment_id`,
      [req.user.id, plan_type, 'active', months, expiresAt, razorpay_order_id, razorpay_payment_id, startDate, expiresAt, null]
    );

    // Send subscription confirmation email (non-blocking)
    const amount = calcAmount(plan_type, months);
    sendSubscriptionConfirmation({
      email: req.user.email,
      customerName: req.user.full_name || req.user.email,
      planType: plan_type,
      periodMonths: months,
      amount,
      startDate,
      expiresAt,
    }).catch(err => console.error('Email send error:', err));

    res.json({ success: true, expires_at: expiresAt });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/payments/create-addon-order', async (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'Not authenticated' });
  const { addon_type, quantity = 1, period_months } = req.body || {};

  try {
    const entitlements = await buildEntitlementsPayload(req.user.id);
    if (entitlements.access_source) {
      return res.status(400).json({
        error:
          'This account has admin-granted access — no add-on payment is required. Refresh the page or sign out and back in.',
        code: 'COMPLIMENTARY_ACCESS',
        access: entitlements.access,
      });
    }

    const months = assertValidAddonBillingPeriod(period_months);
    const KEY_ID = process.env.RAZORPAY_KEY_ID;
    const KEY_SECRET = process.env.RAZORPAY_KEY_SECRET;
    if (!KEY_ID || !KEY_SECRET) {
      return res.status(500).json({ error: 'Razorpay credentials not configured' });
    }

    const qty = normalizeAddonQuantity(addon_type, quantity);
    const amountRupees = calcAddonAmount(addon_type, qty, months);

    if (amountRupees === 0) {
      const expiresAt = new Date();
      expiresAt.setMonth(expiresAt.getMonth() + months);

      await pool.query(
        `INSERT INTO public.subscription_addons
         (user_id, addon_type, quantity, status, period_months, expires_at)
         VALUES ($1, $2, $3, 'active', $4, $5)`,
        [req.user.id, addon_type, qty, months, expiresAt]
      );

      const payload = await buildEntitlementsPayload(req.user.id);
      return res.json({
        free: true,
        success: true,
        expires_at: expiresAt,
        ...payload,
      });
    }

    const amountPaise = amountRupees * 100;

    const response = await fetch('https://api.razorpay.com/v1/orders', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Basic ${Buffer.from(`${KEY_ID}:${KEY_SECRET}`).toString('base64')}`,
      },
      body: JSON.stringify({
        amount: amountPaise,
        currency: 'INR',
        receipt: `addon_${req.user.id.slice(0, 8)}_${Date.now()}`,
        notes: {
          user_id: req.user.id,
          addon_type,
          quantity: String(qty),
          period_months: String(months),
          kind: 'addon',
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

app.post('/api/payments/verify-addon-payment', async (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'Not authenticated' });
  const {
    razorpay_order_id,
    razorpay_payment_id,
    razorpay_signature,
    addon_type,
    quantity = 1,
    period_months,
  } = req.body || {};

  try {
    const months = assertValidAddonBillingPeriod(period_months);
    const KEY_SECRET = process.env.RAZORPAY_KEY_SECRET;
    const body = `${razorpay_order_id}|${razorpay_payment_id}`;
    const expectedSignature = crypto
      .createHmac('sha256', KEY_SECRET)
      .update(body)
      .digest('hex');

    if (expectedSignature !== razorpay_signature) {
      return res.status(400).json({ error: 'Payment verification failed' });
    }

    const qty = normalizeAddonQuantity(addon_type, quantity);
    const expiresAt = new Date();
    expiresAt.setMonth(expiresAt.getMonth() + months);

    await pool.query(
      `INSERT INTO public.subscription_addons
       (user_id, addon_type, quantity, status, period_months, expires_at, razorpay_order_id, razorpay_payment_id)
       VALUES ($1, $2, $3, 'active', $4, $5, $6, $7)
       ON CONFLICT (razorpay_order_id) WHERE razorpay_order_id IS NOT NULL DO UPDATE SET
         status = 'active',
         expires_at = EXCLUDED.expires_at,
         razorpay_payment_id = EXCLUDED.razorpay_payment_id`,
      [
        req.user.id,
        addon_type,
        qty,
        months,
        expiresAt,
        razorpay_order_id,
        razorpay_payment_id,
      ]
    );

    const payload = await buildEntitlementsPayload(req.user.id);
    res.json({ success: true, expires_at: expiresAt, ...payload });
  } catch (err) {
    console.error('verify-addon-payment:', err);
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

const PORT = process.env.PORT || 5001;
// Upload endpoint
app.post('/api/upload', (req, res) => {
  if (!req.isAuthenticated() && !getCmsAdmin(req)) {
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

// --- Menu Extraction (owner session or CMS session) ---
app.post('/api/extract-menu', async (req, res) => {
  if (!req.user && !getCmsAdmin(req)) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  const { imageBase64, mimeType } = req.body || {};
  if (!imageBase64) {
    return res.status(400).json({ error: 'Image data is required' });
  }

  try {
    const items = await extractMenuItemsFromImage(imageBase64, mimeType);
    console.log(`Extracted ${items.length} menu items`);
    res.json({ items });
  } catch (err) {
    console.error('Error extracting menu:', err);
    res.status(500).json({
      error: err.message || 'Failed to extract menu',
      details: err.details,
      raw: err.raw,
    });
  }
});

// --- Generate Menu Image (moved from Supabase Edge Function) ---
app.post('/api/generate-menu-image', async (req, res) => {
  if (!req.user && !getCmsAdmin(req)) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  const { item_name } = req.body;
  if (!item_name?.trim()) {
    return res.status(400).json({ error: 'item_name required' });
  }

  const searchTerm = item_name.toLowerCase().trim().replace(/\s+/g, ' ');
  const MIN_LIBRARY_SIZE = 5;
  const RETURN_COUNT = 8;

  // Helper functions for external APIs
  const fromTheMealDB = async (query) => {
    try {
      const res = await fetch(`https://www.themealdb.com/api/json/v1/1/search.php?s=${encodeURIComponent(query)}`);
      if (!res.ok) return [];
      const data = await res.json();
      if (!data.meals) return [];
      return data.meals.slice(0, 6).map((m) => ({
        image_url: m.strMealThumb,
        thumb_url: m.strMealThumb,
        source: 'TheMealDB',
      }));
    } catch { return []; }
  };

  const fromWikipedia = async (query) => {
    try {
      const res = await fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(query)}`, {
        headers: { 'User-Agent': 'banaoo-restaurant-app/1.0' }
      });
      if (!res.ok) return [];
      const data = await res.json();
      if (!data.thumbnail?.source) return [];
      return [{
        image_url: data.originalimage?.source || data.thumbnail.source,
        thumb_url: data.thumbnail.source,
        source: 'Wikipedia',
      }];
    } catch { return []; }
  };

  const fromPexels = async (query, key) => {
    try {
      const url = new URL('https://api.pexels.com/v1/search');
      url.searchParams.set('query', `${query} food dish`);
      url.searchParams.set('per_page', '8');
      url.searchParams.set('orientation', 'landscape');
      const res = await fetch(url.toString(), {
        headers: { 'Authorization': key }
      });
      if (!res.ok) return [];
      const data = await res.json();
      return (data.photos || []).map((p) => ({
        image_url: p.src.large,
        thumb_url: p.src.medium,
        source: 'Pexels',
      }));
    } catch { return []; }
  };

  try {
    // Check cache in database
    const { rows: cached } = await pool.query(
      'SELECT image_url, thumb_url, source FROM menu_item_images WHERE search_term = $1',
      [searchTerm]
    );

    const cachedPhotos = cached || [];
    console.log(`Cache hit for "${searchTerm}": ${cachedPhotos.length} images`);

    if (cachedPhotos.length >= MIN_LIBRARY_SIZE) {
      const shuffled = cachedPhotos.sort(() => Math.random() - 0.5).slice(0, RETURN_COUNT);
      return res.json({ photos: shuffled.map(p => ({ url: p.image_url, thumb: p.thumb_url, source: p.source })) });
    }

    // Fetch from external sources
    const existingUrls = new Set(cachedPhotos.map((p) => p.image_url));
    const newPhotos = [];

    const addUnique = (photos) => {
      for (const p of photos) {
        if (!existingUrls.has(p.image_url)) {
          newPhotos.push(p);
          existingUrls.add(p.image_url);
        }
      }
    };

    console.log(`Fetching from TheMealDB for "${item_name}"…`);
    addUnique(await fromTheMealDB(item_name));

    if (cachedPhotos.length + newPhotos.length < MIN_LIBRARY_SIZE) {
      console.log(`Fetching from Wikipedia for "${item_name}"…`);
      addUnique(await fromWikipedia(item_name));
    }

    const pexelsKey = process.env.PEXELS_API_KEY;
    if (cachedPhotos.length + newPhotos.length < MIN_LIBRARY_SIZE && pexelsKey) {
      console.log(`Fetching from Pexels for "${item_name}"…`);
      addUnique(await fromPexels(item_name, pexelsKey));
    }

    // Store new images
    if (newPhotos.length > 0) {
      for (const p of newPhotos) {
        try {
          await pool.query(
            'INSERT INTO menu_item_images (search_term, image_url, thumb_url, source) VALUES ($1, $2, $3, $4) ON CONFLICT DO NOTHING',
            [searchTerm, p.image_url, p.thumb_url, p.source]
          );
        } catch (e) { /* ignore duplicates */ }
      }
      console.log(`Stored ${newPhotos.length} new images for "${searchTerm}"`);
    }

    const allPhotos = [...cachedPhotos, ...newPhotos];
    if (allPhotos.length === 0) {
      return res.json({ photos: [], message: 'No images found for this dish' });
    }

    const result = allPhotos
      .sort(() => Math.random() - 0.5)
      .slice(0, RETURN_COUNT)
      .map((p) => ({ url: p.image_url, thumb: p.thumb_url, source: p.source }));

    res.json({ photos: result });
  } catch (err) {
    console.error('generate-menu-image error:', err);
    res.status(500).json({ error: err.message || 'Internal server error' });
  }
});

// --- Voice Order (moved from Supabase Edge Function) ---
// No auth required - used by customers and POS staff
app.post('/api/voice-order', async (req, res) => {
  const { transcript, menu_items, mode } = req.body;

  if (!transcript?.trim() || !menu_items?.length) {
    return res.status(400).json({ error: 'transcript and menu_items required' });
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'OPENAI_API_KEY not configured' });
  }

  const menuText = menu_items
    .map((item) => `ID: ${item.id} | Name: "${item.name}" | Price: ₹${item.price}`)
    .join('\n');

  const isPOS = mode === 'pos';

  const systemPrompt = isPOS
    ? `You are a restaurant billing counter assistant. Extract order details from spoken customer orders.
Return ONLY a raw JSON object — no markdown, no explanation:
{"items":[{"menu_item_id":"exact-id","name":"Exact Menu Name","quantity":1}],"order_type":"dine_in","table_number":null}
Rules:
- Match to closest available menu items only
- order_type: "dine_in" (mentions table/inside/baith ke) or "takeaway" (parcel/pack/bahar/ghar)
- table_number: extract number as string if mentioned, else null
- Default order_type to "dine_in"
- Understand ANY language: Hindi, Telugu, Tamil, Kannada, English, or mixed`
    : `You are a restaurant ordering assistant. Extract items from a spoken customer order.
Return ONLY a raw JSON array — no markdown, no explanation:
[{"menu_item_id":"exact-id-from-menu","name":"Exact Menu Name","quantity":1}]
Rules:
- Match to closest available menu items only
- If quantity not mentioned, assume 1
- If nothing matches, return []
- Understand ANY language: Hindi, Telugu, Tamil, Kannada, English, or mixed`;

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `Customer said: "${transcript}"\n\nAvailable menu:\n${menuText}` },
        ],
        temperature: 0.1,
        max_tokens: 1024,
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      console.error('OpenAI error:', response.status, err);
      return res.status(500).json({ error: 'AI service error' });
    }

    const aiData = await response.json();
    let raw = aiData.choices?.[0]?.message?.content ?? '';
    raw = raw.replace(/```json\n?/gi, '').replace(/```\n?/g, '').trim();

    const menuIds = new Set(menu_items.map((m) => m.id));

    const validateItems = (arr) =>
      arr
        .filter((item) => item.menu_item_id && menuIds.has(item.menu_item_id) && Number(item.quantity) > 0)
        .map((item) => ({
          menu_item_id: String(item.menu_item_id),
          name: String(item.name),
          quantity: Math.max(1, Math.round(Number(item.quantity) || 1)),
        }));

    let result = { items: [], order_type: 'dine_in', table_number: null, transcript };

    try {
      const parsed = JSON.parse(raw);
      if (isPOS) {
        result.items = validateItems(Array.isArray(parsed.items) ? parsed.items : []);
        result.order_type = parsed.order_type === 'takeaway' ? 'takeaway' : 'dine_in';
        result.table_number = parsed.table_number ? String(parsed.table_number) : null;
      } else {
        result.items = validateItems(Array.isArray(parsed) ? parsed : []);
      }
    } catch { result.items = []; }

    res.json(result);
  } catch (err) {
    console.error('voice-order error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// --- Support Chat with Streaming (moved from Supabase Edge Function) ---
app.post('/api/support-chat', async (req, res) => {
  const { messages } = req.body;

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'OPENAI_API_KEY not configured' });
  }

  const systemPrompt = `You are the banaoo.in support assistant. banaoo.in is a restaurant management platform that helps restaurant owners manage their business efficiently.

**Platform Features:**
- Multi-outlet management - Manage multiple restaurant locations from one dashboard
- Order management - Take and track orders with ease
- Kitchen Display System (KDS) - Real-time order display for kitchen staff
- Menu management - Create and update menus with AI-powered menu import from images
- Staff management - Manage roles, schedules, and permissions
- Table management - Floor plans and table status tracking
- QR Menu Builder - Free tool to create digital menus with QR codes
- Analytics & Reports - Track sales, orders, and performance

**Pricing Plans:**
- Launcher: ₹499/month (1 outlet, 1 staff account, order/menu/KDS/analytics/table management, email support; no mobile app)
- Growth: ₹699/month (Most Popular — 1 outlet, 2 staff accounts, all Launcher features plus mobile app access and priority support)
- Expand: Custom pricing (unlimited outlets, flexible staff, custom integrations, multi-branch management, dedicated support)
- Add-ons on Launcher/Growth: extra outlet ₹300/month, extra staff ₹150/month per account

All plans include a 14-day free trial with no credit card required.

**Contact Information:**
- Email: connect@banaoo.in

**Guidelines:**
- Be helpful, friendly, and concise
- Answer questions about features, pricing, and how to use the platform
- For billing issues, account problems, or complex technical requests, offer to connect them with the team at connect@banaoo.in
- If you don't know something specific, acknowledge it and suggest contacting support
- Keep responses brief but informative
- Use bullet points for lists when helpful
- When users want to talk to a human, provide the email connect@banaoo.in`;

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [{ role: 'system', content: systemPrompt }, ...messages],
        stream: true,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return res.status(429).json({ error: "We're experiencing high demand. Please try again in a moment." });
      }
      const errorText = await response.text();
      console.error('OpenAI error:', response.status, errorText);
      return res.status(500).json({ error: 'Something went wrong. Please try again or contact connect@banaoo.in' });
    }

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    // Stream the response using Web Streams API
    const reader = response.body.getReader();
    const decoder = new TextDecoder();

    const pump = async () => {
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) {
            res.end();
            break;
          }
          res.write(decoder.decode(value, { stream: true }));
        }
      } catch (e) {
        console.error('Stream error:', e);
        res.end();
      }
    };

    pump();
  } catch (err) {
    console.error('Support chat error:', err);
    res.status(500).json({ error: err.message || 'Unknown error occurred' });
  }
});

// --- Swiggy Webhook (moved from Supabase Edge Function) ---
app.post('/api/webhooks/swiggy', async (req, res) => {
  try {
    const outletId = req.query.outlet_id;

    if (!outletId) {
      return res.status(400).json({ error: 'Missing outlet_id parameter' });
    }

    // Verify integration exists
    const { rows: integrations } = await pool.query(
      `SELECT * FROM platform_integrations WHERE outlet_id = $1 AND platform = 'swiggy' AND is_active = true LIMIT 1`,
      [outletId]
    );
    const integration = integrations[0];

    if (!integration) {
      console.error('Integration not found or inactive');
      return res.status(404).json({ error: 'Integration not configured' });
    }

    const body = req.body;
    console.log('Received Swiggy webhook:', JSON.stringify(body));

    // Log incoming webhook
    await pool.query(
      `INSERT INTO platform_sync_logs (integration_id, action, status, request_data) VALUES ($1, $2, $3, $4)`,
      [integration.id, 'order_received', 'pending', JSON.stringify(body)]
    );

    const swiggyOrder = body.order || body;

    // Generate order number
    const { rows: orderNumResult } = await pool.query(`SELECT generate_order_number($1) as order_number`, [outletId]);
    const orderNumber = orderNumResult[0]?.order_number || `S-${Date.now()}`;

    // Create order
    const { rows: newOrders } = await pool.query(
      `INSERT INTO orders (outlet_id, order_number, status, order_type, source, external_order_id, platform_data, customer_name, customer_phone, delivery_address, delivery_status, subtotal, total, notes, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
       RETURNING *`,
      [
        outletId, orderNumber, 'pending', 'delivery', 'swiggy',
        swiggyOrder.order_id || swiggyOrder.id,
        JSON.stringify(swiggyOrder),
        swiggyOrder.customer?.name || swiggyOrder.customer_name || 'Swiggy Customer',
        swiggyOrder.customer?.phone || swiggyOrder.customer_phone,
        swiggyOrder.delivery_address || swiggyOrder.address?.full_address,
        'assigned',
        swiggyOrder.bill?.subtotal || swiggyOrder.subtotal || 0,
        swiggyOrder.bill?.total || swiggyOrder.total || 0,
        swiggyOrder.cooking_instructions || swiggyOrder.special_instructions,
        integration.id
      ]
    );
    const newOrder = newOrders[0];

    // Create order items
    const items = swiggyOrder.items || swiggyOrder.cart_items || [];
    for (const item of items) {
      const { rows: menuItems } = await pool.query(
        `SELECT id, base_price FROM menu_items WHERE outlet_id = $1 AND name ILIKE $2 LIMIT 1`,
        [outletId, `%${item.name || item.item_name}%`]
      );
      const menuItem = menuItems[0];

      await pool.query(
        `INSERT INTO order_items (order_id, menu_item_id, item_name, quantity, unit_price, total_price, notes)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          newOrder.id,
          menuItem?.id || '00000000-0000-0000-0000-000000000000',
          item.name || item.item_name,
          item.quantity || 1,
          item.price || item.unit_price || menuItem?.base_price || 0,
          (item.price || item.unit_price || 0) * (item.quantity || 1),
          item.item_instructions || item.notes
        ]
      );
    }

    // Update integration
    await pool.query(`UPDATE platform_integrations SET last_synced_at = NOW() WHERE id = $1`, [integration.id]);

    // Log success
    await pool.query(
      `INSERT INTO platform_sync_logs (integration_id, action, status, request_data, response_data) VALUES ($1, $2, $3, $4, $5)`,
      [integration.id, 'order_created', 'success', JSON.stringify(swiggyOrder), JSON.stringify({ order_id: newOrder.id, order_number: newOrder.order_number })]
    );

    console.log('Order created successfully:', newOrder.id);
    res.json({ success: true, order_id: newOrder.id, order_number: newOrder.order_number });
  } catch (err) {
    console.error('Webhook error:', err);
    res.status(500).json({ error: 'Internal server error', details: err.message });
  }
});

// --- Zomato Webhook (moved from Supabase Edge Function) ---
app.post('/api/webhooks/zomato', async (req, res) => {
  try {
    const outletId = req.query.outlet_id;

    if (!outletId) {
      return res.status(400).json({ error: 'Missing outlet_id parameter' });
    }

    // Verify integration exists
    const { rows: integrations } = await pool.query(
      `SELECT * FROM platform_integrations WHERE outlet_id = $1 AND platform = 'zomato' AND is_active = true LIMIT 1`,
      [outletId]
    );
    const integration = integrations[0];

    if (!integration) {
      console.error('Integration not found or inactive');
      return res.status(404).json({ error: 'Integration not configured' });
    }

    const body = req.body;
    console.log('Received Zomato webhook:', JSON.stringify(body));

    // Log incoming webhook
    await pool.query(
      `INSERT INTO platform_sync_logs (integration_id, action, status, request_data) VALUES ($1, $2, $3, $4)`,
      [integration.id, 'order_received', 'pending', JSON.stringify(body)]
    );

    const zomatoOrder = body.order || body;

    // Generate order number
    const { rows: orderNumResult } = await pool.query(`SELECT generate_order_number($1) as order_number`, [outletId]);
    const orderNumber = orderNumResult[0]?.order_number || `Z-${Date.now()}`;

    // Create order
    const { rows: newOrders } = await pool.query(
      `INSERT INTO orders (outlet_id, order_number, status, order_type, source, external_order_id, platform_data, customer_name, customer_phone, delivery_address, delivery_status, subtotal, total, notes, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
       RETURNING *`,
      [
        outletId, orderNumber, 'pending', 'delivery', 'zomato',
        zomatoOrder.id || zomatoOrder.order_id,
        JSON.stringify(zomatoOrder),
        zomatoOrder.customer?.name || zomatoOrder.customer_name || 'Zomato Customer',
        zomatoOrder.customer?.phone || zomatoOrder.customer_phone,
        zomatoOrder.delivery_address || zomatoOrder.address,
        'assigned',
        zomatoOrder.subtotal || zomatoOrder.total || 0,
        zomatoOrder.total || 0,
        zomatoOrder.instructions || zomatoOrder.special_instructions,
        integration.id
      ]
    );
    const newOrder = newOrders[0];

    // Create order items
    const items = zomatoOrder.items || zomatoOrder.order_items || [];
    for (const item of items) {
      const { rows: menuItems } = await pool.query(
        `SELECT id, base_price FROM menu_items WHERE outlet_id = $1 AND name ILIKE $2 LIMIT 1`,
        [outletId, `%${item.name || item.item_name}%`]
      );
      const menuItem = menuItems[0];

      await pool.query(
        `INSERT INTO order_items (order_id, menu_item_id, item_name, quantity, unit_price, total_price, notes)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          newOrder.id,
          menuItem?.id || '00000000-0000-0000-0000-000000000000',
          item.name || item.item_name,
          item.quantity || 1,
          item.price || item.unit_price || menuItem?.base_price || 0,
          (item.price || item.unit_price || 0) * (item.quantity || 1),
          item.instructions || item.notes
        ]
      );
    }

    // Update integration
    await pool.query(`UPDATE platform_integrations SET last_synced_at = NOW() WHERE id = $1`, [integration.id]);

    // Log success
    await pool.query(
      `INSERT INTO platform_sync_logs (integration_id, action, status, request_data, response_data) VALUES ($1, $2, $3, $4, $5)`,
      [integration.id, 'order_created', 'success', JSON.stringify(zomatoOrder), JSON.stringify({ order_id: newOrder.id, order_number: newOrder.order_number })]
    );

    console.log('Order created successfully:', newOrder.id);
    res.json({ success: true, order_id: newOrder.id, order_number: newOrder.order_number });
  } catch (err) {
    console.error('Webhook error:', err);
    res.status(500).json({ error: 'Internal server error', details: err.message });
  }
});

registerCmsRoutes(app);
registerCustomerOrderRoutes(app, { requireAuth });
registerBillingMobileRoutes(app, { requireAuth });
registerBillingRoutes(app, { requireAuth });
registerDashboardBannerPublicRoutes(app, { requireAuth });
registerDashboardQuickActionRoutes(app, { requireAuth });
registerStaffRoutes(app, { requireAuth });
registerInventoryRoutes(app, { requireAuth });
registerShiprocketRoutes(app, { requireAuth });
void warmInventorySchema();
startShiprocketJobs();
console.log('[api] Staff routes: GET|POST /api/staff-members, PATCH|DELETE /api/staff-members/:id');
console.log('[api] Inventory routes: /api/outlets/:outletId/inventory, /api/inventory/:itemId');
console.log('[api] Dashboard routes: GET /api/dashboard/banners, GET|PUT /api/dashboard/quick-actions');

// =============================================================================
// 404 + global error handler — MUST be the LAST middleware/route registered.
// Routes added below these handlers will silently 404 because Express matches
// in order.
// =============================================================================

// JSON 404 for any unmatched route under our API/auth namespaces.
// Static (uploads, downloads) and SPA routes are not behind this handler
// because nginx / Vite serve them directly; in dev, anything that falls
// through to Express truly is unknown.
app.use((req, res, next) => {
  if (res.headersSent) return next();
  res.status(404).json({
    error: 'Not found',
    path: req.originalUrl,
    method: req.method,
  });
});

// Centralised JSON error handler. Translates known error shapes into the
// right HTTP status and prevents the default Express HTML error page from
// leaking stack traces to clients (especially via the CORS-origin throw).
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  // Generate a short request id so the response and server logs can be
  // cross-referenced when a user reports an error.
  const requestId =
    (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`).slice(0, 8);

  const isProd = process.env.NODE_ENV === 'production';

  // Classify common errors so we return the right status code.
  let status = 500;
  let message = 'Internal server error';

  if (err && err.message === 'Not allowed by CORS') {
    status = 403;
    message = 'Origin not allowed';
  } else if (err && err.name === 'MulterError') {
    // multer surfaces upload-size/limit issues with `code: 'LIMIT_FILE_SIZE'`, etc.
    status = err.code === 'LIMIT_FILE_SIZE' ? 413 : 400;
    message = err.message || 'Upload error';
  } else if (err && typeof err.status === 'number') {
    status = err.status;
    message = err.message || message;
  } else if (err && err.type === 'entity.too.large') {
    // express.json / urlencoded body-parser overflow
    status = 413;
    message = 'Request body too large';
  } else if (err && err.type === 'entity.parse.failed') {
    status = 400;
    message = 'Malformed JSON body';
  } else if (err && err.message && !isProd) {
    // In dev, surface the actual message so debugging is fast.
    message = err.message;
  }

  console.error(
    `[error] request_id=${requestId} ${req.method} ${req.originalUrl} → ${status}:`,
    err && err.stack ? err.stack : err
  );

  if (res.headersSent) return next(err);

  const body = { error: message, request_id: requestId };
  if (!isProd && err && err.stack) {
    body.stack = err.stack.split('\n').slice(0, 8);
  }
  res.status(status).json(body);
});

Promise.all([ensureMobileAppLeadsTable(), ensureNotificationsInfra()])
  .catch((err) => {
    console.error('bootstrap on startup:', err);
  })
  .finally(() => {
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  });
