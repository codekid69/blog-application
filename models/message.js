// models/Message.js
const mongoose = require("mongoose");
const messageSchema = new mongoose.Schema({
  sender: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  receiver: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  content: { type: String, required: true },
  createdAt: {
    type: Date,
    default: Date.now,
    expires: 86400, // auto delete after 24 hours
  },
});

module.exports = mongoose.model("Message", messageSchema);
