const nodemailer = require('nodemailer');
require('dotenv').config();
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,   // Your gmail
    pass: process.env.EMAIL_PASS,   // App password
  },
});

module.exports = transporter;
