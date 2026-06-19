
const express = require('express');
const router = express.Router();
const Case = require('../models/Case');
const Responder = require('../models/Responder');
const { notifyAllResponders } = require('../services/notify');
const { dispatchAmbulance } = require('../services/voip');

// Get search radius from environment, default to 5000 meters
const SEARCH_RADIUS = parseInt(process.env.SEARCH_RADIUS || '5000', 10);

/**
 * Validate GPS coordinates
 */
function validateGpsCoordinates(lat, lng) {
  return lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;
}

/**
 * POST /api/emergency/alert
 * ESP32 sends emergency alert with GPS coordinates
 */
router.post('/alert', async (req, res) => {
  try {
    const {
      caseId,
      lat,
      lng,
      speed,
      confidence,
      seatCount
    } = req.body;

    // Validate required fields
    if (
      !caseId ||
      lat === undefined ||
      lng === undefined ||
      confidence === undefined
    ) {
      console.warn('⚠️  POST /alert - Missing required fields');
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: caseId, lat, lng, confidence'
      });
    }

    // Validate GPS coordinates
    if (!validateGpsCoordinates(lat, lng)) {
      console.warn(`⚠️  POST /alert - Invalid GPS coordinates: lat=${lat}, lng=${lng}`);
      return res.status(400).json({
        success: false,
        message: 'Invalid GPS coordinates: lat must be [-90, 90], lng must be [-180, 180]'
      });
    }

    // Validate confidence is between 0 and 1
    if (confidence < 0 || confidence > 1) {
      console.warn(`⚠️  POST /alert - Invalid confidence: ${confidence}`);
      return res.status(400).json({
        success: false,
        message: 'Confidence must be between 0 and 1'
      });
    }

    // Prevent duplicate case creation
    const existing = await Case.findOne({ caseId });
    if (existing) {
      console.warn(`⚠️  POST /alert - Case already exists: ${caseId}`);
      return res.status(409).json({
        success: false,
        message: 'Case already exists'
      });
    }

    // Create emergency case
    console.log(`📍 Creating emergency case: ${caseId} at (${lat}, ${lng})`);
    const emergency = await Case.create({
      caseId,
      gps: {
        lat,
        lng
      },
      speed: speed || 0,
      confidence,
      seatCount: seatCount || 1,
      status: 'active'
    });

    // Find responders within search radius
    console.log(`🔍 Searching for responders within ${SEARCH_RADIUS}m radius`);
    const responders = await Responder.find({
      available: true,
      fcmToken: {
        $exists: true,
        $ne: null
      },
      location: {
        $exists: true,
        $near: {
          $geometry: {
            type: 'Point',
            coordinates: [lng, lat]
          },
          $maxDistance: SEARCH_RADIUS
        }
      }
    });

    console.log(`✅ Found ${responders.length} available responders`);

    // Notify responders
    let notifyResult = {
      successCount: 0,
      failureCount: 0
    };

    if (responders.length > 0) {
      try {
        notifyResult = await notifyAllResponders(responders, emergency);
        console.log(`📲 Firebase notifications - Success: ${notifyResult.successCount}, Failure: ${notifyResult.failureCount}`);
      } catch (err) {
        console.error(`❌ Firebase notification error: ${err.message}`);
        // Emergency creation succeeds even if Firebase fails
      }
    } else {
      console.log(`⚠️  No responders found, skipping Firebase notification`);
    }

    console.log(`✅ Emergency created successfully: ${caseId}, Responders alerted: ${notifyResult.successCount}`);

    return res.status(201).json({
      success: true,
      message: 'Emergency created',
      caseId: emergency.caseId,
      respondersAlerted: notifyResult.successCount || 0
    });

  } catch (err) {
    console.error(`❌ POST /alert error: ${err.message}`);
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: err.message
    });
  }
});

/**
 * POST /api/emergency/accept
 * Responder accepts the emergency case (atomic operation)
 */
