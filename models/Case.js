const mongoose = require('mongoose');

const caseSchema = new mongoose.Schema({
  caseId: String,
  gps: { lat: Number, lng: Number },
  speed: Number,
  confidence: Number,
  seatCount: Number,
  timestamp: { type: Date, default: Date.now },
  status: {
    type: String,
    enum: ['active', 'accepted', 'closed'],
    default: 'active'
  },
  assignedResponder: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Responder'
  },
  closedAt: Date,
  responseTime: Number
});

module.exports = mongoose.model('Case', caseSchema);