const mongoose = require('mongoose');

const caseSchema = new mongoose.Schema({

  caseId: {
    type: String,
    required: true,
    unique: true,
    index: true,
    trim: true,
    description: 'Unique identifier for the emergency case'
  },

  gps: {
    lat: {
      type: Number,
      required: true,
      min: -90,
      max: 90,
      description: 'Latitude coordinate'
    },
    lng: {
      type: Number,
      required: true,
      min: -180,
      max: 180,
      description: 'Longitude coordinate'
    }
  },

  speed: {
    type: Number,
    default: 0,
    min: 0,
    description: 'Vehicle speed in km/h'
  },

  confidence: {
    type: Number,
    required: true,
    min: 0,
    max: 1,
    description: 'Confidence level of the emergency detection (0-1)'
  },

  seatCount: {
    type: Number,
    default: 1,
    min: 1,
    description: 'Number of seats/victims'
  },

  status: {
    type: String,
    enum: ['active', 'accepted', 'closed'],
    default: 'active',
    index: true,
    description: 'Current status of the emergency case'
  },

  assignedResponder: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Responder',
    default: null,
    description: 'Reference to the responder who accepted the case'
  },

  acceptedAt: {
    type: Date,
    default: null,
    description: 'Timestamp when the case was accepted'
  },

  closedAt: {
    type: Date,
    default: null,
    description: 'Timestamp when the case was closed'
  },

  responseTime: {
    type: Number,
    default: null,
    description: 'Time in seconds from acceptance to closure'
  }

}, {
  timestamps: true,
  collection: 'cases'
});

// Create geospatial index for future GPS-based queries (if needed)
caseSchema.index({ 'gps': '2dsphere' });

// Compound index for status and creation time
caseSchema.index({ status: 1, createdAt: -1 });

module.exports = mongoose.model('Case', caseSchema);