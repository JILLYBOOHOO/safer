const webpush = require('web-push');
const admin = require('firebase-admin');

// Initialize Firebase Admin (optional, uses env vars)
if (process.env.FIREBASE_SERVICE_ACCOUNT) {
  const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    storageBucket: process.env.FIREBASE_STORAGE_BUCKET
  });
}

// Web Push VAPID keys – must be set in .env
const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY;
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY;
if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(
    'mailto:admin@safer.app',
    VAPID_PUBLIC_KEY,
    VAPID_PRIVATE_KEY
  );
}

// Helper to send push notification to a stored subscription (placeholder implementation)
async function sendPush(userId, payload) {
  try {
    // Fetch subscription from DB (assume table push_subscriptions exists)
    const rows = await db.query('SELECT subscription_json FROM push_subscriptions WHERE user_id = ?', [userId]);
    if (!rows.length) return console.warn('No push subscription for user', userId);
    const subscription = JSON.parse(rows[0].subscription_json);
    await webpush.sendNotification(subscription, JSON.stringify(payload));
    console.log('Push sent to user', userId);
  } catch (err) {
    console.error('Push notification error:', err);
  }
}
