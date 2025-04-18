const {mongoose, Schema} = require('mongoose');
const { createHmac, randomBytes } = require('node:crypto'); // this is built in package 
const {createTokenForUser}=require('../services/auth');
const blogSchema = mongoose.Schema({
    title: {
        type: String,
        required: true
    },
    body:{
        type:String,
        required:true
    },
    coverImageUrl:{
        type:String,
        required:false
    },
    createdBy:{
        type: Schema.Types.ObjectId,
        ref:"User",
    },
    comments: [{
        type: Schema.Types.ObjectId,
        ref: "Comment" // match with your Comment model name
    }]
}, { timestamps: true })
const Blog=mongoose.model('Blog',blogSchema);
module.exports=Blog;