const { validateToken } = require("../services/auth");
const User = require('../models/user'); // Assuming it's a Mongoose model

function checkForAuthenticationCookie(cookieName) {
    return async (req, res, next) => {
        const token = req.cookies[cookieName];

        if (!token) {
            req.user = null;
            return next();
        }

        try {
            const decodedUser = validateToken(token); // returns payload like { _id, email, etc. }
          
            // Fetch full user from DB using ID (assuming decodedUser contains _id)
            const fullUser = await User.findById(decodedUser._id);
            if (!fullUser) {
               
                req.user = null;
                return next();
            }
        
            // Attach the full user object to req
            req.user = fullUser;
            return next();
        } catch (err) {
            console.error("Invalid token:", err.message || err);
            req.user = null;
            return res.status(401).json({ error: "Unauthorized - Invalid token" });
        }
    };
}

function requireAuth(req, res, next) {
    if (!req.user) {
        console.log("Auth required: user not found in req");
        return res.redirect('/user/signin');
    }
    next();
}

module.exports = { checkForAuthenticationCookie, requireAuth };
