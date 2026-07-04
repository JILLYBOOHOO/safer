const db = require('./db');
const { hashEmail } = require('./encryption');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const JWT_SECRET = process.env.JWT_SECRET || 'super_secret_session_token_key_change_me_in_production';

/**
 * 3-5-6 Lockout Matrix Middleware
 * Enforces cooldown timers and lock states based on failed authentication attempts.
 */
async function enforceLockout(req, res, next) {
  const { email } = req.body;
  if (!email) return next();

  const emailHash = hashEmail(email);

  try {
    const records = await db.query(
      'SELECT * FROM failed_logins WHERE email_hash = ?',
      [emailHash]
    );

    if (records.length > 0) {
      const record = records[0];
      const now = new Date();

      // Check if current date is inside lockout period
      if (record.locked_until && new Date(record.locked_until) > now) {
        const secondsLeft = Math.ceil((new Date(record.locked_until) - now) / 1000);
        return res.status(423).json({
          error: 'ACCOUNT_LOCKED',
          message: `This account has been locked. Please retry in ${secondsLeft} seconds or request a verification OTP.`,
          lockedUntil: record.locked_until,
          attempts: record.attempts
        });
      }

      // Check if attempt count is frozen at 6
      if (record.attempts >= 6) {
        return res.status(403).json({
          error: 'ACCOUNT_FROZEN',
          message: 'Security validation limit reached. Password reset is mandatory to unlock access.',
          attempts: record.attempts
        });
      }
    }
    next();
  } catch (err) {
    console.error('Lockout matrix error:', err);
    next();
  }
}

/**
 * Updates authentication attempt counters on validation failure.
 */
async function recordFailedAttempt(email) {
  const emailHash = hashEmail(email);

  try {
    const records = await db.query(
      'SELECT * FROM failed_logins WHERE email_hash = ?',
      [emailHash]
    );

    let attempts = 1;
    let lockedUntil = null;
    let warning = false;

    if (records.length > 0) {
      const record = records[0];
      attempts = record.attempts + 1;

      // Lockout Matrix Logic:
      // Attempt 3: Issue warning
      if (attempts === 3) {
        warning = true;
      }
      // Attempt 5: Enforce 5-minute database cooldown lock
      else if (attempts === 5) {
        lockedUntil = new Date(Date.now() + 5 * 60 * 1000);
      }
      // Attempt 6: Freeze credentials permanently (until OTP verification)
      else if (attempts >= 6) {
        attempts = 6; // Cap attempts
      }
    }

    await db.query(
      'REPLACE INTO failed_logins (email_hash, attempts, locked_until) VALUES (?, ?, ?)',
      [emailHash, attempts, lockedUntil]
    );

    // Audit logs entry
    await db.query(
      'INSERT INTO audit_logs (user_id, event_type, details, ip_address) VALUES (NULL, ?, ?, ?)',
      ['login_failed', `Failed attempt #${attempts} for hashed user: ${emailHash}`, 'unknown']
    );

    return { attempts, lockedUntil, warning };
  } catch (err) {
    console.error('Failed to log authentication attempt:', err);
    return { attempts: 1, lockedUntil: null, warning: false };
  }
}

/**
 * Resets lockout credentials back to 0 on successful OTP verification/login.
 */
async function resetFailedAttempts(email) {
  const emailHash = hashEmail(email);
  try {
    await db.query('DELETE FROM failed_logins WHERE email_hash = ?', [emailHash]);
  } catch (err) {
    console.error('Failed to reset account attempts:', err);
  }
}

/**
 * Risk Evaluation Engine Middleware
 * Validates SSID, GPS, and User Agent fingerprints to establish the required auth tier.
 */
function evaluateRiskLevel(req, res, next) {
  const { ssid, latitude, longitude, fingerprint } = req.body;
  const user = req.user; // Set if previously authenticated via JWT
  
  let baseScore = 1; // Default: Level 1 (Biometrics only / Home setup)

  // Environmental rules mapping
  if (user) {
    const isHomeWifi = user.home_wifi_ssid && ssid === user.home_wifi_ssid;
    const isHomeGps = user.home_gps_lat && user.home_gps_lng && latitude && longitude &&
      Math.abs(latitude - user.home_gps_lat) < 0.0005 &&
      Math.abs(longitude - user.home_gps_lng) < 0.0005;

    // Suppress friction to Level 1 if home parameters match
    if (isHomeWifi || isHomeGps) {
      req.riskLevel = 1;
      return next();
    }
  }

  // Location parameters change or unrecognized fingerprint elevation rule
  if (!ssid && (!latitude || !longitude)) {
    baseScore = 2; // Biometric + Pattern
  }

  // Escalate to Level 3 if fingerprint is missing or location criteria changes completely
  if (!fingerprint) {
    baseScore = 3; // Passphrase required
  }

  req.riskLevel = Math.max(baseScore, req.body.requestedLevel || 1);
  next();
}

/**
 * Authentication check middleware validating JWT header
 */
async function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'UNAUTHORIZED', message: 'No session token provided.' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    
    // Query db to check if session token is still active (not revoked)
    const tokenHash = hashEmail(token); // Use simple secure string mapping
    const sessions = await db.query(
      'SELECT * FROM sessions WHERE token_hash = ? AND is_active = 1',
      [tokenHash]
    );

    if (sessions.length === 0) {
      return res.status(401).json({ error: 'SESSION_REVOKED', message: 'This remote session has been invalidated.' });
    }

    const users = await db.query('SELECT * FROM users WHERE id = ?', [decoded.userId]);
    if (users.length === 0 || users[0].status === 'suspended') {
      return res.status(403).json({ error: 'USER_SUSPENDED', message: 'Your profile has been locked by admin.' });
    }

    req.user = users[0];
    req.session = sessions[0];
    next();
  } catch (err) {
    return res.status(401).json({ error: 'SESSION_EXPIRED', message: 'Session validation token expired.' });
  }
}

/**
 * Admin permissions validation middleware
 */
function requireAdmin(req, res, next) {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ error: 'FORBIDDEN', message: 'Administrative access clearance required.' });
  }
  next();
}

module.exports = {
  enforceLockout,
  recordFailedAttempt,
  resetFailedAttempts,
  evaluateRiskLevel,
  requireAuth,
  requireAdmin
};
