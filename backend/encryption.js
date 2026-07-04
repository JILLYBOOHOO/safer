const crypto = require('crypto');
require('dotenv').config();

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;
const TAG_LENGTH = 16;

// Key MUST be exactly 32 bytes (64 hex characters)
const ENCRYPTION_KEY = Buffer.from(
  process.env.DB_ENCRYPTION_KEY || '643765327438392f413d4547444b4c4d4e4f505152535455565758595a616263',
  'hex'
);

/**
 * Encrypts cleartext using AES-256-GCM.
 * Output format: iv_hex:authTag_hex:ciphertext_hex
 */
function encrypt(text) {
  if (!text) return '';
  try {
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ALGORITHM, ENCRYPTION_KEY, iv);
    
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    const tag = cipher.getAuthTag().toString('hex');
    
    return `${iv.toString('hex')}:${tag}:${encrypted}`;
  } catch (error) {
    console.error('Encryption failed:', error);
    throw new Error('Encryption failed');
  }
}

/**
 * Decrypts ciphertext using AES-256-GCM.
 * Input format: iv_hex:authTag_hex:ciphertext_hex
 */
function decrypt(encryptedText) {
  if (!encryptedText) return '';
  try {
    const parts = encryptedText.split(':');
    if (parts.length !== 3) {
      throw new Error('Invalid encrypted text format');
    }
    
    const iv = Buffer.from(parts[0], 'hex');
    const tag = Buffer.from(parts[1], 'hex');
    const encrypted = parts[2];
    
    const decipher = crypto.createDecipheriv(ALGORITHM, ENCRYPTION_KEY, iv);
    decipher.setAuthTag(tag);
    
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  } catch (error) {
    console.error('Decryption failed:', error);
    // Return masked value in case decryption fails to prevent crash
    return '[DECRYPTION_ERROR]';
  }
}

/**
 * Creates SHA-256 hash of an email to perform direct index lookups in MySQL
 * without decrypting the whole database.
 */
function hashEmail(email) {
  if (!email) return '';
  return crypto.createHash('sha256').update(email.toLowerCase().trim()).digest('hex');
}

module.exports = {
  encrypt,
  decrypt,
  hashEmail
};
