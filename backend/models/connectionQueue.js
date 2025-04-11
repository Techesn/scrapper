// models/connectionQueue.js
const mongoose = require('mongoose');

const connectionQueueSchema = new mongoose.Schema({
  prospectId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Prospect',
    required: true
  },
  sequenceId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Sequence',
    required: false
  },
  status: {
    type: String,
    enum: ['pending', 'processing', 'sent', 'failed'],
    default: 'pending'
  },
  scheduledAt: {
    type: Date,
    default: Date.now
  },
  processingStartedAt: Date,
  completedAt: Date,
  error: String,
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('ConnectionQueue', connectionQueueSchema);