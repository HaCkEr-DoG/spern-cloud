const mongoose = require('mongoose');

const responderSchema = new mongoose.Schema({

  name: {
    type: String,
    required: true,
    trim: true,
    description: 'Responder full name'
  },

  phone: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    description: 'Unique phone number for the responder'
  },

  fcmToken: {
    type: String,
    default: null,
    description: 'Firebase Cloud Messaging token for push notifications'
  },

  available: {
    type: Boolean,
    default: true,
    index: true,
    description: 'Whether the responder is currently available'
  },

  location: {
    type: {
      type: String,
      enum: ['Point'],
      default: 'Point',
      description: 'GeoJSON type (always Point)'
    },
    coordinates: {
      type: [Number],
      required: true,
      description: 'GeoJSON coordinates [longitude, latitude]',
      validate: {
        validator: function (value) {
          return Array.isArray(value) && value.length === 2;
        },
        message: 'Coordinates must be [longitude, latitude]'
      }
    }
  },

  lastSeen: {
    type: Date,
    default: Date.now,
    description: 'Last activity timestamp'
  },

  activeCase: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Case',
    default: null,
    description: 'Reference to the currently active case (if any)'
  }

}, {
  timestamps: true,
  collection: 'responders'
});

// Create geospatial index for location-based queries
responderSchema.index({ location: '2dsphere' });

// Compound indexes for common queries
responderSchema.index({ available: 1, fcmToken: 1 });
responderSchema.index({ phone: 1 });
responderSchema.index({ lastSeen: -1 });

module.exports = mongoose.model('Responder', responderSchema);