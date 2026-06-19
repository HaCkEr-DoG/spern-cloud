const admin = require('firebase-admin');

let initialized = false;

/**
 * Initialize Firebase Admin SDK
 */
function initFirebase() {
  if (initialized) return;

  if (!process.env.FIREBASE_KEY_BASE64) {
    throw new Error('FIREBASE_KEY_BASE64 environment variable is not set');
  }

  const decoded = Buffer.from(
    process.env.FIREBASE_KEY_BASE64,
    'base64'
  ).toString('utf8');

  const serviceAccount = JSON.parse(decoded);

  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });

  initialized = true;
  console.log('✅ Firebase Admin SDK initialized');
}

/**
 * Notify all responders about an emergency
 * @param {Array} responders - Array of responder documents with fcmToken
 * @param {Object} emergencyCase - Emergency case object
 * @returns {Promise<Object>} Response with successCount and failureCount
 */
async function notifyAllResponders(responders, emergencyCase) {
  try {
    initFirebase();

    // Extract valid FCM tokens
    const tokens = responders
      .map(r => r.fcmToken)
      .filter(Boolean);

    if (tokens.length === 0) {
      console.log('⚠️  No valid FCM tokens found for responders');
      return {
        successCount: 0,
        failureCount: 0,
        message: 'No responders with valid FCM tokens'
      };
    }

    console.log(`📲 Sending FCM notifications to ${tokens.length} responders`);

    // Construct FCM message
    const message = {
      tokens,
      notification: {
        title: '🚨 SPERN Emergency',
        body: 'Emergency near you. Tap to respond.'
      },
      data: {
        caseId: emergencyCase.caseId,
        lat: String(emergencyCase.gps.lat),
        lng: String(emergencyCase.gps.lng),
        confidence: String(emergencyCase.confidence),
        speed: String(emergencyCase.speed || 0)
      },
      android: {
        priority: 'high',
        notification: {
          sound: 'default',
          clickAction: 'FLUTTER_NOTIFICATION_CLICK'
        }
      },
      apns: {
        headers: {
          'apns-priority': '10'
        },
        payload: {
          aps: {
            sound: 'default',
            badge: 1
          }
        }
      }
    };

    // Send multicast message
    const response = await admin.messaging()
      .sendEachForMulticast(message);

    console.log(
      `✅ FCM sent: ${response.successCount}/${tokens.length} successful, ${response.failureCount} failed`
    );

    // Log failed sends
    if (response.failureCount > 0) {
      response.responses.forEach((resp, index) => {
        if (!resp.success) {
          console.warn(`   ⚠️  Token ${index}: ${resp.error?.message}`);
        }
      });
    }

    return {
      successCount: response.successCount,
      failureCount: response.failureCount,
      message: `Notified ${response.successCount}/${tokens.length} responders`
    };

  } catch (err) {
    console.error(`❌ Firebase error: ${err.message}`);
    throw err;
  }
}

module.exports = {
  notifyAllResponders,
  initFirebase
};
