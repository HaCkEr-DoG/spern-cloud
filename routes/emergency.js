const express = require('express');
const router = express.Router();
const Case = require('../models/Case');
const Responder = require('../models/Responder');
const { notifyAllResponders } = require('../services/notify');
const { openVoipBridge } = require('../services/voip');

// ESP32 posts here when emergency confirmed
router.post('/alert', async (req, res) => {
  try {
    const { caseId, lat, lng, speed, confidence, seatCount } = req.body;

    // Save the case
    const newCase = await Case.create({
      caseId,
      gps: { lat, lng },
      speed,
      confidence,
      seatCount
    });

    // Find all available responders within 2km
    const nearby = await Responder.find({
      available: true,
      location: {
        $near: {
          $geometry: {
            type: 'Point',
            coordinates: [lng, lat]
          },
          $maxDistance: 2000
        }
      }
    });

    console.log(`Found ${nearby.length} responders within 2km`);

    // Notify all of them at once
    await notifyAllResponders(nearby, newCase);

    // 10 second fallback — escalate if nobody accepts
    setTimeout(async () => {
      const check = await Case.findById(newCase._id);
      if (check && check.status === 'active') {
        console.log(`Case ${caseId} not accepted — escalating to 3km`);

        const wider = await Responder.find({
          available: true,
          location: {
            $near: {
              $geometry: {
                type: 'Point',
                coordinates: [lng, lat]
              },
              $maxDistance: 3000
            }
          }
        });

        await notifyAllResponders(wider, newCase);
      }
    }, 10000);

    res.json({
      success: true,
      caseId,
      respondersAlerted: nearby.length
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

    // Lock the case to this responder
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

    // Get responder phone and open VoIP
    const responder = await Responder.findById(responderId);
    if (responder) {
      await openVoipBridge(updated, responder.phone);
    }

    res.json({ success: true, message: 'Case accepted and VoIP bridge opened' });

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
      {
        status: 'closed',
        closedAt: new Date()
      }
    );

    console.log(`Case ${caseId} closed`);
    res.json({ success: true });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;