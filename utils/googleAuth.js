const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const User = require('../models/user');

passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: process.env.GOOGLE_CALLBACK_URL
}, async (accessToken, refreshToken, profile, done) => {
    try {
        const email = profile.emails[0].value;
        console.log('\x1b[34m[STRATEGY] Google profile email:\x1b[0m', email);
        let user = await User.findOne({ email });

        if (user) {
            console.log('\x1b[32m[STRATEGY] User found:\x1b[0m', user.email, '| id:', user._id);
            // Attach GoogleId if first time with Google
            if (!user.googleId) {
                console.log('\x1b[33m[STRATEGY] Linking Google ID for existing user\x1b[0m', profile.id);
                user.googleId = profile.id;
                await user.save();
            } else {
                console.log('\x1b[32m[STRATEGY] User already linked with Google\x1b[0m');
            }
        } else {
            console.log('\x1b[36m[STRATEGY] No user found, creating new user...\x1b[0m');
            user = await User.create({
                name: profile.displayName,
                email,
                googleId: profile.id,
                profileImageUrl: profile.photos[0].value
                // password: undefined (optional for Google users)
            });
            console.log('\x1b[32m[STRATEGY] New user created:\x1b[0m', user.email, '| id:', user._id);
        }

        // Pass user to next middleware
        console.log('\x1b[32m[STRATEGY] Passing user to done()\x1b[0m');
        return done(null, user);
    } catch (err) {
        console.error('\x1b[31m[STRATEGY ERROR] Google strategy error:\x1b[0m', err);
        return done(err, null);
    }
}));

passport.serializeUser((user, done) => {
    console.log('\x1b[35m[SERIALIZE] Serializing user ID:\x1b[0m', user._id);
    done(null, user._id);
});
passport.deserializeUser(async (id, done) => {
    console.log('\x1b[35m[DESERIALIZE] Deserializing user ID:\x1b[0m', id);
    const user = await User.findById(id);
    done(null, user);
});


passport.serializeUser((user, done) => done(null, user._id));
passport.deserializeUser(async (id, done) => {
    const user = await User.findById(id);
    done(null, user);
});
