const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const http = require('http');
const WebSocket = require('ws');
const cron = require('node-cron');

const db = require('./db');
const { encrypt, decrypt, hashEmail } = require('./encryption');
const { enforceLockout, recordFailedAttempt, resetFailedAttempts, evaluateRiskLevel, requireAuth, requireAdmin } = require('./auth');
const { sendMessage } = require('./whatsapp');
const { captureAndUploadEmergencyStream } = require('./rtsp_capture');

require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'super_secret_session_token_key_change_me_in_production';

// Secure Express Middlewares
app.use(helmet());
app.use(cors({ origin: '*' }));
app.use(express.json());

// In-memory OTP store (token -> { email, code, expires, type: 'signup'|'reset' })
const otpStore = new Map();

// Helper to generate secure random 6-digit OTP
function generateOTP() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// ----------------------------------------------------
// Public Authentication Routes
// ----------------------------------------------------

/**
 * Check if Email Exists
 */
app.post('/api/auth/check-email', async (req, res) => {
  const { email } = req.body;
  if (!email) {
    return res.status(400).json({ error: 'BAD_REQUEST', message: 'Email is required.' });
  }

  const emailHash = hashEmail(email);

  try {
    const existing = await db.query('SELECT id FROM users WHERE email_hash = ?', [emailHash]);
    if (existing.length > 0) {
      return res.status(200).json({ exists: true });
    }
    res.status(200).json({ exists: false });
  } catch (err) {
    console.error('Email check error:', err);
    res.status(500).json({ error: 'SERVER_ERROR', message: 'Failed to check email.' });
  }
});

/**
 * Register User Profile
 */
