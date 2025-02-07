// models/Payment.js
const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema({
  company_name: {
    type: String,
    required: true
  },
  reference: {
    type: String,
    required: true
  },
  timestamp: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('Payment', paymentSchema);