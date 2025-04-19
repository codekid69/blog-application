const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middlewares/authentication');
const multer = require('multer');
const streamifier = require('streamifier');
const cloudinary = require('cloudinary').v2;
const Blog = require('../models/blog');
const Comment = require('../models/comment');
const { getPostForm, getMyPost, getPostDetails, addCommentToPost, updateBlogDetails, deleteBlog, deleteComment, createBlog } = require('../controllers/blog');
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


router.get('/', requireAuth,getPostForm);
router.get('/myblogs',requireAuth,getMyPost);
router.get('/:id',getPostDetails);
router.post('/', requireAuth, upload.single('coverImageUrl'), createBlog);
router.post('/comment/:id', requireAuth,addCommentToPost);
router.post('/update/:id', updateBlogDetails);
router.post('/delete/:id', deleteBlog);
router.post('/comment/delete/:id', deleteComment);

module.exports = router;