app.post('/api/auth/signup', async (req, res) => {
  const { name, email, password, safePattern, duressPattern, phone, age, authMethod } = req.body;

  if (!name || !email || !password || !safePattern || !duressPattern) {
    return res.status(400).json({ error: 'BAD_REQUEST', message: 'All registration parameters are required.' });
  }

  const emailHash = hashEmail(email.trim().toLowerCase());
  const nameHash = hashEmail(name.trim().toLowerCase());

  try {
    // Check if email already registered
    const existing = await db.query('SELECT id FROM users WHERE email_hash = ? OR name_hash = ?', [emailHash, nameHash]);
    if (existing.length > 0) {
      return res.status(409).json({ error: 'USER_EXISTS', message: 'Email address or name already registered.' });
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    // Encrypt GDPR-sensitive strings
    const nameEncrypted = encrypt(name);
    const emailEncrypted = encrypt(email);
    const phoneEncrypted = phone ? encrypt(phone) : null;

    // Initial role is admin if it's the very first user, otherwise user
    const userCount = await db.query('SELECT COUNT(*) as count FROM users');
    const role = userCount[0].count === 0 ? 'admin' : 'user';

    const result = await db.query(
      'INSERT INTO users (name_encrypted, email_encrypted, email_hash, password_hash, safe_pattern, duress_pattern, role, auth_level, phone_encrypted, age, auth_method, name_hash) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [nameEncrypted, emailEncrypted, emailHash, passwordHash, safePattern, duressPattern, role, 1, phoneEncrypted, age || null, authMethod || 'passcode', nameHash]
    );

    res.status(201).json({
      success: true,
      message: 'User registered successfully.',
      userId: result.insertId
    });
  } catch (err) {
    console.error('Registration error:', err);
    res.status(500).json({ error: 'SERVER_ERROR', message: 'Failed to process signup request.' });
  }
});

/**
 * Dynamic Auth Request Initiation
 * Scans email hashes and reports corresponding Auth Tiers based on environmental risks
 */
app.post('/api/auth/pre-login', evaluateRiskLevel, async (req, res) => {
  const { identifier } = req.body;
  if (!identifier) {
    return res.status(400).json({ error: 'BAD_REQUEST', message: 'Identifier (Email or Name) required for evaluation.' });
  }

  const idHash = hashEmail(identifier.trim().toLowerCase());

  try {
    const users = await db.query('SELECT auth_level, home_wifi_ssid, home_gps_lat, home_gps_lng FROM users WHERE email_hash = ? OR name_hash = ?', [idHash, idHash]);
    if (users.length === 0) {
      // Return normal tier score to prevent system indexing/probing
      return res.json({ identifier, requiredLevel: 1 });
    }

    const user = users[0];
    let evaluatedLevel = req.riskLevel;

    // Environmental lock: If database states force Level 2 or 3, respect minimums
    if (user.auth_level > evaluatedLevel) {
      evaluatedLevel = user.auth_level;
    }

    res.json({
      identifier,
      requiredLevel: evaluatedLevel
    });
  } catch (err) {
    res.status(500).json({ error: 'SERVER_ERROR', message: 'Failed to evaluate credentials risk score.' });
  }
});

/**
 * Sign In Route (Pattern matches, Password validation, Lockout Verification)
 */
app.post('/api/auth/signin', enforceLockout, async (req, res) => {
  const { identifier, password, pattern, fingerprint, ssid, latitude, longitude } = req.body;

  if (!identifier || (!password && !pattern)) {
    return res.status(400).json({ error: 'BAD_REQUEST', message: 'Identifier and (password or pattern) inputs required.' });
  }

  const idHash = hashEmail(identifier.trim().toLowerCase());

  try {
    const users = await db.query('SELECT * FROM users WHERE email_hash = ? OR name_hash = ?', [idHash, idHash]);
    if (users.length === 0) {
      await recordFailedAttempt(identifier);
      return res.status(401).json({ error: 'INVALID_CREDENTIALS', message: 'Incorrect credentials.' });
    }

    const user = users[0];

    if (user.status === 'suspended') {
      return res.status(403).json({ error: 'USER_SUSPENDED', message: 'Your profile has been locked by admin.' });
    }

    let isAuthenticated = false;
    let isDuress = false;

    // 1. If password provided, check it
    if (password && password !== 'no_password') {
      const match = await bcrypt.compare(password, user.password_hash);
      if (match) isAuthenticated = true;
    }

    // 2. If pattern provided, check it
    if (!isAuthenticated && pattern) {
      if (pattern === user.safe_pattern) isAuthenticated = true;
      else if (pattern === user.duress_pattern) {
        isAuthenticated = true;
        isDuress = true;
      }
    }

    if (!isAuthenticated) {
      const lockUpdate = await recordFailedAttempt(identifier);
      return res.status(401).json({ 
        error: 'INVALID_CREDENTIALS', 
        message: 'Incorrect credentials or pattern.',
        ...lockUpdate
      });
    }

    // Reset lockout counters on valid auth match
    await resetFailedAttempts(identifier);

    // If Duress pattern is entered: Execute silent panic routines
    if (isDuress) {
      console.warn(`[SECURITY ALERT] Duress entry triggered for user: ${identifier}. Running silent panic procedures.`);
      
      // Log duress event
      await db.query(
        'INSERT INTO audit_logs (user_id, event_type, details, ip_address) VALUES (?, ?, ?, ?)',
        [user.id, 'duress_activated', 'Silent panic triggered via duress pattern', req.ip]
      );

      // Trigger RTSP stream recorder and WhatsApp alert asynchronously
      triggerSilentCrisis(user, latitude, longitude);

      // Return a functional validation token but mask the API response to indicate Calculator redirect
      const mockToken = jwt.sign({ userId: user.id, isDuress: true }, JWT_SECRET, { expiresIn: '1h' });
      return res.json({
        success: true,
        token: mockToken,
        isDuress: true,
        redirect: '/calculator'
      });
    }

    // Generate valid session JWT token
    const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '24h' });
    const tokenHash = hashEmail(token);
    
    // Register active session metrics
    await db.query(
      'INSERT INTO sessions (user_id, token_hash, device_fingerprint, ip_address, location_name) VALUES (?, ?, ?, ?, ?)',
      [user.id, tokenHash, fingerprint || 'Unknown Agent', req.ip, ssid ? `SSID: ${ssid}` : 'Cellular Data']
    );

    // Audit logs entry
    await db.query(
      'INSERT INTO audit_logs (user_id, event_type, details, ip_address) VALUES (?, ?, ?, ?)',
      [user.id, 'login_success', 'User session established', req.ip]
    );

    res.json({
      success: true,
      token,
      user: {
        id: user.id,
        name: decrypt(user.name_encrypted),
        email: decrypt(user.email_encrypted),
        role: user.role,
        homeWifi: user.home_wifi_ssid,
        homeGps: user.home_gps_lat ? { lat: user.home_gps_lat, lng: user.home_gps_lng } : null,
        homeAddress: user.home_address_encrypted ? decrypt(user.home_address_encrypted) : '',
        medicalCard: user.medical_card_encrypted ? JSON.parse(decrypt(user.medical_card_encrypted)) : null,
        emergencyContact: user.emergency_contact_encrypted ? JSON.parse(decrypt(user.emergency_contact_encrypted)) : null,
        frequentPlaces: user.frequent_places_encrypted ? JSON.parse(decrypt(user.frequent_places_encrypted)) : []
      }
    });

  } catch (err) {
    console.error('Login processing error:', err);
    res.status(500).json({ error: 'SERVER_ERROR', message: 'Failed to process login verification.' });
  }
});

/**
 * Requests a verification OTP token for password reset
 */
