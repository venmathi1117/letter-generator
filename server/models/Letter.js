const mongoose = require('mongoose');

const letterSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'register', required: true },
  name: String,
  createdAt: String,
  formData: {
    recipientId: { type: mongoose.Schema.Types.ObjectId, ref: 'register' },
    letterType: String,
    startDate: String,
    endDate: String,
    reason: String,
    companyName: String,
    companyLocation: String,
    collegeName: String,
    collegeLocation: String,
    date: String,
    numberOfStudents: String,
    location: String,
    editedContent: String,
  },
  signatureData: {
    image: String,
    signedBy: String,
    signedById: { type: mongoose.Schema.Types.ObjectId, ref: 'register' },
    signedAt: String,
  },
});

const letterModel = mongoose.model('letter', letterSchema);

module.exports = letterModel;