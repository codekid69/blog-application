const express = require('express');
const Blog = require('../models/blog');

const router = express.Router();

router.get('/', async (req, res) => {
  try {
    // Fetch all blogs (for both guests and logged-in users)
    const blogs = await Blog.find({}).populate('createdBy');
console.log("BLOGS", blogs);
    // Render the home page and pass blogs and user info (if available)
    return res.render('home', { user: req.user, blogs: blogs });
  } catch (error) {
    console.log("Error fetching blogs:", error);
    return res.status(500).send("Server error");
  }
});


module.exports = router;