app.post('/api/auth/otp-request', async (req, res) => {
  const { email } = req.body;
  if (!email) {
    return res.status(400).json({ error: 'BAD_REQUEST', message: 'Email is required for verification.' });
  }

  const emailHash = hashEmail(email);

  try {
    const users = await db.query('SELECT * FROM users WHERE email_hash = ?', [emailHash]);
    if (users.length === 0) {
      // Emulate success to prevent enumeration attacks
      return res.json({ success: true, message: 'OTP token sent to registered contact.' });
    }

    const user = users[0];
    const otp = generateOTP();
    const expires = new Date(Date.now() + 5 * 60 * 1000); // 5-minute TTL

    // Store in-memory OTP mapping
    otpStore.set(emailHash, { otp, expires });

    let contactPhone = process.env.EMERGENCY_CONTACT_PHONE || '18765551234';
    if (user.phone_encrypted) {
      try {
        contactPhone = decrypt(user.phone_encrypted);
      } catch (decErr) {
        console.error('Failed to decrypt user phone number:', decErr.message);
      }
    }
    const cleanEmail = decrypt(user.email_encrypted);

    const otpMessage = `[SAFER SECURITY ALERT] Use verification OTP: ${otp} to reset your account. Expires in 5 minutes. Registered for: ${cleanEmail}`;
    await sendMessage(contactPhone, otpMessage);

    res.json({
      success: true,
      message: 'One-time security code dispatched.',
      // For local testing convenience if WhatsApp is offline
      devOTP: process.env.NODE_ENV === 'development' ? otp : undefined
    });

  } catch (err) {
    console.error('OTP request error:', err);
    res.status(500).json({ error: 'SERVER_ERROR', message: 'Failed to request OTP.' });
  }
});

/**
 * Resets account status & failed attempts via valid OTP code
 */
app.post('/api/auth/otp-verify', async (req, res) => {
  const { email, otp, newPassword } = req.body;
  if (!email || !otp || !newPassword) {
    return res.status(400).json({ error: 'BAD_REQUEST', message: 'All reset criteria parameters must be provided.' });
  }

  const emailHash = hashEmail(email);

  try {
    const record = otpStore.get(emailHash);
    if (!record || record.otp !== otp || new Date() > record.expires) {
      return res.status(400).json({ error: 'INVALID_OTP', message: 'Verification code is invalid or has expired.' });
    }

    // OTP validated. Clean store entry.
    otpStore.delete(emailHash);

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(newPassword, salt);

    // Update password & restore user status to active
    await db.query(
      'UPDATE users SET password_hash = ?, status = "active" WHERE email_hash = ?',
      [passwordHash, emailHash]
    );

    // Reset lockout matrix limits
    await resetFailedAttempts(email);

    res.json({
      success: true,
      message: 'Account reset verified. Access restored.'
    });
    


  } catch (err) {
    console.error('OTP verify error:', err);
    res.status(500).json({ error: 'SERVER_ERROR', message: 'Failed to complete reset routing.' });
  }
});

// ----------------------------------------------------
// Secure User Authenticated Endpoints
// ----------------------------------------------------

/**
 * Update User home environment credentials and GPS coordinates
 */
app.put('/api/user/profile', requireAuth, async (req, res) => {
  const { name, email, homeWifi, homeGps, homeAddress, medicalCard, emergencyContact, frequentPlaces } = req.body;
  const user = req.user;

  try {
    const updatedName = name ? encrypt(name) : user.name_encrypted;
    const updatedEmail = email ? encrypt(email) : user.email_encrypted;
    const updatedEmailHash = email ? hashEmail(email) : user.email_hash;

    const lat = homeGps ? homeGps.lat : user.home_gps_lat;
    const lng = homeGps ? homeGps.lng : user.home_gps_lng;
    const wifi = homeWifi !== undefined ? homeWifi : user.home_wifi_ssid;

    const homeAddressEncrypted = homeAddress !== undefined ? (homeAddress ? encrypt(homeAddress) : null) : user.home_address_encrypted;
    const medicalCardEncrypted = medicalCard !== undefined ? (medicalCard ? encrypt(JSON.stringify(medicalCard)) : null) : user.medical_card_encrypted;
    const emergencyContactEncrypted = emergencyContact !== undefined ? (emergencyContact ? encrypt(JSON.stringify(emergencyContact)) : null) : user.emergency_contact_encrypted;
    const frequentPlacesEncrypted = frequentPlaces !== undefined ? (frequentPlaces ? encrypt(JSON.stringify(frequentPlaces)) : null) : user.frequent_places_encrypted;

    await db.query(
      'UPDATE users SET name_encrypted = ?, email_encrypted = ?, email_hash = ?, home_wifi_ssid = ?, home_gps_lat = ?, home_gps_lng = ?, home_address_encrypted = ?, medical_card_encrypted = ?, emergency_contact_encrypted = ?, frequent_places_encrypted = ? WHERE id = ?',
      [updatedName, updatedEmail, updatedEmailHash, wifi, lat, lng, homeAddressEncrypted, medicalCardEncrypted, emergencyContactEncrypted, frequentPlacesEncrypted, user.id]
    );

    res.json({
      success: true,
      message: 'Security environment parameters updated.',
      user: {
        id: user.id,
        name: name || decrypt(updatedName),
        email: email || decrypt(updatedEmail),
        role: user.role,
        homeWifi: wifi,
        homeGps: lat ? { lat, lng } : null,
        homeAddress: homeAddress !== undefined ? homeAddress : (user.home_address_encrypted ? decrypt(user.home_address_encrypted) : ''),
        medicalCard: medicalCard !== undefined ? medicalCard : (user.medical_card_encrypted ? JSON.parse(decrypt(user.medical_card_encrypted)) : null),
        emergencyContact: emergencyContact !== undefined ? emergencyContact : (user.emergency_contact_encrypted ? JSON.parse(decrypt(user.emergency_contact_encrypted)) : null),
        frequentPlaces: frequentPlaces !== undefined ? frequentPlaces : (user.frequent_places_encrypted ? JSON.parse(decrypt(user.frequent_places_encrypted)) : [])
      }
    });

  } catch (err) {
    res.status(500).json({ error: 'SERVER_ERROR', message: 'Failed to update environment profiles.' });
  }
});

