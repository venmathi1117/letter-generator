const mongoose = require('mongoose');
const emailSchema = new mongoose.Schema({
  userId: String,
  from: String,
  to: String,
  subject: String,
  message: String,
  pdfAttachment: String,
  pdfName: String,
  sentAt: Date,
  digitalSignature: String,
  publicKey: String,
});
module.exports = mongoose.model('Email', emailSchema);