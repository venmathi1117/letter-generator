const mongoose = require('mongoose');

const registerSchema = new mongoose.Schema({
  name: String,
  email: String,
  password: String,
  collegeMailId: String,
  professionRole: [String], // Array to allow multiple roles
  deptAndSection: String, // For staff advisor (includes year)
  department: String, // For HOD, staff advisor, and student
  isHosteller: String, // 'yes' or 'no' for students
  hostelName: String, // For hosteller students and sub warden
  rollNumber: String // Only for student
});

const registerModel = mongoose.model("register", registerSchema);

module.exports = registerModel;