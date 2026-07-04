const mysql = require('mysql2/promise');
const crypto = require('crypto');
require('dotenv').config();

const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'safer_db',
  port: parseInt(process.env.DB_PORT || '3306'),
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  ssl: {
    rejectUnauthorized: false // Required for Aiven SSL connections
  }
};

let pool;
let useMemoryFallback = false;

// In-memory mock database to make the app fully functional and runnable out-of-the-box
const memoryDb = {
  users: [],
  failed_logins: {},
  sessions: [],
  audit_logs: [],
  support_tickets: [],
  incidents: []
};

// Initialize connection
async function initDb() {
  try {
    pool = mysql.createPool(dbConfig);
    // Simple connection check
    const connection = await pool.getConnection();
    console.log('Successfully connected to MySQL database (SSL handshake forced).');
    connection.release();
  } catch (err) {
    console.warn('MySQL connection failed. Falling back to secure In-Memory database for testing and execution.');
    console.warn(`Error detail: ${err.message}`);
    useMemoryFallback = true;
  }
}

initDb();

// Generic query executor mapping MySQL syntax to local memory operations for local portability
async function query(sql, params = []) {
  if (!useMemoryFallback) {
    try {
      const [results] = await pool.query(sql, params);
      return results;
    } catch (err) {
      console.error('MySQL query error, using fallback:', err.message);
      // Fallback if DB drops in runtime
      useMemoryFallback = true;
    }
  }

  // Memory Db logic: parse SQL queries to satisfy core backend operations
  const sqlNormalized = sql.toLowerCase().trim().replace(/\s+/g, ' ');

  if (sqlNormalized.startsWith('insert into users')) {
    // Supports two call shapes:
    // 8-param  (old): name_enc, email_enc, email_hash, pw_hash, safe, duress, role, auth_level
    // 12-param: name_enc, email_enc, email_hash, pw_hash, safe, duress, role, auth_level, phone_enc, age, auth_method, name_hash
    const id = memoryDb.users.length + 1;
    const isNew = params.length >= 11;
    const user = {
      id,
      name_encrypted:  params[0],
      email_encrypted: params[1],
      email_hash:      params[2],
      password_hash:   params[3],
      safe_pattern:    params[4],
      duress_pattern:  params[5],
      role:            params[6] || 'user',
      auth_level:      params[7] || 1,
      phone_encrypted: isNew ? (params[8] || null) : null,
      age:             isNew ? (params[9] || null) : null,
      auth_method:     isNew ? (params[10] || 'passcode') : 'passcode',
      name_hash:       params.length >= 12 ? params[11] : null,
      home_wifi_ssid:  null,
      home_gps_lat:    null,
      home_gps_lng:    null,
      home_address_encrypted: null,
      medical_card_encrypted: null,
      emergency_contact_encrypted: null,
      frequent_places_encrypted: null,
      status: 'active',
      created_at: new Date()
    };
    memoryDb.users.push(user);
    return { insertId: id, affectedRows: 1 };

  } else if (sqlNormalized.startsWith('select * from users where email_hash = ? or name_hash = ?')) {
    const hash = params[0];
    const user = memoryDb.users.find(u => u.email_hash === hash || (u.name_hash && u.name_hash === hash));
    return user ? [user] : [];

  } else if (sqlNormalized.startsWith('select auth_level, home_wifi_ssid, home_gps_lat, home_gps_lng from users where email_hash = ? or name_hash = ?')) {
    const hash = params[0];
    const user = memoryDb.users.find(u => u.email_hash === hash || (u.name_hash && u.name_hash === hash));
    if (!user) return [];
    return [{
      auth_level: user.auth_level,
      home_wifi_ssid: user.home_wifi_ssid,
      home_gps_lat: user.home_gps_lat,
      home_gps_lng: user.home_gps_lng
    }];

  } else if (sqlNormalized.startsWith('select * from users where email_hash =')) {
    const hash = params[0];
    const user = memoryDb.users.find(u => u.email_hash === hash);
    return user ? [user] : [];

  } else if (sqlNormalized.startsWith('select * from users where id =')) {
    const id = parseInt(params[0]);
    const user = memoryDb.users.find(u => u.id === id);
    return user ? [user] : [];

  } else if (sqlNormalized.startsWith('update users set')) {
    const id = params[params.length - 1];
    const userIndex = memoryDb.users.findIndex(u => u.id === parseInt(id));
    if (userIndex !== -1) {
      if (sqlNormalized.includes('status =')) {
        memoryDb.users[userIndex].status = params[0];
      } else if (sqlNormalized.includes('auth_level =')) {
        memoryDb.users[userIndex].auth_level = params[0];
      } else {
        const setPart = sqlNormalized.split('where')[0].replace('update users set', '');
        const fields = setPart.split(',').map(part => part.split('=')[0].trim());
        fields.forEach((field, index) => {
          memoryDb.users[userIndex][field] = params[index];
        });
      }
      return { affectedRows: 1 };
    }
    return { affectedRows: 0 };

  } else if (sqlNormalized.startsWith('select * from failed_logins where email_hash =')) {
    const hash = params[0];
    const record = memoryDb.failed_logins[hash];
    return record ? [record] : [];

  } else if (sqlNormalized.startsWith('insert into failed_logins') || sqlNormalized.startsWith('replace into failed_logins')) {
    // REPLACE INTO failed_logins (email_hash, attempts, locked_until) VALUES (?, ?, ?)
    const hash = params[0];
    const attempts = params[1];
    const locked_until = params[2];
    memoryDb.failed_logins[hash] = {
      email_hash: hash,
      attempts: parseInt(attempts),
      locked_until: locked_until,
      last_attempt: new Date()
    };
    return { affectedRows: 1 };

  } else if (sqlNormalized.startsWith('delete from failed_logins')) {
    const hash = params[0];
    delete memoryDb.failed_logins[hash];
    return { affectedRows: 1 };

  } else if (sqlNormalized.startsWith('insert into sessions')) {
    // INSERT INTO sessions (user_id, token_hash, device_fingerprint, ip_address, location_name) VALUES (?, ?, ?, ?, ?)
    const id = memoryDb.sessions.length + 1;
    const session = {
      id,
      user_id: params[0],
      token_hash: params[1],
      device_fingerprint: params[2],
      ip_address: params[3],
      location_name: params[4] || 'Unknown',
      is_active: 1,
      created_at: new Date(),
      last_active: new Date()
    };
    memoryDb.sessions.push(session);
    return { insertId: id, affectedRows: 1 };

  } else if (sqlNormalized.startsWith('select s.*, u.role')) {
    // Join logic sessions + users
    return memoryDb.sessions
      .filter(s => s.is_active === 1)
      .map(s => {
        const u = memoryDb.users.find(user => user.id === s.user_id);
        return { ...s, role: u ? u.role : 'user' };
      });

  } else if (sqlNormalized.startsWith('select * from sessions where token_hash =')) {
    const token = params[0];
    const session = memoryDb.sessions.find(s => s.token_hash === token && s.is_active === 1);
    return session ? [session] : [];

  } else if (sqlNormalized.startsWith('select id, device_fingerprint, ip_address, location_name, created_at, last_active from sessions where user_id =')) {
    const userId = parseInt(params[0]);
    return memoryDb.sessions.filter(s => s.user_id === userId && s.is_active === 1).map(s => ({
      id: s.id, device_fingerprint: s.device_fingerprint, ip_address: s.ip_address,
      location_name: s.location_name, created_at: s.created_at, last_active: s.last_active
    }));

  } else if (sqlNormalized.startsWith('select * from sessions where user_id =')) {
    const userId = parseInt(params[0]);
    return memoryDb.sessions.filter(s => s.user_id === userId && s.is_active === 1);

  } else if (sqlNormalized.startsWith('update sessions set is_active = 0 where user_id =')) {
    const userId = parseInt(params[0]);
    memoryDb.sessions.forEach(s => {
      if (s.user_id === userId) s.is_active = 0;
    });
    return { affectedRows: 1 };

  } else if (sqlNormalized.startsWith('update sessions set is_active = 0 where token_hash =')) {
    const token = params[0];
    const session = memoryDb.sessions.find(s => s.token_hash === token);
    if (session) {
      session.is_active = 0;
      return { affectedRows: 1 };
    }
    return { affectedRows: 0 };

  } else if (sqlNormalized.startsWith('insert into audit_logs')) {
    // INSERT INTO audit_logs (user_id, event_type, details, ip_address) VALUES (?, ?, ?, ?)
    const id = memoryDb.audit_logs.length + 1;
    const log = {
      id,
      user_id: params[0],
      event_type: params[1],
      details: params[2],
      ip_address: params[3],
      created_at: new Date()
    };
    memoryDb.audit_logs.push(log);
    return { insertId: id, affectedRows: 1 };

  } else if (sqlNormalized.startsWith('select * from audit_logs')) {
    // Sorted by created_at desc
    return [...memoryDb.audit_logs].reverse();

  } else if (sqlNormalized.startsWith('insert into support_tickets')) {
    // INSERT INTO support_tickets (user_id, title, description, metadata_json) VALUES (?, ?, ?, ?)
    const id = memoryDb.support_tickets.length + 1;
    const ticket = {
      id,
      user_id: params[0],
      title: params[1],
      description: params[2],
      metadata_json: params[3],
      status: 'open',
      created_at: new Date()
    };
    memoryDb.support_tickets.push(ticket);
    return { insertId: id, affectedRows: 1 };

  } else if (sqlNormalized.startsWith('select * from support_tickets')) {
    return [...memoryDb.support_tickets].reverse();

  } else if (sqlNormalized.startsWith('select') && sqlNormalized.includes('from users')) {
    // Handle COUNT(*) query specifically
    if (sqlNormalized.includes('count(*)')) {
      return [{ count: memoryDb.users.length }];
    }
    // Handle SELECT id FROM users WHERE email_hash = ?
    if (sqlNormalized.includes('email_hash =') && sqlNormalized.includes('select id')) {
      const hash = params[0];
      const user = memoryDb.users.find(u => u.email_hash === hash);
      return user ? [{ id: user.id }] : [];
    }
    // Get all users (admin dashboard)
    return memoryDb.users;
  } else if (sqlNormalized.startsWith('insert into incidents')) {
    const incident = {
      id: memoryDb.incidents.length + 1,
      user_id: params[0],
      timestamp: new Date(),
      gps_lat: params[1] || null,
      gps_lng: params[2] || null,
      photo_urls: params[3] ? JSON.parse(params[3]) : [],
      audio_url: params[4] || null,
      video_url: params[5] || null,
      sha256_hash: params[6] || null,
      type: params[7] || 'sos'
    };
    memoryDb.incidents.push(incident);
    return { insertId: incident.id, affectedRows: 1 };
  } else if (sqlNormalized.startsWith('select * from incidents where user_id =')) {
    const uid = parseInt(params[0]);
    return memoryDb.incidents.filter(i => i.user_id === uid);
  } else if (sqlNormalized.startsWith('select * from incidents')) {
    return memoryDb.incidents;
  }

  console.warn(`Unmatched memory database SQL fallback: "${sql}"`);
  return [];
}

module.exports = {
  query,
  isFallback: () => useMemoryFallback
};
