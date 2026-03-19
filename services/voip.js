const twilio = require('twilio');

async function openVoipBridge(emergencyCase, responderPhone) {
  const client = twilio(
    process.env.TWILIO_SID,
    process.env.TWILIO_TOKEN
  );

  await client.calls.create({
    to: responderPhone,
    from: process.env.TWILIO_NUMBER,
    twiml: `
      <Response>
        <Say voice="alice">
          SPERN emergency alert.
          Case ${emergencyCase.caseId}.
          Connecting you to the vehicle now.
          Please stay on the line.
        </Say>
        <Dial>
          <Number>${process.env.ESP32_GSM_NUMBER}</Number>
        </Dial>
      </Response>
    `
  });

  console.log(`VoIP bridge opened to ${responderPhone}`);
}

module.exports = { openVoipBridge };