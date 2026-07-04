-- Database setup schema for Safer security architecture

CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name_encrypted VARCHAR(512) NOT NULL,
  email_encrypted VARCHAR(512) NOT NULL,
  email_hash VARCHAR(64) UNIQUE NOT NULL, -- used for lookups without decrypting everything
  password_hash VARCHAR(255) NOT NULL,
  safe_pattern VARCHAR(255) NOT NULL,
  duress_pattern VARCHAR(255) NOT NULL,
  role VARCHAR(50) DEFAULT 'user',
  home_wifi_ssid VARCHAR(100) NULL,
  home_gps_lat DOUBLE NULL,
  home_gps_lng DOUBLE NULL,
  auth_level INT DEFAULT 1,
  status VARCHAR(20) DEFAULT 'active', -- 'active' or 'suspended'
  phone_encrypted VARCHAR(512) NULL,
  age INT NULL,
  auth_method VARCHAR(50) DEFAULT 'passcode',
  name_hash VARCHAR(64) UNIQUE NULL,
  home_address_encrypted TEXT NULL,
  medical_card_encrypted TEXT NULL,
  emergency_contact_encrypted TEXT NULL,
  frequent_places_encrypted TEXT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS family_links (
  id INT AUTO_INCREMENT PRIMARY KEY,
  guardian_user_id INT NOT NULL,
  dependent_user_id INT NOT NULL,
  relationship VARCHAR(50) NOT NULL, -- e.g., 'parent', 'child', 'spouse'
  status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'accepted'
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (guardian_user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (dependent_user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS failed_logins (
  id INT AUTO_INCREMENT PRIMARY KEY,
  email_hash VARCHAR(64) NOT NULL,
  attempts INT DEFAULT 0,
  last_attempt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  locked_until TIMESTAMP NULL,
  INDEX idx_email_hash (email_hash)
);

CREATE TABLE IF NOT EXISTS sessions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  token_hash VARCHAR(64) UNIQUE NOT NULL,
  device_fingerprint VARCHAR(255) NOT NULL,
  ip_address VARCHAR(45) NOT NULL,
  location_name VARCHAR(100) DEFAULT 'Unknown',
  is_active TINYINT(1) DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  last_active TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NULL,
  event_type VARCHAR(100) NOT NULL, -- 'login_failed', 'biometric_error', 'dead_phone_trigger', 'duress_activated'
  details TEXT NULL,
  ip_address VARCHAR(45) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS support_tickets (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT NOT NULL,
  metadata_json TEXT NOT NULL, -- diagnostics (UserAgent, layout sizes, cache metrics)
  status VARCHAR(50) DEFAULT 'open',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

-- Pruning database event scheduler configuration
SET GLOBAL event_scheduler = ON;

DROP EVENT IF EXISTS prune_telemetry_event;
CREATE EVENT prune_telemetry_event
ON SCHEDULE EVERY 1 HOUR
DO
  DELETE FROM audit_logs 
  WHERE created_at < NOW() - INTERVAL 48 HOUR;

CREATE TABLE IF NOT EXISTS emergency_routes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  human_contact TEXT,
  bot_contact TEXT,
  fallback_seconds INTEGER DEFAULT 60,
  UNIQUE(user_id)
);

CREATE TABLE IF NOT EXISTS transit_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  start_time TEXT NOT NULL,
  end_time TEXT,
  path TEXT,            -- JSON array of {lat, lng, timestamp, speed, battery_level}
  flagged INTEGER DEFAULT 0,
  last_battery_level INT NULL,
  last_speed DOUBLE NULL
);

CREATE TABLE IF NOT EXISTS checkins (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  checkin_time TEXT NOT NULL,
  flagged INTEGER DEFAULT 0
);