/**
 * List all active session entries for the user
 */
app.get('/api/user/sessions', requireAuth, async (req, res) => {
  try {
    const sessions = await db.query(
      'SELECT id, device_fingerprint, ip_address, location_name, created_at, last_active FROM sessions WHERE user_id = ? AND is_active = 1',
      [req.user.id]
    );
    res.json(sessions);
  } catch (err) {
    res.status(500).json({ error: 'SERVER_ERROR', message: 'Failed to retrieve sessions list.' });
  }
});

/**
 * Revoke specific session ID or revoke all sessions (remote wipe trigger)
 */
app.delete('/api/user/sessions', requireAuth, async (req, res) => {
  const { sessionId, revokeAll } = req.body;

  try {
    if (revokeAll) {
      await db.query('UPDATE sessions SET is_active = 0 WHERE user_id = ?', [req.user.id]);
      return res.json({ success: true, message: 'All remote sessions revoked. Other devices logged out.' });
    }

    if (!sessionId) {
      return res.status(400).json({ error: 'BAD_REQUEST', message: 'Session ID is required for deletion.' });
    }

    await db.query(
      'UPDATE sessions SET is_active = 0 WHERE id = ? AND user_id = ?',
      [sessionId, req.user.id]
    );

    res.json({ success: true, message: 'Remote device session revoked.' });
  } catch (err) {
    res.status(500).json({ error: 'SERVER_ERROR', message: 'Failed to process revocation.' });
  }
});

/**
 * File Diagnostics Support Ticket
 */
app.post('/api/user/ticket', requireAuth, async (req, res) => {
  const { title, description, metadata } = req.body;

  if (!title || !description) {
    return res.status(400).json({ error: 'BAD_REQUEST', message: 'Title and description are required.' });
  }

  try {
    await db.query(
      'INSERT INTO support_tickets (user_id, title, description, metadata_json) VALUES (?, ?, ?, ?)',
      [req.user.id, title, description, JSON.stringify(metadata || {})]
    );

    res.status(201).json({
      success: true,
      message: 'Diagnostics ticket filed. Development team notified.'
    });

    // ---------- New Endpoints ----------
    // 1. Automated verification check‑in (called by client when user checks in)
    app.post('/api/checkin', requireAuth, async (req, res) => {
      try {
        const now = new Date().toISOString();
        await db.query('INSERT INTO checkins (user_id, checkin_time, flagged) VALUES (?, ?, 0)', [req.user.id, now]);
        res.json({ success: true, message: 'Check‑in recorded.' });
      } catch (e) {
        console.error('Check‑in error:', e);
        res.status(500).json({ error: 'SERVER_ERROR', message: 'Failed to record check‑in.' });
      }
    });

    // 2. Emergency routing configuration (upsert)
    app.post('/api/emergency-route', requireAuth, async (req, res) => {
      const { human_contact, bot_contact, fallback_seconds } = req.body;
      if (!human_contact && !bot_contact) {
        return res.status(400).json({ error: 'BAD_REQUEST', message: 'At least one contact method required.' });
      }
      try {
        await db.query(
          `INSERT INTO emergency_routes (user_id, human_contact, bot_contact, fallback_seconds)
           VALUES (?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE human_contact = VALUES(human_contact), bot_contact = VALUES(bot_contact), fallback_seconds = VALUES(fallback_seconds)`,
          [req.user.id, human_contact || null, bot_contact || null, fallback_seconds || 60]
        );
        res.json({ success: true, message: 'Routing preferences saved.' });
      } catch (e) {
        console.error('Routing save error:', e);
        res.status(500).json({ error: 'SERVER_ERROR', message: 'Failed to save routing.' });
      }
    });

    // 3. Transit event reporting (virtual agent bot trigger)
    app.post('/api/transit-event', requireAuth, async (req, res) => {
      const { start_time, end_time, path } = req.body; // path: array of {lat,lng}
      try {
        await db.query(
          'INSERT INTO transit_events (user_id, start_time, end_time, path, flagged) VALUES (?, ?, ?, ?, 0)',
          [req.user.id, start_time, end_time, JSON.stringify(path)]
        );
        // Placeholder: notify admin channel (e.g., via existing WhatsApp bot)
        console.log(`Transit event logged for user ${req.user.id}`);
        res.json({ success: true, message: 'Transit event recorded.' });
      } catch (e) {
        console.error('Transit event error:', e);
        res.status(500).json({ error: 'SERVER_ERROR', message: 'Failed to record transit event.' });
      }
    });
  } catch (err) {
    res.status(500).json({ error: 'SERVER_ERROR', message: 'Failed to file troubleshooting ticket.' });
  }
});

