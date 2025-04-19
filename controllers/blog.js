const Blog = require('../models/blog');
const Comment = require('../models/comment');
const multer = require('multer');
const streamifier = require('streamifier');
const cloudinary = require('cloudinary').v2;
const timeAgo = require('../utils/timeAgo');
const transporter  = require('../utils/mail');
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


const getPostForm = (req, res) => {
    return res.render("addBlog", { user: req.user });
}
const getAllBlogs = async (req, res) => {
    try {
        // Fetch all blogs in descending order of creation (newest first)
        const blogs = await Blog.find({})
            .sort({ createdAt: -1 }) // Sort by newest
            .populate('createdBy');

        // Calculate time ago for each blog
        const blogsWithTime = blogs.map(blog => {
            blog.timeAgo = timeAgo(blog.createdAt);
            return blog;
        });

        // Render the home page and pass blogs and user info (if available)

        return res.render('home', { user: req.user, blogs: blogsWithTime });
    } catch (error) {
        console.log("Error fetching blogs:", error);
        return res.status(500).send("Server error");
    }
}
const createBlog = async (req, res) => {
    const { title, body } = req.body;
    const coverImage = req.file;  // Get file from multer

    let coverImageUrl = null;

    if (coverImage) {
        try {

            // Upload image directly to Cloudinary from memory buffer
            const result = await new Promise((resolve, reject) => {
                const stream = cloudinary.uploader.upload_stream(
                    { folder: 'blog_images', public_id: Date.now() + '-' + coverImage.originalname },
                    (error, result) => {
                        if (error) {
                            console.error(" Cloudinary upload error:", error);
                            reject(error);
                        }
                        resolve(result);
                    }
                );
                streamifier.createReadStream(coverImage.buffer).pipe(stream);
            });

            coverImageUrl = result.secure_url;  // URL of the uploaded image

        } catch (error) {
            console.error('Error uploading image to Cloudinary:', error);
            return res.status(500).send('Error uploading image');
        }
    } else {
        console.warn(" No image uploaded.");
    }

    try {
        const blog = await Blog.create({
            title,
            body,
            coverImageUrl,  // Save the Cloudinary URL in the database
            createdBy: req.user._id
        });

        res.redirect('/');
    } catch (err) {
        console.error(" Error creating blog:", err);
        res.status(500).send("Something went wrong");
    }
}
// get my Blogs
const getMyPost = async (req, res) => {
    try {
        // Fetch all blogs created by the logged-in user in descending order of creation (newest first)
        const blogs = await Blog.find({ createdBy: req.user._id })
            .sort({ createdAt: -1 }); // Sort by newest

        // Calculate time ago for each blog
        const blogsWithTime = blogs.map(blog => {
            blog.timeAgo = timeAgo(blog.createdAt);
            return blog;
        });

        // Render the myBlogs page and pass blogs and user info (if available)
        res.render('myBlogs', { blogs: blogsWithTime, user: req.user });
    } catch (error) {
        console.error(error);
        res.status(500).send('Error fetching blogs');
    }
}


const getPostDetails = async (req, res) => {
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
    console.log("rendering",blog);
        // Render blog page with populated data
        return res.render('blog', { blog, isOwner, user: req.user, message: req.query.msg });

    } catch (error) {
        console.error("Error fetching blog details:", error);
        res.status(500).json({ message: 'Server error' });
    }
}



const addCommentToPost = async (req, res) => {
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

        //sending mail notification to blog owner
        const blog = await Blog.findById(postId).populate('createdBy');
        if (blog?.createdBy?.email && blog.createdBy._id.toString() !== userId.toString()) {
            const mailOptions = {
                from: `"Bloggo" <${process.env.EMAIL_USER}>`,
                to: blog.createdBy.email,
                subject: `New comment on your blog "${blog.title}"`,
                html: `
                  <p>Hi ${blog.createdBy.name || 'there'},</p>
                  <p><strong>${req.user.name || 'Someone'}</strong> commented on your blog:</p>
                  <blockquote>${text}</blockquote>
                  <p><a href="https://blog-application-hal1.onrender.com/blog/${blog._id}">View Blog</a></p>
                  <p>— Bloggo</p>
                `,
            };

            transporter.sendMail(mailOptions, (error, info) => {
                if (error) {
                    console.error("❌ Mail not sent:", error);
                } else {
                    console.log("✅ Email sent:", info.response);
                }
            });
        }

        // Redirect to the blog page where the comment is shown
        return res.redirect(`/blog/${postId}`);
    } catch (error) {
        res.redirect(`/blog/${blogId}?msg=Comment cannot be posted at the moment!`);
    }
}

const updateBlogDetails = async (req, res) => {
    try {
        const id = req.params.id;
        const blog = await Blog.findByIdAndUpdate(id, req.body, { new: true });
        return res.redirect(`/blog/${id}`);

    } catch (error) {
        console.error("Error updating blog:", error);
        res.status(500).send("Error updating blog");
    }
}


const deleteBlog = async (req, res) => {
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
}


const deleteComment = async (req, res) => {
    try {
        const id = req.params.id;
        const { blogId } = req.body;

        await Comment.findByIdAndDelete(id);
        res.redirect(`/blog/${blogId}?msg=Comment deleted successfully!`);
    } catch (e) {
        console.error(e);
        res.redirect('/');
    }
}


module.exports = { getPostForm, getMyPost, getPostDetails, addCommentToPost, updateBlogDetails, deleteBlog, deleteComment, createBlog, getAllBlogs };