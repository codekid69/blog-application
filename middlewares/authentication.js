const { validateToken } = require("../services/auth");

function checkForAuthenticationCookie(cookieName) {
    return (req, res, next) => {
        const token = req.cookies[cookieName];

        if (!token) {
            // No token, treat as guest
            req.user = null;
            return next();
        }

        try {
            const user = validateToken(token);
            req.user = user; // Attach user info to req object
            return next();
        } catch (err) {
            console.error("Invalid token:", err.message || err);
            req.user = null; // Optional: explicitly reset user
            return res.status(401).json({ error: "Unauthorized - Invalid token" });
        }
    };
}
function requireAuth(req, res, next) {
    if (!req.user) {
        return res.redirect('/user/signin');
    }
    next();
}

module.exports = {checkForAuthenticationCookie, requireAuth};
