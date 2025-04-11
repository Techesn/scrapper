// backend/models/Cookie.js
const mongoose = require('mongoose');

const cookieSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true },
  value: { type: String, required: true },
  isValid: { type: Boolean, default: true },
  lastChecked: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.models.Cookie || mongoose.model('Cookie', cookieSchema);