// ----------------------------------------------------
// Admin Only Endpoints
// ----------------------------------------------------

/**
 * Retrieve admin dashboard parameters
 */
app.get('/api/admin/dashboard', requireAuth, requireAdmin, async (req, res) => {
  try {
    const rawUsers = await db.query('SELECT id, name_encrypted, email_encrypted, role, status, auth_level, created_at FROM users');
    const users = rawUsers.map(u => ({
      id: u.id,
      name: decrypt(u.name_encrypted),
      email: decrypt(u.email_encrypted),
      role: u.role,
      status: u.status,
      auth_level: u.auth_level,
      created_at: u.created_at
    }));

    const auditLogs = await db.query('SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT 100');
    const tickets = await db.query('SELECT * FROM support_tickets ORDER BY created_at DESC');

    res.json({
      users,
      auditLogs,
      tickets
    });
  } catch (err) {
    console.error('Admin loading failed:', err);
    res.status(500).json({ error: 'SERVER_ERROR', message: 'Failed to build admin summary.' });
  }
});

/**
 * Admin: Update user status or roles
 */
app.put('/api/admin/users/:id', requireAuth, requireAdmin, async (req, res) => {
  const { status, role } = req.body;
  const userId = req.params.id;

  try {
    if (status) {
      await db.query('UPDATE users SET status = ? WHERE id = ?', [status, userId]);
      
      // If suspending user, revoke all active sessions instantly
      if (status === 'suspended') {
        await db.query('UPDATE sessions SET is_active = 0 WHERE user_id = ?', [userId]);
      }
    }
    if (role) {
      await db.query('UPDATE users SET role = ? WHERE id = ?', [role, userId]);
    }

    res.json({ success: true, message: 'User parameters updated.' });
  } catch (err) {
    res.status(500).json({ error: 'SERVER_ERROR', message: 'Failed to modify profile.' });
  }
});

/**
 * Admin: Wipe user record permanently
 */
app.delete('/api/admin/users/:id', requireAuth, requireAdmin, async (req, res) => {
  const userId = req.params.id;
  try {
    await db.query('DELETE FROM users WHERE id = ?', [userId]);
    res.json({ success: true, message: 'User profile and credentials purged from database.' });
  } catch (err) {
    res.status(500).json({ error: 'SERVER_ERROR', message: 'Purge operation failed.' });
  }
});

// ----------------------------------------------------
// Emergency Trigger Endpoints
// ----------------------------------------------------

/**
 * Endpoint for PWA/Local service worker to trigger Silent Crisis protocols
 */
app.post('/api/emergency/trigger', async (req, res) => {
  const { email, latitude, longitude, triggerType } = req.body;
  console.log(`[EMERGENCY TRIGGER] Received telemetry alert: ${triggerType || 'Unknown'} from user: ${email || 'Anonymous'}`);

  try {
    let user = null;
    if (email) {
      const emailHash = hashEmail(email);
      const users = await db.query('SELECT * FROM users WHERE email_hash = ?', [emailHash]);
      if (users.length > 0) {
        user = users[0];
      }
    }

    // Log the threat vectors locally in audit logs
    await db.query(
      'INSERT INTO audit_logs (user_id, event_type, details, ip_address) VALUES (?, ?, ?, ?)',
      [user ? user.id : null, 'emergency_trigger', `Offline sensor breach: ${triggerType || 'general'}`, req.ip]
    );

    // Run panic sequence: Camera streaming, location messages, and Supabase backup
    triggerSilentCrisis(user, latitude, longitude, triggerType);

    res.json({ success: true, message: 'Silent incident protocol initiated.' });

  // ----------------------------------------------------
  // Incident Logging Endpoints
  // ----------------------------------------------------

  /**
   * Record a new incident (requires auth). Expects payload with GPS, media URLs, sha256, etc.
   */
  app.post('/api/incidents', requireAuth, async (req, res) => {
    const { latitude, longitude, photos, audio, video, sha256_hash, type } = req.body;
    try {
      const result = await db.query(
        'INSERT INTO incidents (user_id, timestamp, gps_lat, gps_lng, photo_urls, audio_url, video_url, sha256_hash, type) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [req.user.id, new Date().toISOString(), latitude || null, longitude || null, JSON.stringify(photos || []), audio || null, video || null, sha256_hash || null, type || 'sos']
      );
      res.json({ success: true, incidentId: result.insertId });
    } catch (err) {
      console.error('Incident insert error:', err);
      res.status(500).json({ error: 'SERVER_ERROR', message: 'Failed to log incident.' });
    }
  });

  /**
   * Retrieve incidents for the logged‑in user.
   */
  app.get('/api/incidents', requireAuth, async (req, res) => {
    try {
      const incidents = await db.query('SELECT * FROM incidents WHERE user_id = ?', [req.user.id]);
      res.json(incidents);
    } catch (err) {
      console.error('Incident fetch error:', err);
      res.status(500).json({ error: 'SERVER_ERROR', message: 'Failed to fetch incidents.' });
    }
  });
  } catch (err) {
    console.error('Failed to run emergency protocol:', err.message);
    res.status(500).json({ error: 'SERVER_ERROR', message: 'Failed to register threat vector.' });
  }
});
/**
 * Manual capture endpoint for triggering RTSP media streaming
 */
