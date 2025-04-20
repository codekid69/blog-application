const User = require('../models/user');
const express = require('express');
const router = express.Router();
const { signIn, signUp, logout, signInUser, signUpUser, updateUser, getSettingsPage, getUserProfile, sendFriendRequest, getFriends, rejectFriendRequest, acceptFriendRequest } = require('../controllers/user');
const { requireAuth } = require('../middlewares/authentication');
const multer = require('multer');
const cloudinary = require('cloudinary').v2;
require('dotenv').config();
// Cloudinary setup
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

// Multer config for memory storage (instead of disk storage)
const storage = multer.memoryStorage();
const fileFilter = (req, file, cb) => {
  if (file.mimetype.startsWith('image/')) {
    cb(null, true);
  } else {
    cb(new Error('Only images are allowed'), false);
  }
};
const upload = multer({ storage, fileFilter });


// Route for updating profile settings
router.post('/update/:id', upload.single('profileImageUrl'),updateUser );
router.get('/signin', signIn)
router.get('/signup', signUp)
router.post('/logout', logout);
router.post('/signin', signInUser)
router.post('/signup', signUpUser)
router.get('/settings', requireAuth, getSettingsPage);
router.get('/profile/:id',requireAuth,getUserProfile);
router.post('/sendrequest/:id',requireAuth,sendFriendRequest)
router.get('/friends',getFriends)
router.post('/friends/accept/:id', requireAuth, acceptFriendRequest);
router.post('/friends/reject/:id', requireAuth, rejectFriendRequest);
module.exports = router;