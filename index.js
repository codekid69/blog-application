const express = require('express');
const app = express();
const status=require('express-status-monitor');
const path = require('path');
const port = process.env.PORT || 8000;
const cookieParser = require('cookie-parser');
const userRoute = require('./routes/user');
const blogRoute = require('./routes/blog');
const staticRoutes = require('./routes/staticRoutes.js');
const apiRoute = require('./routes/apiRoute.js');
const db = require('./config/db');
require('dotenv').config();
const fs = require('fs');
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
})

app.use(status());
app.use(cookieParser());
app.use(express.json());
app.use(checkForAuthenticationCookie("token"));
app.use(express.urlencoded({ extended: false }))
app.use('/images', express.static(path.join(__dirname, 'public/images')));
app.use('/uploads', express.static(path.join(__dirname, 'public/uploads')));
app.use('/generated', express.static(path.join(__dirname, 'public', 'generated')));

app.set('view engine', 'ejs');
app.set('views', path.resolve('./views'));


app.use('/user', userRoute);
app.use('/blog', blogRoute)
app.use('/api',apiRoute)
app.use('/', staticRoutes)

app.listen(port, () => {
    console.log(`Server is runnig on ${port}`);
})