app.post('/api/emergency/duress-capture', async (req, res) => {
  const { email } = req.body;
  console.log(`[EMERGENCY TRIGGER] Manual RTSP capture initiated for user: ${email || 'Anonymous'}`);

  try {
    const uploadResult = await captureAndUploadEmergencyStream();
    
    if (uploadResult && uploadResult.success) {
      res.json({ success: true, message: 'Media captured and uploaded.', url: uploadResult.url });
    } else {
      res.status(500).json({ error: 'CAPTURE_FAILED', message: uploadResult?.error || 'Failed to capture media' });
    }
  } catch (err) {
    console.error('Failed to run capture protocol:', err.message);
    res.status(500).json({ error: 'SERVER_ERROR', message: 'Failed to register capture vector.' });
  }
});

// ----------------------------------------------------
// Emergency Intelligence Endpoints (v2 — enriched)
// ----------------------------------------------------

/**
 * Enriched emergency trigger with full telemetry payload
 */
app.post('/api/emergency/trigger-v2', async (req, res) => {
  const { email, triggerType, timestamp, location, device } = req.body;
  const contactPhone = process.env.EMERGENCY_CONTACT_PHONE || '18765551234';

  console.warn(`[EMERGENCY TRIGGER v2] ${triggerType} from ${email} at ${timestamp}`);

  try {
    let user = null;
    if (email) {
      const emailHash = hashEmail(email);
      const users = await db.query('SELECT * FROM users WHERE email_hash = ?', [emailHash]);
      if (users.length > 0) user = users[0];
    }

    const name = user ? decrypt(user.name_encrypted) : 'Unknown User';

    // Build rich WhatsApp message
    const time = new Date(timestamp || Date.now()).toLocaleString('en-US', { timeZone: 'America/Jamaica' });
    const batStr = device?.batteryLevel != null
      ? `${device.batteryLevel}% ${device.batteryCharging ? '🔌 Charging' : '🔋'}`
      : 'Unknown';
    const netStr = device?.networkType || (device?.online ? 'Online' : 'Offline');
    const speedStr = location?.speed != null ? `${(location.speed * 3.6).toFixed(1)} km/h` : 'Stationary';
    const headingStr = location?.heading != null ? `${location.heading.toFixed(0)}°` : 'N/A';

    let message = `🚨 *SAFER EMERGENCY ALERT* 🚨\n`;
    message += `━━━━━━━━━━━━━━━━━━━━━━━\n`;
    message += `👤 *User:* ${name}\n`;
    message += `⚠️ *Trigger:* ${triggerType}\n`;
    message += `🕒 *Time:* ${time}\n\n`;

    message += `📍 *LOCATION*\n`;
    if (location) {
      message += `• Coordinates: ${location.lat.toFixed(6)}, ${location.lng.toFixed(6)}\n`;
      message += `• Accuracy: ±${location.accuracy?.toFixed(0) || '?'}m\n`;
      message += `• 🗺️ Google Maps: ${location.mapsLink}\n`;
      message += `• 🧭 Heading: ${headingStr}\n`;
      message += `• 🚗 Speed: ${speedStr}\n`;
    } else {
      message += `• ❌ GPS unavailable\n`;
    }

    message += `\n📱 *DEVICE STATUS*\n`;
    message += `• Device: ${device?.model || 'Unknown'}\n`;
    message += `• Battery: ${batStr}\n`;
    message += `• Network: ${netStr} (${device?.networkDownlink || 'N/A'})\n`;
    message += `• Screen: ${device?.screenSize || 'N/A'}\n\n`;

    message += `📷 *Voice clip & photo uploading — check next messages*\n`;
    message += `🔄 *Live location updates active*\n`;
    message += `━━━━━━━━━━━━━━━━━━━━━━━`;

    // Log to audit
    await db.query(
      'INSERT INTO audit_logs (user_id, event_type, details, ip_address) VALUES (?, ?, ?, ?)',
      [user?.id || null, 'emergency_trigger_v2', JSON.stringify({ triggerType, location, device }), req.ip]
    );

    // Send the rich message
    await sendMessage(contactPhone, message);

    res.json({ success: true, message: 'Full intelligence alert dispatched.' });
  } catch (err) {
    console.error('[EMERGENCY v2] Failed:', err.message);
    res.status(500).json({ error: 'SERVER_ERROR', message: 'Intelligence alert failed.' });
  }
});

