const express = require("express");
const router = express.Router();
const Message = require("../models/message");
const User = require("../models/User");

// Get chat page between two users
router.get("/:userId", async (req, res) => {
  const otherUser = await User.findById(req.params.userId);
  const messages = await Message.find({
    $or: [
      { sender: req.user._id, receiver: req.params.userId },
      { sender: req.params.userId, receiver: req.user._id }
    ]
  }).sort({ createdAt: 1 });

  res.render("chatroom", {
    user: req.user,
    otherUser,
    messages
  });
});

// Handle sending message
router.post("/send", async (req, res) => {
  const { receiverId, content } = req.body;

  try {
    const msg = new Message({
      sender: req.user._id,
      receiver: receiverId,
      content
    });

    await msg.save();
    res.json({ success: true });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ success: false });
  }
});

module.exports = router;
