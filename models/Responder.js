const mongoose = require('mongoose');

const responderSchema = new mongoose.Schema({
  name: String,
  phone: String,
  fcmToken: String,
  available: { type: Boolean, default: true },
  location: {
    type: { type: String, default: 'Point' },
    coordinates: [Number]
  }
});

responderSchema.index({ location: '2dsphere' });

module.exports = mongoose.model('Responder', responderSchema);