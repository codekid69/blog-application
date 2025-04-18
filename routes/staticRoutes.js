const express = require('express');
const Blog = require('../models/blog');

const router = express.Router();

router.get('/', async (req, res) => {
  try {
    // Fetch all blogs in descending order of creation (newest first)
    const blogs = await Blog.find({})
      .sort({ createdAt: -1 }) // Sort by newest
      .populate('createdBy');

    // Calculate time ago for each blog
    const blogsWithTime = blogs.map(blog => {
      const now = new Date();
      const createdAt = new Date(blog.createdAt);
      const seconds = Math.floor((now - createdAt) / 1000);

      let interval = Math.floor(seconds / 31536000); // years
      if (interval >= 1) {
        blog.timeAgo = interval + ' year' + (interval > 1 ? 's' : '') + ' ago';
      } else {
        interval = Math.floor(seconds / 2592000); // months
        if (interval >= 1) {
          blog.timeAgo = interval + ' month' + (interval > 1 ? 's' : '') + ' ago';
        } else {
          interval = Math.floor(seconds / 604800); // weeks
          if (interval >= 1) {
            blog.timeAgo = interval + ' week' + (interval > 1 ? 's' : '') + ' ago';
          } else {
            interval = Math.floor(seconds / 86400); // days
            if (interval >= 1) {
              blog.timeAgo = interval + ' day' + (interval > 1 ? 's' : '') + ' ago';
            } else {
              interval = Math.floor(seconds / 3600); // hours
              if (interval >= 1) {
                blog.timeAgo = interval + ' hour' + (interval > 1 ? 's' : '') + ' ago';
              } else {
                interval = Math.floor(seconds / 60); // minutes
                if (interval >= 1) {
                  blog.timeAgo = interval + ' minute' + (interval > 1 ? 's' : '') + ' ago';
                } else {
                  blog.timeAgo = 'just now';
                }
              }
            }
          }
        }
      }

      return blog;
    });

    console.log("BLOGS with Time Ago:", blogsWithTime);

    // Render the home page and pass blogs and user info (if available)
    return res.render('home', { user: req.user, blogs: blogsWithTime });
  } catch (error) {
    console.log("Error fetching blogs:", error);
    return res.status(500).send("Server error");
  }
});


  

module.exports = router;
