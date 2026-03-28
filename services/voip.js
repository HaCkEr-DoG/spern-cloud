async function openVoipBridge(emergencyCase, responder) {
  console.log(`Direct call initiated`);
  console.log(`Doctor: ${responder.name} | ${responder.phone}`);
  console.log(`Device SIM number: ${process.env.ESP32_GSM_NUMBER}`);
  console.log(`Doctor should call: ${process.env.ESP32_GSM_NUMBER}`);
  return { success: true };
}

module.exports = { openVoipBridge };