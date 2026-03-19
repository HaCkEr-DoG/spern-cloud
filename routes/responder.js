const express = require('express');
const router = express.Router();
const Responder = require('../models/Responder');

// Register a new first responder
router.post('/register', async (req, res) => {
  try {
    const { name, phone, fcmToken, lat, lng } = req.body;

    const responder = await Responder.create({
      name,
      phone,
      fcmToken,
      location: {
        type: 'Point',
        coordinates: [lng, lat]
      }
    });

    res.json({ success: true, id: responder._id });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// Update responder live location
router.post('/location', async (req, res) => {
  try {
    const { id, lat, lng } = req.body;

    await Responder.findByIdAndUpdate(id, {
      location: {
        type: 'Point',
        coordinates: [lng, lat]
      }
    });

    res.json({ success: true });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Set responder availability
router.post('/available', async (req, res) => {
  try {
    const { id, available } = req.body;

    await Responder.findByIdAndUpdate(id, { available });
    res.json({ success: true });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;