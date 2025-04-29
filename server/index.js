require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const multer = require('multer');
const registerModel = require('./models/LetterGen');
const letterModel = require('./models/Letter');
const emailModel = require('./models/Email');

const app = express();
app.use(express.json());
app.use(cors());

// Configure multer for PDF uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // Limit to 5MB
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Only PDF files are allowed'), false);
    }
  },
});

// MongoDB connection
mongoose.connect('mongodb://127.0.0.1:27017/LetterGen', {
 
})
  .then(() => console.log('Connected to MongoDB'))
  .catch((err) => {
    console.error('MongoDB connection error:', err);
    process.exit(1);
  });

// Manual registration
app.post('/register', async (req, res) => {
  try {
    const existingUser = await registerModel.findOne({ collegeMailId: req.body.collegeMailId });
    if (existingUser) {
      return res.status(400).json({ message: 'User with this college email already exists' });
    }
    const user = await registerModel.create(req.body);
    res.status(201).json(user);
  } catch (err) {
    console.error('Error in /register:', err);
    res.status(500).json({ error: 'Failed to register user' });
  }
});

// Login user
app.post('/login', async (req, res) => {
  const { collegeMailId, password } = req.body;
  try {
    const user = await registerModel.findOne({ collegeMailId });
    if (user) {
      if (user.password === password) {
        res.status(200).json({ message: 'Login successful', user });
      } else {
        res.status(401).json({ message: 'Invalid credentials' });
      }
    } else {
      res.status(404).json({ message: 'User not found' });
    }
  } catch (err) {
    console.error('Error in /login:', err);
    res.status(500).json({ error: 'Failed to login' });
  }
});

// Get user by email
app.get('/users/email/:email', async (req, res) => {
  const email = req.params.email;
  try {
    const user = await registerModel.findOne({ collegeMailId: email });
    if (!user) {
      return res.status(404).json({ message: 'User not found with this email' });
    }
    res.status(200).json(user);
  } catch (error) {
    console.error('Error in /users/email/:email:', error);
    res.status(500).json({ error: 'Failed to fetch user' });
  }
});

// Get user by ID
app.get('/users/:id', async (req, res) => {
  const userId = req.params.id;
  try {
    const user = await registerModel.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    res.status(200).json(user);
  } catch (error) {
    console.error('Error in /users/:id:', error);
    res.status(500).json({ error: 'Failed to fetch user' });
  }
});

// Update user by ID
app.put('/users/:id', async (req, res) => {
  const userId = req.params.id;
  try {
    const updatedUser = await registerModel.findByIdAndUpdate(userId, req.body, { new: true });
    if (!updatedUser) {
      return res.status(404).json({ message: 'User not found' });
    }
    res.status(200).json(updatedUser);
  } catch (error) {
    console.error('Error in /users/:id (PUT):', error);
    res.status(500).json({ error: 'Failed to update user' });
  }
});

// Get all users
app.get('/users', async (req, res) => {
  try {
    const { excludeRole } = req.query;
    const query = excludeRole ? { professionRole: { $ne: excludeRole } } : {};
    const users = await registerModel.find(query);
    res.status(200).json(users);
  } catch (error) {
    console.error('Error in /users:', error);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// Save a letter
app.post('/letters', async (req, res) => {
  try {
    const letter = await letterModel.create(req.body);
    res.status(201).json(letter);
  } catch (error) {
    console.error('Error in /letters:', error);
    res.status(500).json({ error: 'Failed to save letter' });
  }
});

// Get all letters for a user
app.get('/letters/:userId', async (req, res) => {
  const userId = req.params.userId;
  try {
    const letters = await letterModel.find({ userId });
    res.status(200).json(letters);
  } catch (error) {
    console.error('Error in /letters/:userId:', error);
    res.status(500).json({ error: 'Failed to fetch letters' });
  }
});

// Get letter by ID for download
app.get('/letters/download/:id', async (req, res) => {
  const letterId = req.params.id;
  try {
    const letter = await letterModel.findById(letterId);
    if (!letter) {
      return res.status(404).json({ message: 'Letter not found' });
    }
    res.status(200).json(letter);
  } catch (error) {
    console.error('Error in /letters/download/:id:', error);
    res.status(500).json({ error: 'Failed to fetch letter' });
  }
});

// Send email (store in MongoDB)
app.post('/send-email', upload.single('file'), async (req, res) => {
  try {
    const { from, to, subject, message, userId } = req.body;
    const file = req.file;

    // Validate input
    if (!from || !to || !subject || !message || !userId) {
      return res.status(400).json({ error: 'All fields (from, to, subject, message, userId) are required' });
    }

    // Prepare email data
    const emailData = {
      from,
      to,
      subject,
      message,
      userId,
      sentAt: new Date(),
    };

    // Handle PDF attachment
    if (file) {
      emailData.pdfAttachment = file.buffer.toString('base64');
      emailData.pdfName = file.originalname;
    }

    // Save email to MongoDB
    const email = await emailModel.create(emailData);
    res.status(201).json({ message: 'Email sent successfully', email });
  } catch (error) {
    console.error('Error in /send-email:', error);
    res.status(500).json({ error: `Failed to send email: ${error.message}` });
  }
});

// Fetch emails for a user
app.get('/emails/:userId', async (req, res) => {
  const userId = req.params.userId;
  try {
    // Fetch emails where user is either sender or recipient
    const emails = await emailModel.find({
      $or: [{ userId }, { to: (await registerModel.findById(userId)).collegeMailId }],
    }).sort({ sentAt: -1 }).limit(10);
    res.status(200).json(emails);
  } catch (error) {
    console.error('Error in /emails/:userId:', error);
    res.status(500).json({ error: `Failed to fetch emails: ${error.message}` });
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

const PORT = 3008;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});