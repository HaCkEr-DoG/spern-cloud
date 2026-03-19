const admin = require('firebase-admin');
const serviceAccount = require('../firebase-key.json');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

async function notifyAllResponders(responders, emergencyCase) {
  const tokens = responders.map(r => r.fcmToken).filter(Boolean);

  if (tokens.length === 0) {
    console.log('No responder FCM tokens found');
    return;
  }

  const message = {
    tokens,
    notification: {
      title: 'SPERN EMERGENCY',
      body: `Case ${emergencyCase.caseId} — tap to respond immediately`
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
  console.log(`Notified ${response.successCount} responders successfully`);
}

module.exports = { notifyAllResponders };