const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middlewares/authentication');
const multer = require('multer');
const path = require('path');
const Blog = require('../models/blog');
const User = require('../models/user');
const Comment = require('../models/comment');
require('dotenv').config();
// configure coludinary for saving images to cloud
const cloudinary = require('cloudinary').v2;

// Cloudinary setup
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});




// Multer config
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, path.join(__dirname, '../public/uploads'));
    },
    filename: function (req, file, cb) {
        cb(null, `${Date.now()}-${file.originalname}`);
    }
});

const fileFilter = (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
        cb(null, true);
    } else {
        cb(new Error('Only images are allowed'), false);
    }
};

const upload = multer({ storage, fileFilter });

// GET: blog creation form
router.get('/', requireAuth, (req, res) => {
    res.render("addBlog");
});

router.get('/:id', async (req, res) => {
    const blogId = req.params.id;

    try {
        // Fetch the blog by ID, populate the createdBy (User) and comments (User inside Comment)
        const blog = await Blog.findById(blogId)
            .populate('createdBy', 'name email profileImageUrl')
            .populate({
                path: 'comments',
                populate: {
                    path: 'userId',
                    select: 'name email profileImageUrl'
                }
            })
            .exec();


        if (!blog) {
            return res.redirect('/');  // Redirect if blog not found
        }

        // Time ago function for comments
        const timeAgo = (timestamp) => {
            const now = new Date();
            const commentTime = new Date(timestamp);

            if (isNaN(commentTime.getTime())) {
                return 'Invalid date';  // Handle invalid dates
            }

            const diffInSeconds = Math.floor((now - commentTime) / 1000);

            if (diffInSeconds < 60) return 'Few seconds ago';
            if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)} minute(s) ago`;
            if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)} hour(s) ago`;
            if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)} day(s) ago`;
            return `${Math.floor(diffInSeconds / 604800)} week(s) ago`;
        };

        // Add formatted time for each comment
        blog.comments.forEach(comment => {
            comment.formattedTime = timeAgo(comment.createdAt);
        });

        // Check if the user is the owner of the blog
        const isOwner = req.user && req.user._id.toString() === blog.createdBy._id.toString();

        // Render blog page with populated data

        return res.render('blog', { blog, isOwner, user: req.user ,message: req.query.msg });

    } catch (error) {
        console.error("Error fetching blog details:", error);
        res.status(500).json({ message: 'Server error' });
    }
});



// POST: create blog with optional image
router.post('/', requireAuth, upload.single('coverImageUrl'), async (req, res) => {
    const { title, body } = req.body;
    const coverImage = req.file;  // Get file from multer

    let coverImageUrl = null;

    if (coverImage) {
        try {
            // Cloudinary upload logic
            const result = await cloudinary.uploader.upload(coverImage.path, {
                folder: 'blog_images', // Folder on Cloudinary (optional)
                public_id: Date.now() + '-' + coverImage.originalname // Optional: Custom public_id
            });
            coverImageUrl = result.secure_url;  // URL of the uploaded image
        } catch (error) {
            console.error('Error uploading image to Cloudinary:', error);
            return res.status(500).send('Error uploading image');
        }
    }

    try {
        await Blog.create({
            title,
            body,
            coverImageUrl,  // Save the Cloudinary URL in the database
            createdBy: req.user._id
        });
        res.redirect('/');
    } catch (err) {
        console.error("Error creating blog:", err);
        res.status(500).send("Something went wrong");
    }
});


// Add a comment to a blog post
router.post('/comment/:id', requireAuth, async (req, res) => {
    // console.log("posting comment", req.user);
    const postId = req.params.id;
    const userId = req.user._id;
    const { text } = req.body;

    try {
        // Create the comment first
        const newComment = await Comment.create({
            postId,
            userId,
            text
        });

        // Push the new comment to the comments array in the Blog model
        await Blog.findByIdAndUpdate(postId, {
            $push: { comments: newComment._id }
        });

        // Redirect to the blog page where the comment is shown
        res.redirect(`/blog/${postId}`);
    } catch (error) {
        console.error(error);
        res.status(500).send('Error adding comment');
    }
});



router.post('/update/:id', async (req, res) => {
    try {
        const id = req.params.id;
        const blog = await Blog.findByIdAndUpdate(id, req.body, { new: true });
        return res.redirect(`/blog/${id}`);

    } catch (error) {

    }
})

router.post('/delete/:id', async (req, res) => {
    try {
        const id = req.params.id;
        const deletedBlog = await Blog.findByIdAndDelete(id);

        if (!deletedBlog) {
            res.redirect('/');
            return res.status(404).send('Blog not found');
        }

        // Redirect to homepage or wherever you want after successful deletion
        res.redirect('/');
    } catch (error) {
        console.error('Error deleting blog:', error);
        res.status(500).send('Internal Server Error');
        res.redirect('/');
    }
});

router.post('/comment/delete/:id', async (req, res) => {
    try {
        const id = req.params.id;
        const { blogId } = req.body;

        await Comment.findByIdAndDelete(id);
        res.redirect(`/blog/${blogId}?msg=Comment deleted successfully!`);
        // Redirect with a query parameter to show success message
        return res.redirect(`/blog/${blogId}?msg=Comment deleted successfully!`);
    } catch (e) {
        // console.log(e);
        res.redirect('/');
    }
});


module.exports = router;
