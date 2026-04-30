const express = require('express');
const router = express.Router();
const Case = require('../models/Case');

// ESP32 posts here when emergency confirmed
router.post('/alert', async (req, res) => {
  try {
    const { caseId, lat, lng, speed, confidence, seatCount } = req.body;

    const newCase = await Case.create({
      caseId,
      gps: { lat, lng },
      speed,
      confidence,
      seatCount
    });

    console.log(`Case created: ${caseId}`);

    res.json({
      success: true,
      caseId,
      respondersAlerted: 0
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// First responder accepts the case
router.post('/accept', async (req, res) => {
  try {
    const { caseId, responderId } = req.body;

    const updated = await Case.findOneAndUpdate(
      { caseId, status: 'active' },
      { status: 'accepted', assignedResponder: responderId },
      { new: true }
    );

    if (!updated) {
      return res.json({
        success: false,
        message: 'Case already accepted by another responder'
      });
    }

    res.json({ success: true, message: 'Case accepted' });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// Doctor closes the case
router.post('/close', async (req, res) => {
  try {
    const { caseId } = req.body;

    await Case.findOneAndUpdate(
      { caseId },
      { status: 'closed', closedAt: new Date() }
    );

    console.log(`Case ${caseId} closed`);
    res.json({ success: true });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// App polls this every 3 seconds
router.get('/cases', async (req, res) => {
  try {
    const cases = await Case.find({ status: 'active' }).sort({ timestamp: -1 });
    res.json({ success: true, cases });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;