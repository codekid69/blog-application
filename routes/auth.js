const express = require('express');
const passport = require('passport');
const { createTokenForUser } = require('../services/auth'); // ✅ IMPORT THIS
const router = express.Router();

router.get('/auth/google', passport.authenticate('google', { scope: ['profile', 'email'] }));

router.get('/auth/google/callback', (req, res, next) => {
    console.log('\x1b[33m[CALLBACK] Google OAuth callback hit\x1b[0m');
    passport.authenticate('google', async (err, user, info) => {
        console.log('\x1b[34m[CALLBACK] passport.authenticate called:\x1b[0m', { err, user, info });
        if (err) {
            console.error('\x1b[31m[CALLBACK ERROR] Authenticate error:\x1b[0m', err, info);
            return res.status(500).send("OAuth error: " + err.message);
        }
        if (!user) {
            console.warn('\x1b[33m[CALLBACK] No user found, redirecting to /user/signin\x1b[0m');
            return res.redirect('/user/signin');
        }
        req.logIn(user, err => {
            if (err) {
                console.error('\x1b[31m[CALLBACK ERROR] req.logIn failed:\x1b[0m', err);
                return res.redirect('/user/signin');
            }
            // Generate JWT, set cookie
            const token = createTokenForUser(user);
            console.log('\x1b[32m[CALLBACK] Token generated, setting cookie and redirecting to /\x1b[0m', token);
            res.cookie('token', token, { httpOnly: true });
            res.redirect('/');
        });
    })(req, res, next);
});




router.get('/logout', (req, res) => {
    req.logout(() => {
        res.clearCookie('token');
        res.redirect('/');
    });
});

module.exports = router;
