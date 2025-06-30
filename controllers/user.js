const User = require('../models/user');
const cloudinary = require('cloudinary').v2;
const multer = require('multer');
const { createTokenForUser } = require('../services/auth');
const transporter = require('../utils/mail');
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
        console.log("signin user", email, password);
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
        res.render('profile', { profileUser: user, user, otherProfile: false, friendStatus: '', friendRequest: '' }); // Pass user data to the template
    } catch (err) {
        console.error(err);
        res.status(500).send('Server error');
    }
}


const getUserProfile = async (req, res) => {
    const id = req.params.id;
    const currentUserId = req.user._id;
    const profileUserId = req.params.id;
    // Ensure the logged-in user is not viewing their own profile
    if (req.user._id.toString() === id) {
        return res.redirect('/');
    }

    try {
        // Find user by their ID
        const user = await User.findById(id);
        // freindship logic
        let friendStatus = "add"; // default → not friends and no request

        // Check if already friends
        if (user.friendList.includes(req.user._id)) {
            friendStatus = "friend"; // Already friends
        }
        // Check if a friend request is already sent
        else if (user.friendRequests.includes(req.user._id)) {
            friendStatus = "pending"; // Request already sent by this user
        }

        const currentUser = await User.findById(currentUserId);
        const isFriend = currentUser.friendList.includes(profileUserId);
        const hasSentRequest = currentUser.sentFriendRequests.includes(profileUserId);
        const hasReceivedRequest = currentUser.friendRequests.includes(profileUserId);



        // Render the profile page with the user data
        return res.render('profile', {
            profileUser: user, // passing the user data to the template
            otherProfile: true, // indicates that this is another user's profile
            user: req.user,
            friendStatus,
            friendRequest: '',
            isFriend,
            hasSentRequest,
            hasReceivedRequest,
            profileImageUrl: user.profileImageUrl || '/images/useravatar.png',
            userName: user.name || 'User',
        });


    } catch (err) {
        console.log("error", err);
        return res.redirect('/');
    }
};


const sendFriendRequest = async (req, res) => {
    const senderId = req.user._id; // Logged-in user's ID
    const receiverId = req.params.id; // ID of the user whose profile is being visited
    console.log("Working on friendship - Sender ID:", senderId, "Receiver ID:", receiverId);
    const currentUserId = req.user._id;
    const profileUserId = req.params.id;
    // Check if the sender is trying to send a request to themselves
    if (senderId.toString() === receiverId.toString()) {
        return res.status(400).send("You cannot send a friend request to yourself.");
    }

    try {
        // Find sender and receiver users
        const sender = await User.findById(senderId);
        const receiver = await User.findById(receiverId);

        if (!sender || !receiver) {
            console.log("User not found");
            return res.redirect('/');
        }

        const currentUser = await User.findById(currentUserId);
        const isFriend = currentUser.friendList.includes(profileUserId);
        const hasSentRequest = currentUser.sentFriendRequests.includes(profileUserId);
        const hasReceivedRequest = currentUser.friendRequests.includes(profileUserId);

        // If the sender and receiver are already friends
        if (sender.friendList.includes(receiverId)) {
            console.log("Already friends");
            return res.render('profile', {
                isFriend,
                hasSentRequest,
                hasReceivedRequest,
                user: req.user,
                profileUser: receiver,
                friendStatus: 'sent',
                otherProfile: true, // or false, depending on whether it's the user's profile or another user's
                friendRequest: "alreadyfriends"
            });
        }

        // If the sender has already sent a request to the receiver
        if (sender.sentFriendRequests.includes(receiverId)) {
            console.log("Already sent a request");
            return res.render('profile', {
                isFriend,
                hasSentRequest,
                hasReceivedRequest,
                user: req.user,
                profileUser: receiver,
                friendStatus: 'sent',
                otherProfile: true, // or false, depending on whether it's the user's profile or another user's
                friendRequest: "already"
            });
        }

        // If the receiver has already sent a request to the sender (pending request)
        if (receiver.friendRequests.includes(senderId)) {
            console.log("Pending request");
            return res.render('profile', {
                isFriend,
                hasSentRequest,
                hasReceivedRequest,
                user: req.user,
                profileUser: receiver,
                friendStatus: 'sent',
                otherProfile: true, // or false, depending on whether it's the user's profile or another user's
                friendRequest: ""
            });
        }

        // Update receiver's friendRequests and sender's sentFriendRequests directly
        await User.updateOne(
            { _id: receiverId },
            { $push: { friendRequests: senderId } }
        );
        console.log("Added sender to receiver's friendRequests");

        await User.updateOne(
            { _id: senderId },
            { $push: { sentFriendRequests: receiverId } }
        );
        console.log("Added receiver to sender's sentFriendRequests");

        //sending mail notification
        const mailOptions = {
            from: process.env.EMAIL_USER,
            to: receiver.email, // assuming receiver has an 'email' field
            subject: 'New Friend Request!',
            html: `<p>Hi ${receiver.name},</p>
                 <p>You’ve received a new friend request from <strong>${sender.name}</strong>.</p>
                 <p>Visit their profile to accept or decline the request.</p>
                 <br/>
                 <p>Thanks,<br/>Bloggo</p>`
        };

        transporter.sendMail(mailOptions, (error, info) => {
            if (error) {
                console.error('Error sending email:', error);
            } else {
                console.log('Friend request email sent:', info.response);
            }
        });


        // After successfully sending the friend request, render the profile page
        return res.render('profile', {
            isFriend,
            hasSentRequest,
            hasReceivedRequest,
            user: req.user,
            profileUser: receiver,
            friendStatus: 'sent',
            otherProfile: true, // or false, depending on whether it's the user's profile or another user's
            friendRequest: "sent",
            redirectTimeout: 3000
        });

    } catch (err) {
        console.error("Error occurred:", err);
        res.status(500).send('Internal Server Error');
    }
};