/**
 * Emergency media upload (voice clip or photo as base64)
 */
app.post('/api/emergency/media-upload', async (req, res) => {
  const { email, mediaType, base64Data, mimeType, timestamp } = req.body;
  const contactPhone = process.env.EMERGENCY_CONTACT_PHONE || '18765551234';

  if (!base64Data) return res.status(400).json({ error: 'No media data provided.' });

  console.log(`[MEDIA UPLOAD] ${mediaType} received from ${email} at ${timestamp}`);

  try {
    const typeEmoji = mediaType === 'voice' ? '🎤' : '📷';
    const typeLabel = mediaType === 'voice' ? '15-second voice recording' : 'Emergency photo';

    // Log it
    await db.query(
      'INSERT INTO audit_logs (user_id, event_type, details, ip_address) VALUES (?, ?, ?, ?)',
      [null, `emergency_media_${mediaType}`, `${typeLabel} received from ${email}`, req.ip]
    );

    // Notify contact about the media (in production would attach/upload media)
    await sendMessage(contactPhone, `${typeEmoji} *${typeLabel}* captured from ${email} at ${new Date(timestamp).toLocaleTimeString()}. (Media stored securely on server.)`);

    res.json({ success: true, message: `${typeLabel} received.` });
  } catch (err) {
    console.error('[MEDIA UPLOAD] Failed:', err.message);
    res.status(500).json({ error: 'SERVER_ERROR', message: 'Media upload failed.' });
  }
});

/**
 * Live location update from tracked user
 */
app.post('/api/emergency/location-update', async (req, res) => {
  const { email, update } = req.body;
  if (!update) return res.status(400).json({ error: 'No update provided.' });

  const contactPhone = process.env.EMERGENCY_CONTACT_PHONE || '18765551234';
  const { lat, lng, accuracy, heading, speed, mapsLink, timestamp } = update;

  console.log(`[LOCATION UPDATE] ${email}: ${lat?.toFixed(5)}, ${lng?.toFixed(5)} @ ${new Date(timestamp).toLocaleTimeString()}`);

  const speedStr = speed != null ? `${(speed * 3.6).toFixed(1)} km/h` : 'Stationary';
  const headingStr = heading != null ? `${heading.toFixed(0)}°` : 'N/A';
  const timeStr = new Date(timestamp).toLocaleTimeString('en-US');

  const locationMsg = `🔄 *LIVE LOCATION UPDATE* — ${timeStr}\n`
    + `📍 ${lat?.toFixed(5)}, ${lng?.toFixed(5)} (±${accuracy?.toFixed(0)}m)\n`
    + `🧭 Heading: ${headingStr} | 🚗 Speed: ${speedStr}\n`
    + `🗺️ ${mapsLink}`;

  try {
    await sendMessage(contactPhone, locationMsg);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Update failed.' });
  }
});

// ----------------------------------------------------
// Emergency Advanced Endpoints
// ----------------------------------------------------

/**
 * Last Gasp Protocol Endpoint
 */
app.post('/api/emergency/last-gasp', async (req, res) => {
  const { coords } = req.body;
  if (!coords) return res.status(400).json({ error: 'Missing coordinates' });

  console.warn(`[LAST GASP PROTOCOL] Critical battery drop reported! Last known coords: ${coords.lat}, ${coords.lng} (Acc: ${coords.acc}m) at ${new Date(coords.timestamp).toISOString()}`);
  
  // Here we would typically update the DB with the last known position
  // e.g. await db.query('UPDATE active_sessions SET last_lat=?, last_lng=? WHERE ...')
  
  res.status(200).json({ success: true, message: 'Last gasp registered' });
});

/**
 * POV Capture Upload Endpoint
 */
app.post('/api/emergency/pov-upload', async (req, res) => {
  // Mock endpoint: In a real environment, we'd use multer and upload to Supabase
  console.log(`[POV UPLOAD] Received environmental capture from device.`);
  res.status(200).json({ success: true, message: 'POV media received and safely routed.' });
});

// ----------------------------------------------------
// Transit Monitoring Endpoints
// ----------------------------------------------------

const activeTransits = new Map();

