const express = require('express');
const Blog = require('../models/blog');
const { getAllBlogs } = require('../controllers/blog');

const router = express.Router();

router.get('/',getAllBlogs);


  

module.exports = router;
