const User = require('../models/user');
const cloudinary = require('cloudinary').v2;
const multer = require('multer');
const { createTokenForUser } = require('../services/auth');
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



const signIn = (req, res) => {
    return res.render("signin");
};

const signUp = (req, res) => {
    return res.render("signup");
}

const logout = (req, res) => {
    res.clearCookie('token'); // remove cookie from browser
    res.redirect('/'); // redirect to login page
}


const signInUser = async (req, res) => {
    try {
        const { email, password } = req.body;
        const user = await User.findOne({ email });
        if (!user) {
            return res.render("signin", {
                error: "user not exist"
            })
        }
        const token = await User.matchPasswordAndGenerateToken(email, password);
        return res.cookie("token", token).redirect("/");
    } catch (error) {
        return res.render("signin", {
            error: "Invalid credentials"
        })
    }
}

const signUpUser = async (req, res) => {
    const { name, email, password } = req.body;
    await User.create({
        name, email, password
    })

    return res.redirect("/user/signin")
}


const updateUser = async (req, res) => {
    try {
        const userId = req.params.id;
        const { name, email } = req.body;


        // Check if file was parsed
        if (req.file && !req.file.buffer) {
            console.log("❌ File buffer is empty.");
            return res.status(400).send("File upload failed: empty buffer.");
        }

        // Fetch user
        const user = await User.findById(userId);
        if (!user) {
            console.log("❌ User not found:", userId);
            return res.status(404).send('User not found');
        }

        // Prepare data to be updated
        let updateData = {};
        let uploadResult = null;

        if (name && name !== user.name) {
            updateData.name = name;
        }
        if (email && email !== user.email) {
            updateData.email = email;
        }

        // Upload profile picture asynchronously if there is a file
        if (req.file) {

            uploadResult = await new Promise((resolve, reject) => {
                const stream = cloudinary.uploader.upload_stream(
                    { folder: 'profile_pictures' },
                    (error, result) => {
                        if (error) {
                            console.log("❌ Cloudinary upload error:", error);
                            reject('Error uploading image to Cloudinary');
                        } else {

                            resolve(result);
                        }
                    }
                );
                stream.end(req.file.buffer);
            });

            // Set the profile image URL from the upload result
            updateData.profileImageUrl = uploadResult.secure_url;
        }

        // Proceed with user update
        if (Object.keys(updateData).length > 0) {
            await user.updateOne(updateData);

        }
        // refreshing the token
        const updatedUser = await User.findById(userId);
        const token = await createTokenForUser(updatedUser);  // Generate new token


        if (!token) {
            return res.status(400).send("Error generating new token.");
        }

        // Set the updated token in the cookie
        res.cookie('token', token, {
            httpOnly: true,  // Makes the cookie inaccessible via JavaScript
            secure: process.env.NODE_ENV === 'production',  // Set to true in production for secure cookies
            maxAge: 1000 * 60 * 60 * 24,  // 1 day
        });

        // Respond with updated user data or profile image
        return res.redirect('/')

    } catch (err) {
        console.error("🔥 Error in /update route:", err);
        res.status(500).send('Error updating profile');
    }
}


const getSettingsPage = async (req, res) => {
    try {
        const user = await User.findById(req.user._id); // Fetch user details from the database
        res.render('profile', { user, otherProfile: false }); // Pass user data to the template
    } catch (err) {
        console.error(err);
        res.status(500).send('Server error');
    }
}


const getUserProfile = async (req, res) => {
    const id = req.params.id;

    // Ensure the logged-in user is not viewing their own profile
    if (req.user._id.toString() === id) {
        return res.redirect('/');
    }

    try {
        // Find user by their ID
        const user = await User.findById(id);
        // Render the profile page with the user data
        return res.render('profile', {
            profileUser:user, // passing the user data to the template
            otherProfile: true, // indicates that this is another user's profile
            user: req.user
        });
    } catch (err) {
      return res.redirect('/');
    }
};



module.exports = { signIn, signUp, logout, signInUser, signUpUser, updateUser, getSettingsPage, getUserProfile };