const getFriends = async (req, res) => {
    try {
        console.log("freind page me", req.user)
        const user = await User.findById(req.user._id)
            .populate('friendRequests', 'name profileImageUrl email')
            .populate('friendList', 'name profileImageUrl email');

        res.render('friends', { user });
    } catch (err) {
        console.error(err);
        res.status(500).send("Error loading friends page");
    }
};


// Make sure User model is imported

const acceptFriendRequest = async (req, res) => {
    try {
        const currentUserId = req.user._id;
        const requesterId = req.params.id;

        const currentUser = await User.findById(currentUserId);  // receiver
        const requester = await User.findById(requesterId);      // sender

        // Add each other to friendList, and remove request entries
        await Promise.all([
            User.updateOne(
                { _id: currentUserId },
                {
                    $push: { friendList: requesterId },
                    $pull: { friendRequests: requesterId }
                }
            ),
            User.updateOne(
                { _id: requesterId },
                {
                    $push: { friendList: currentUserId },
                    $pull: { sentFriendRequests: currentUserId }
                }
            )
        ]);


        // sending notification
        const mailOptions = {
            from: process.env.EMAIL_USER,
            to: requester.email,
            subject: 'Your Friend Request was Accepted!',
            html: `<p>Hi ${requester.name},</p>
                   <p><strong>${currentUser.name}</strong> has accepted your friend request!</p>
                   <p>You’re now friends on Bloggo.</p>
                   <br/>
                   <p>Cheers,<br/>Bloggo </p>`
        };

        transporter.sendMail(mailOptions, (error, info) => {
            if (error) {
                console.error('Error sending acceptance email:', error);
            } else {
                console.log('Friend acceptance email sent:', info.response);
            }
        });

        res.redirect('/user/friends');
    } catch (err) {
        console.error('Error in acceptFriendRequest:', err);
        res.status(500).send('Internal server error');
    }
};




const rejectFriendRequest = async (req, res) => {
    try {
        const currentUserId = req.user._id;
        const requesterId = req.params.id;

        await Promise.all([
            User.updateOne(
                { _id: currentUserId },
                { $pull: { friendRequests: requesterId } }
            ),
            User.updateOne(
                { _id: requesterId },
                { $pull: { sentFriendRequests: currentUserId } }
            )
        ]);


        res.redirect('/user/friends');
    } catch (err) {
        console.error('Error in rejectFriendRequest:', err);
        res.status(500).send('Internal server error');
    }
};










module.exports = { signIn, signUp, logout, signInUser, signUpUser, updateUser, getSettingsPage, getUserProfile, sendFriendRequest, getFriends, rejectFriendRequest, acceptFriendRequest };