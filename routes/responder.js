const express = require('express');
const router = express.Router();
const Responder = require('../models/Responder');

/**
 * Validate GPS coordinates
 */
function validateGpsCoordinates(lat, lng) {
  return lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;
}

/**
 * POST /api/responder/register
 * Register or update a responder with GPS location
 */
router.post('/register', async (req, res) => {
  try {
    const { name, phone, fcmToken, lat, lng } = req.body;

    // Validate required fields
    if (!name || !phone || lat === undefined || lng === undefined) {
      console.warn('⚠️  POST /register - Missing required fields');
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: name, phone, lat, lng'
      });
    }

    // Validate GPS coordinates
    if (!validateGpsCoordinates(lat, lng)) {
      console.warn(`⚠️  POST /register - Invalid GPS coordinates: lat=${lat}, lng=${lng}`);
      return res.status(400).json({
        success: false,
        message: 'Invalid GPS coordinates: lat must be [-90, 90], lng must be [-180, 180]'
      });
    }

    // Check if responder exists
    let responder = await Responder.findOne({ phone });

    if (responder) {
      // Update existing responder
      responder.name = name;
      responder.fcmToken = fcmToken || responder.fcmToken;
      responder.available = true;
      responder.lastSeen = new Date();
      responder.location = {
        type: 'Point',
        coordinates: [lng, lat]
      };

      await responder.save();

      console.log(`👤 Responder updated: ${responder._id} (${name})`);

      return res.json({
        success: true,
        message: 'Responder updated',
        id: responder._id,
        name: responder.name,
        phone: responder.phone
      });
    }

    // Create new responder
    responder = await Responder.create({
      name,
      phone,
      fcmToken: fcmToken || null,
      available: true,
      location: {
        type: 'Point',
        coordinates: [lng, lat]
      }
    });

    console.log(`✅ Responder registered: ${responder._id} (${name})`);

    return res.status(201).json({
      success: true,
      message: 'Responder registered',
      id: responder._id,
      name: responder.name,
      phone: responder.phone
    });

  } catch (err) {
    console.error(`❌ POST /register error: ${err.message}`);
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: err.message
    });
  }
});


/**
 * POST /api/responder/location
 * Update responder's live GPS location
 */
router.post('/location', async (req, res) => {
  try {
    const { id, lat, lng } = req.body;

    // Validate required fields
    if (!id || lat === undefined || lng === undefined) {
      console.warn('⚠️  POST /location - Missing required fields');
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: id, lat, lng'
      });
    }

    // Validate GPS coordinates
    if (!validateGpsCoordinates(lat, lng)) {
      console.warn(`⚠️  POST /location - Invalid GPS coordinates: lat=${lat}, lng=${lng}`);
      return res.status(400).json({
        success: false,
        message: 'Invalid GPS coordinates: lat must be [-90, 90], lng must be [-180, 180]'
      });
    }

    // Update responder location
    const responder = await Responder.findByIdAndUpdate(
      id,
      {
        location: {
          type: 'Point',
          coordinates: [lng, lat]
        },
        lastSeen: new Date()
      },
      { new: true }
    );

    if (!responder) {
      console.warn(`⚠️  POST /location - Responder not found: ${id}`);
      return res.status(404).json({
        success: false,
        message: 'Responder not found'
      });
    }

    console.log(`📍 Location updated for responder: ${id}`);

    return res.json({
      success: true,
      message: 'Location updated',
      id: responder._id,
      coordinates: responder.location.coordinates
    });

  } catch (err) {
    console.error(`❌ POST /location error: ${err.message}`);
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: err.message
    });
  }
});


/**
 * POST /api/responder/available
 * Update responder's availability status
 */
router.post('/available', async (req, res) => {
  try {
    const { id, available } = req.body;

    // Validate required fields
    if (!id || available === undefined) {
      console.warn('⚠️  POST /available - Missing required fields');
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: id, available'
      });
    }

    // Validate available is boolean
    if (typeof available !== 'boolean') {
      console.warn(`⚠️  POST /available - Invalid available value: ${available}`);
      return res.status(400).json({
        success: false,
        message: 'available must be a boolean'
      });
    }

    // Update responder availability
    const responder = await Responder.findByIdAndUpdate(
      id,
      {
        available,
        lastSeen: new Date()
      },
      { new: true }
    );

    if (!responder) {
      console.warn(`⚠️  POST /available - Responder not found: ${id}`);
      return res.status(404).json({
        success: false,
        message: 'Responder not found'
      });
    }

    console.log(`🟢 Responder availability updated: ${id} (${available ? 'available' : 'unavailable'})`);

    return res.json({
      success: true,
      message: 'Availability updated',
      id: responder._id,
      available: responder.available
    });

  } catch (err) {
    console.error(`❌ POST /available error: ${err.message}`);
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: err.message
    });
  }
});


/**
 * GET /api/responder/nearby
 * Get nearby available responders (useful for dashboards)
 */
router.get('/nearby', async (req, res) => {
  try {
    const { lat, lng, radius = 5000 } = req.query;

    // Validate required fields
    if (lat === undefined || lng === undefined) {
      console.warn('⚠️  GET /nearby - Missing lat or lng');
      return res.status(400).json({
        success: false,
        message: 'Latitude and Longitude required as query parameters'
      });
    }

    // Parse and validate GPS coordinates
    const latitude = parseFloat(lat);
    const longitude = parseFloat(lng);
    const searchRadius = parseInt(radius, 10);

    if (!validateGpsCoordinates(latitude, longitude)) {
      console.warn(`⚠️  GET /nearby - Invalid GPS coordinates: lat=${latitude}, lng=${longitude}`);
      return res.status(400).json({
        success: false,
        message: 'Invalid GPS coordinates: lat must be [-90, 90], lng must be [-180, 180]'
      });
    }

    if (searchRadius < 0 || searchRadius > 50000) {
      console.warn(`⚠️  GET /nearby - Invalid radius: ${searchRadius}`);
      return res.status(400).json({
        success: false,
        message: 'Radius must be between 0 and 50000 meters'
      });
    }

    // Find nearby available responders
    const responders = await Responder.find({
      available: true,
      fcmToken: { $exists: true, $ne: null },
      location: {
        $near: {
          $geometry: {
            type: 'Point',
            coordinates: [longitude, latitude]
          },
          $maxDistance: searchRadius
        }
      }
    }).select('-__v');

    console.log(`🔍 Found ${responders.length} nearby available responders within ${searchRadius}m`);

    return res.json({
      success: true,
      count: responders.length,
      responders: responders.map(r => ({
        id: r._id,
        name: r.name,
        phone: r.phone,
        available: r.available,
        coordinates: r.location.coordinates,
        lastSeen: r.lastSeen
      }))
    });

  } catch (err) {
    console.error(`❌ GET /nearby error: ${err.message}`);
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: err.message
    });
  }
});

module.exports = router;