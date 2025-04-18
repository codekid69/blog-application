const { Schema } = require('mongoose');
const mongoose = require('mongoose');
// Define schema for a comment
const commentSchema = new mongoose.Schema({
  postId: { type: mongoose.Schema.Types.ObjectId, ref: 'Blog' },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },  // Make sure this is correctly set
  text: String,
  createdAt: { type: Date, default: Date.now },
});

const Comment = mongoose.model('Comment', commentSchema); // Create model from schema
module.exports = Comment; // Export model for use in routes
