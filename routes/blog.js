const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middlewares/authentication');
const multer = require('multer');
const streamifier = require('streamifier');
const cloudinary = require('cloudinary').v2;
const Blog = require('../models/blog');
const Comment = require('../models/comment');
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

// GET: blog creation form
router.get('/', requireAuth, (req, res) => {
    res.render("addBlog");
});

router.get('/myblogs', requireAuth, async (req, res) => {
    try {
        // Fetch all blogs created by the logged-in user in descending order of creation (newest first)
        const blogs = await Blog.find({ createdBy: req.user._id })
            .sort({ createdAt: -1 }); // Sort by newest

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

        console.log("My Blogs with Time Ago:", blogsWithTime);

        // Render the myBlogs page and pass blogs and user info (if available)
        res.render('myBlogs', { blogs: blogsWithTime, user: req.user });
    } catch (error) {
        console.error(error);
        res.status(500).send('Error fetching blogs');
    }
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
        return res.render('blog', { blog, isOwner, user: req.user, message: req.query.msg });

    } catch (error) {
        console.error("Error fetching blog details:", error);
        res.status(500).json({ message: 'Server error' });
    }
});

// POST: create blog with optional image
// POST: create blog with optional image
router.post('/', requireAuth, upload.single('coverImageUrl'), async (req, res) => {
    const { title, body } = req.body;
    const coverImage = req.file;  // Get file from multer

    console.log("✅ Request body:", req.body);
    console.log("📸 Cover image from multer:", coverImage);

    let coverImageUrl = null;

    if (coverImage) {
        try {
            console.log("🚀 Uploading to Cloudinary...");
            // Upload image directly to Cloudinary from memory buffer
            const result = await new Promise((resolve, reject) => {
                const stream = cloudinary.uploader.upload_stream(
                    { folder: 'blog_images', public_id: Date.now() + '-' + coverImage.originalname },
                    (error, result) => {
                        if (error) {
                            console.error("❌ Cloudinary upload error:", error);
                            reject(error);
                        }
                        resolve(result);
                    }
                );
                streamifier.createReadStream(coverImage.buffer).pipe(stream);
            });

            coverImageUrl = result.secure_url;  // URL of the uploaded image
            console.log("✅ Cloudinary upload success. URL:", coverImageUrl);
        } catch (error) {
            console.error('🔥 Error uploading image to Cloudinary:', error);
            return res.status(500).send('Error uploading image');
        }
    } else {
        console.warn("⚠️ No image uploaded.");
    }

    try {
        const blog = await Blog.create({
            title,
            body,
            coverImageUrl,  // Save the Cloudinary URL in the database
            createdBy: req.user._id
        });
        console.log("✅ Blog created:", blog);
        res.redirect('/');
    } catch (err) {
        console.error("🚨 Error creating blog:", err);
        res.status(500).send("Something went wrong");
    }
});


// Add a comment to a blog post
router.post('/comment/:id', requireAuth, async (req, res) => {
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

// Update a blog
router.post('/update/:id', async (req, res) => {
    try {
        const id = req.params.id;
        const blog = await Blog.findByIdAndUpdate(id, req.body, { new: true });
        return res.redirect(`/blog/${id}`);

    } catch (error) {
        console.error("Error updating blog:", error);
        res.status(500).send("Error updating blog");
    }
});

// Delete a blog
router.post('/delete/:id', async (req, res) => {
    try {
        const id = req.params.id;
        const deletedBlog = await Blog.findByIdAndDelete(id);

        if (!deletedBlog) {
            res.redirect('/');
            return res.status(404).send('Blog not found');
        }

        res.redirect('/');
    } catch (error) {
        console.error('Error deleting blog:', error);
        res.status(500).send('Internal Server Error');
    }
});

// Delete a comment
router.post('/comment/delete/:id', async (req, res) => {
    try {
        const id = req.params.id;
        const { blogId } = req.body;

        await Comment.findByIdAndDelete(id);
        res.redirect(`/blog/${blogId}?msg=Comment deleted successfully!`);
    } catch (e) {
        console.error(e);
        res.redirect('/');
    }
});


module.exports = router;
