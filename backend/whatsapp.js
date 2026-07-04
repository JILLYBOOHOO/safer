// Polyfill global crypto for Baileys compatibility on Node 18 (not globally exposed by default)
if (typeof globalThis.crypto === 'undefined') {
  globalThis.crypto = require('crypto').webcrypto;
}

const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const qrcode = require('qrcode-terminal');
const path = require('path');
const fs = require('fs');

let sock = null;
let isInitializing = false;

async function connectToWhatsApp() {
  if (sock || isInitializing) return;
  isInitializing = true;

  try {
    const authFolder = path.join(__dirname, '.auth_info');
    if (!fs.existsSync(authFolder)) {
      fs.mkdirSync(authFolder, { recursive: true });
    }

    const { state, saveCreds } = await useMultiFileAuthState(authFolder);

    sock = makeWASocket({
      auth: state,
      printQRInTerminal: true,
      defaultQueryTimeoutMs: 60000,
      connectTimeoutMs: 60000
    });

    sock.ev.on('connection.update', (update) => {
      const { connection, lastDisconnect, qr } = update;

      if (qr) {
        console.log('\n--- SCAN THIS WHATSAPP QR CODE TO CONNECT THE SECURITY CLIENT ---');
        qrcode.generate(qr, { small: true });
        console.log('-----------------------------------------------------------------\n');
      }

      if (connection === 'close') {
        const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
        console.log('WhatsApp connection closed due to ', lastDisconnect?.error, ', reconnecting: ', shouldReconnect);
        sock = null;
        isInitializing = false;
        if (shouldReconnect) {
          connectToWhatsApp();
        }
      } else if (connection === 'open') {
        console.log('WhatsApp connection established successfully!');
        isInitializing = false;
      }
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('messages.upsert', async (m) => {
      if (m.type === 'notify') {
        for (const msg of m.messages) {
          if (!msg.key.fromMe && msg.message) {
            const text = msg.message.conversation || msg.message.extendedTextMessage?.text || '';
            const sender = msg.key.remoteJid;
            
            if (/^(yes|safe)$/i.test(text.trim())) {
              console.log(`[WhatsApp Agent] Received SAFE check-in from ${sender}`);
              
              // Resolve checkin flags in DB
              const db = require('./db');
              const { encrypt, hashEmail } = require('./encryption');
              
              try {
                // Remove @s.whatsapp.net to get raw number
                const rawNum = sender.split('@')[0];
                // Check if user exists with this phone (simplification for memory DB)
                const users = await db.query('SELECT id, phone_encrypted FROM users');
                for (const u of users) {
                  if (u.phone_encrypted) {
                    const decryptedPhone = require('./encryption').decrypt(u.phone_encrypted);
                    if (decryptedPhone.replace(/[^0-9]/g, '') === rawNum) {
                      // Found user, resolve check-in
                      await db.query('UPDATE checkins SET flagged = 0 WHERE user_id = ? AND flagged = 1', [u.id]);
                      await sendMessage(rawNum, '✅ Identity verified. Your check-in has been logged. Have a safe night!');
                      break;
                    }
                  }
                }
              } catch (err) {
                console.error('[WhatsApp Agent] Failed to process incoming check-in:', err);
              }
            }
          }
        }
      }
    });

  } catch (error) {
    console.error('Failed to initialize Baileys WhatsApp client:', error);
    isInitializing = false;
  }
}

// Fire-and-forget socket connection loop
connectToWhatsApp();

/**
 * Sends a message via Baileys WhatsApp Socket.
 * Falls back to server console logs if WhatsApp is not paired/configured.
 */
async function sendMessage(phoneNumber, textMessage, mediaUrl = null, mediaType = 'video') {
  console.log(`[WhatsApp API Dispatch Queue] Sending to: ${phoneNumber} -> Content: "${textMessage}" | Media: ${mediaUrl}`);
  
  if (!sock) {
    console.warn('WhatsApp service offline or connecting. Alert outputted to terminal output logs.');
    return false;
  }

  try {
    // Format number to JID: e.g. 18765551234@s.whatsapp.net
    let formattedNum = phoneNumber.replace(/[^0-9]/g, '');
    if (!formattedNum.endsWith('@s.whatsapp.net')) {
      formattedNum = `${formattedNum}@s.whatsapp.net`;
    }

    if (mediaUrl) {
      if (mediaType === 'video') {
        await sock.sendMessage(formattedNum, { video: { url: mediaUrl }, caption: textMessage });
      } else if (mediaType === 'audio') {
        await sock.sendMessage(formattedNum, { audio: { url: mediaUrl }, mimetype: 'audio/mp4' });
      } else if (mediaType === 'image') {
        await sock.sendMessage(formattedNum, { image: { url: mediaUrl }, caption: textMessage });
      }
    } else {
      await sock.sendMessage(formattedNum, { text: textMessage });
    }
    return true;
  } catch (err) {
    console.error('Failed to dispatch WhatsApp message via Baileys:', err.message);
    return false;
  }
}

module.exports = {
  sendMessage,
  connectToWhatsApp
};
