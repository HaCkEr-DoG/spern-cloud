const admin = require('firebase-admin');

let initialized = false;

function initFirebase() {
  if (initialized) return;
  const decoded = Buffer.from(process.env.FIREBASE_KEY_BASE64, 'base64').toString('utf8');
  const serviceAccount = JSON.parse(decoded);
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
  initialized = true;
}

async function notifyAllResponders(responders, emergencyCase) {
  initFirebase();
  const tokens = responders.map(r => r.fcmToken).filter(Boolean);
  if (tokens.length === 0) { console.log('No FCM tokens'); return; }

  const message = {
    tokens,
    notification: {
      title: 'SPERN EMERGENCY',
      body: `Case ${emergencyCase.caseId} — tap to respond`
    },
    data: {
      caseId: emergencyCase.caseId,
      lat: String(emergencyCase.gps.lat),
      lng: String(emergencyCase.gps.lng),
      confidence: String(emergencyCase.confidence)
    },
    android: { priority: 'high' }
  };

  const response = await admin.messaging().sendEachForMulticast(message);
  console.log(`Notified ${response.successCount} responders`);
}

module.exports = { notifyAllResponders };
