const mongoose = require('mongoose');
const { createHmac, randomBytes } = require('node:crypto'); // this is built in package 
const {createTokenForUser}=require('../services/auth');
const userSchema = mongoose.Schema({
    name: {
        type: String,
        required: true
    },
    email: {
        type: String,
        unique: true,
        required: true
    },
    salt: { // for hashing the password
        type: String,
    },
    password: {
        type: String,
        required: true
    },
    profileImageUrl: {
        type: String,
        default: '/images/useravatar.png'
    },
    role: {
        type: String,
        enum: ["USER", "ADMIN"], //we cannot assign value other than these
        default: "USER"
    }
}, { timestamps: true })

//this function will run before saving the user
userSchema.pre("save", function (next) {

    const user = this;
    if (!user.isModified("password")) return; // if user password is not modified then we return
    const salt = randomBytes(16).toString();// creating the salt
    // const salt="abc-123@-xyz";
    const hashedPassword = createHmac('sha256', salt).update(user.password).digest("hex");  // first algorithm and the secret which is salt 
    this.salt = salt;
    this.password = hashedPassword;
    next();
})

//function for matching the password of loggin user
userSchema.static("matchPasswordAndGenerateToken",async function (email, password) {
    const user = await this.findOne({ email });
    console.log("user fetched",user);
    if (!user) throw new Error("user not found");
    const salt = user.salt;
    const hashedPassword = user.password;
    const userProvidedHash = await createHmac('sha256', salt).update(password).digest("hex");
    if (hashedPassword === userProvidedHash) {
        const token=createTokenForUser(user);
        return token
    } else {
        throw new Error("Invalid Credentials")
    }
})


const User = mongoose.model('User', userSchema);
module.exports = User;