router.post('/accept', async (req, res) => {
  try {
    const { caseId, responderId } = req.body;

    // Validate required fields
    if (!caseId) {
      console.warn('⚠️  POST /accept - Missing caseId');
      return res.status(400).json({
        success: false,
        message: 'caseId required'
      });
    }

    if (!responderId) {
      console.warn('⚠️  POST /accept - Missing responderId');
      return res.status(400).json({
        success: false,
        message: 'responderId required'
      });
    }

    // Verify responder exists
    const responder = await Responder.findById(responderId);
    if (!responder) {
      console.warn(`⚠️  POST /accept - Responder not found: ${responderId}`);
      return res.status(404).json({
        success: false,
        message: 'Responder not found'
      });
    }

    // Atomically lock the case using findOneAndUpdate
    // Only update if status is "active" to prevent race conditions
    const updated = await Case.findOneAndUpdate(
      {
        caseId,
        status: 'active'
      },
      {
        status: 'accepted',
        assignedResponder: responderId,
        acceptedAt: new Date()
      },
      {
        new: true
      }
    );

    if (!updated) {
      console.warn(`⚠️  POST /accept - Case not available or already accepted: ${caseId}`);
      return res.status(409).json({
        success: false,
        message: 'Case already accepted or not found'
      });
    }

    console.log(`✅ Case accepted: ${caseId} by responder ${responder.name}`);

    // Trigger ambulance dispatch after successful acceptance
    try {
      await dispatchAmbulance(updated, responder);
      console.log(`🚑 Ambulance dispatch triggered for case: ${caseId}`);
    } catch (err) {
      console.error(`❌ Ambulance dispatch error: ${err.message}`);
      // Log error but don't fail the acceptance
    }

    return res.json({
      success: true,
      message: 'Case accepted successfully',
      caseId: updated.caseId,
      status: updated.status,
      acceptedAt: updated.acceptedAt,
      assignedResponder: {
        id: responder._id,
        name: responder.name,
        phone: responder.phone
      }
    });

  } catch (err) {
    console.error(`❌ POST /accept error: ${err.message}`);
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: err.message
    });
  }
});


/**
 * POST /api/emergency/close
 * Close a case and calculate response time
 */
router.post('/close', async (req, res) => {
  try {
    const { caseId } = req.body;

    // Validate required fields
    if (!caseId) {
      console.warn('⚠️  POST /close - Missing caseId');
      return res.status(400).json({
        success: false,
        message: 'caseId required'
      });
    }

    // Find the case first to calculate responseTime if acceptedAt exists
    const caseRecord = await Case.findOne({ caseId });
    if (!caseRecord) {
      console.warn(`⚠️  POST /close - Case not found: ${caseId}`);
      return res.status(404).json({
        success: false,
        message: 'Case not found'
      });
    }

    // Calculate response time if case was accepted
    let responseTime = null;
    if (caseRecord.acceptedAt) {
      responseTime = Math.floor((new Date() - caseRecord.acceptedAt) / 1000); // in seconds
      console.log(`⏱️  Response time calculated: ${responseTime}s`);
    }

    // Update case with closed status and response time
    const updated = await Case.findOneAndUpdate(
      { caseId },
      {
        status: 'closed',
        closedAt: new Date(),
        ...(responseTime !== null && { responseTime })
      },
      { new: true }
    );
    if(updated.assignedResponder){

    await Responder.findByIdAndUpdate(

        updated.assignedResponder,

        {

            available:true,

            activeCase:null

        }

    );}

    console.log(`✅ Case closed: ${caseId}, Response time: ${responseTime || 'N/A'}s`);

    return res.json({
      success: true,
      message: 'Case closed successfully',
      caseId: updated.caseId,
      status: updated.status,
      closedAt: updated.closedAt,
      responseTime: responseTime || null
    });

  } catch (err) {
    console.error(`❌ POST /close error: ${err.message}`);
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: err.message
    });
  }
});


/**
 * GET /api/emergency/cases
 * Get all active cases
 */
router.get('/cases', async (req, res) => {
  try {
    const cases = await Case.find({
      status: 'active'
    })
      .sort({ createdAt: -1 });

    console.log(`📋 Retrieved ${cases.length} active cases`);

    return res.json({
      success: true,
      count: cases.length,
      cases
    });

  } catch (err) {
    console.error(`❌ GET /cases error: ${err.message}`);
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: err.message
    });
  }
});


/**
 * GET /api/emergency/cases/all
 * Get latest 20 cases (all statuses)
 */
router.get('/cases/all', async (req, res) => {
  try {
    const cases = await Case.find()
      .sort({ createdAt: -1 })
      .limit(20);

    console.log(`📋 Retrieved ${cases.length} cases (all statuses)`);

    return res.json({
      success: true,
      count: cases.length,
      cases
    });

  } catch (err) {
    console.error(`❌ GET /cases/all error: ${err.message}`);
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: err.message
    });
  }
});


/**
 * GET /api/emergency/case/:caseId
 * ESP32 polls this endpoint for its own case status
 */
router.get('/case/:caseId', async (req, res) => {
  try {
    const { caseId } = req.params;

    const emergency = await Case.findOne({ caseId });

    if (!emergency) {
      console.warn(`⚠️  Case not found: ${caseId}`);
      return res.status(404).json({
        success: false,
        message: 'Case not found'
      });
    }

    console.log(`📍 Retrieved case status: ${caseId} (${emergency.status})`);

    return res.json({
      success: true,
      caseId: emergency.caseId,
      status: emergency.status,
      confidence: emergency.confidence,
      gps: emergency.gps,
      acceptedAt: emergency.acceptedAt || null,
      closedAt: emergency.closedAt || null,
      responseTime: emergency.responseTime || null
    });

  } catch (err) {
    console.error(`❌ GET /case/:caseId error: ${err.message}`);
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: err.message
    });
  }
});

module.exports = router;

