const express = require('express');
const app = express();
const status = require('express-status-monitor');
const path = require('path');
const port = process.env.PORT || 8000;
const cookieParser = require('cookie-parser');
const userRoute = require('./routes/user');
const blogRoute = require('./routes/blog');
const staticRoutes = require('./routes/staticRoutes.js');
const chatRouter = require("./routes/chat.js");
const apiRoute = require('./routes/apiRoute.js');
const authRoute = require('./routes/auth');
const passport = require('passport');
require('./utils/googleAuth.js');
const db = require('./config/db');
require('dotenv').config();
const session = require('express-session');
const fs = require('fs');

// Session middleware (should be BEFORE passport)
app.use(session({
    secret: process.env.SECRET || 'your-secret-key',
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false }
}));

app.use(passport.initialize());
app.use(passport.session());

// Create uploads folder if it doesn't exist
const uploadsDir = path.join(__dirname, 'public/uploads');
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
    console.log('📁 uploads folder created');
}

const { checkForAuthenticationCookie, requireAuth } = require('./middlewares/authentication');

db().then(() => {
    console.log("connected to the database");
}).catch((error) => {
    console.log(`Error while Connecting to the database ${error}`);
});

app.use(status());
app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// ✅ Google OAuth routes should be public
app.use('/', authRoute);

// ✅ Apply token check after Google routes
app.use(checkForAuthenticationCookie("token"));

app.use('/images', express.static(path.join(__dirname, 'public/images')));
app.use('/uploads', express.static(path.join(__dirname, 'public/uploads')));
app.use('/generated', express.static(path.join(__dirname, 'public', 'generated')));

app.set('view engine', 'ejs');
app.set('views', path.resolve('./views'));

app.use("/chat", chatRouter);
app.use('/user', userRoute);
app.use('/blog', blogRoute);
app.use('/api', apiRoute);
app.use('/', staticRoutes);

app.listen(port, () => {
    console.log(`Server is runnig on ${port}`);
});
