const express =require('express');
const app=express();
const path= require('path');
const port=process.env.PORT||8000;
const cookieParser = require('cookie-parser');
const userRoute=require('./routes/user');
const blogRoute=require('./routes/blog');
const staticRoutes=require('./routes/staticRoutes.js')
const db=require('./config/db');
require('dotenv').config();
const {checkForAuthenticationCookie,requireAuth} = require('./middlewares/authentication');


db().then(()=>{
    console.log("connected to the database");
}).catch((error)=>{
    console.log(`Error while Connecting to the database ${error}`);
})


app.use(cookieParser());
app.use(checkForAuthenticationCookie("token"));
app.use(express.urlencoded({extended:false}))
app.use('/images', express.static(path.join(__dirname, 'public/images')));
app.use('/uploads', express.static(path.join(__dirname, 'public/uploads')));

app.set('view engine','ejs');
app.set('views',path.resolve('./views'));


app.use('/user',userRoute);
app.use('/blog',blogRoute)
app.use('/',staticRoutes)

app.listen(port,()=>{
    console.log(`Server is runnig on ${port}`);
})