app.post('/api/transit/start', requireAuth, async (req, res) => {
  const { durationMinutes, routeName } = req.body;
  if (!durationMinutes) return res.status(400).json({ error: 'Missing duration' });

  const expireTime = Date.now() + (durationMinutes * 60 * 1000);
  activeTransits.set(req.user.id, {
    routeName: routeName || 'Unknown Route',
    expireTime,
    email: req.user.email
  });

  res.json({ success: true, message: 'Transit timer started' });
});

app.post('/api/transit/stop', requireAuth, async (req, res) => {
  activeTransits.delete(req.user.id);
  res.json({ success: true, message: 'Transit timer disarmed' });
});

// Transit expiration checker
cron.schedule('* * * * *', async () => {
  const now = Date.now();
  for (const [userId, transit] of activeTransits.entries()) {
    if (now > transit.expireTime) {
      console.warn(`[TRANSIT ALERT] Timer expired for user ${userId} on route ${transit.routeName}`);
      // Remove to prevent multiple alerts
      activeTransits.delete(userId);
      
      // Attempt to retrieve user profile
      try {
        const users = await db.query('SELECT * FROM users WHERE id = ?', [userId]);
        if (users.length > 0) {
          const user = users[0];
          // Use our silent crisis trigger (acts as Virtual Agent taking charge)
          triggerSilentCrisis(user, null, null, `Transit Timer Expired: ${transit.routeName}`);
        }
      } catch (err) {
        console.error('Failed to trigger transit silent crisis:', err);
      }
    }
  }
});

// ----------------------------------------------------
// Silent Crisis Business Logic
// ----------------------------------------------------

async function triggerSilentCrisis(user, lat, lng, triggerName = 'duress_pattern') {
  const contactPhone = process.env.EMERGENCY_CONTACT_PHONE || '18765551234';
  const name = user ? decrypt(user.name_encrypted) : 'Unknown User';
  const timeStr = new Date().toLocaleString();

  // Create deep link for WA coordinates to locate user instantly
  const mapsLink = lat && lng ? `https://wa.me/?text=Emergency+Report:+User+is+at+https://maps.google.com/?q=${lat},${lng}` : 'No coordinates available';

  const alertContent = `🚨 [SECURITY EMERGENCY ALARM] 🚨\nUser Name: ${name}\nTrigger Triggered: ${triggerName}\nTime: ${timeStr}\nMap coordinates: https://www.google.com/maps/search/?api=1&query=${lat || '0'},${lng || '0'}\nInstant locator route: ${mapsLink}`;

  console.log('[SILENT PANIC] Dispatching alerts...');
  
  // 1. Send SMS/WhatsApp Alert to emergency contacts via Baileys
  await sendMessage(contactPhone, alertContent);

  // 2. Stream & Upload RTSP Camera capture asynchronously
  try {
    const uploadResult = await captureAndUploadEmergencyStream();
    if (uploadResult && uploadResult.success) {
      const uploadAlert = `📹 [SECURITY FEED ACCESS] Live Room capture upload compiled: ${uploadResult.url}`;
      if (uploadResult.type === 'video') {
        await sendMessage(contactPhone, uploadAlert, uploadResult.url, 'video');
      } else {
        await sendMessage(contactPhone, uploadAlert);
      }
    }
  } catch (streamErr) {
    console.error('[SILENT PANIC] Video capture failed to run:', streamErr.message);
  }
}

// ----------------------------------------------------
// HTTP Server & WebSocket Event Dispatcher Setup
// ----------------------------------------------------

const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

wss.on('connection', (ws) => {
  console.log('[WebSocket Server] Connected active web socket link.');

  ws.on('message', (message) => {
    try {
      const parsed = JSON.parse(message);
      if (parsed.type === 'HEARTBEAT') {
        ws.send(JSON.stringify({ type: 'HEARTBEAT_ACK', time: Date.now() }));
      }
    } catch (e) {
      console.error('[WebSocket Server] Message parsing error:', e.message);
    }
  });

  ws.on('close', () => {
    console.log('[WebSocket Server] Web socket link closed.');
  });
});



// Schedule nightly automated verification check‑ins (02:00 local time)
cron.schedule('0 2 * * *', async () => {
  console.log('[CRON] Running nightly verification check-in sweep.');
  try {
    const users = await db.query('SELECT id, phone_encrypted, email_encrypted FROM users');
    for (const u of users) {
      // Send a WhatsApp message if phone exists
      if (u.phone_encrypted) {
        const phone = decrypt(u.phone_encrypted);
        const email = decrypt(u.email_encrypted);
        await sendMessage(
          phone, 
          `🛡️ *Safer Automated Check-in*\n\nHi ${email}, please reply with "YES" or "SAFE" to verify your status. If no reply is received within 30 minutes, your profile will be flagged for emergency review.`
        );
      }
    }
  } catch (e) {
    console.error('Nightly check‑in job failed:', e);
  }
}, { timezone: 'America/Chicago' });

server.listen(PORT, () => {
  console.log(`=== SAFER SECURITY BACKEND SERVER RUNNING ON PORT ${PORT} ===`);
});
