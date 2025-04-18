const User = require('../models/user');

const express = require('express');

const router = express.Router();

router.get('/signin', (req, res) => {
    return res.render("signin");
})
router.get('/signup', (req, res) => {
    return res.render("signup");
})
router.post('/logout', (req, res) => {
    res.clearCookie('token'); // remove cookie from browser
    res.redirect('/'); // redirect to login page
});

router.post('/signin', async (req, res) => {
    try {
        const { email, password } = req.body;
        const user= await User.findOne({email});
        if(!user){
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


})

router.post('/signup', async (req, res) => {
    const { name, email, password } = req.body;
    await User.create({
        name, email, password
    })

    return res.redirect("/user/signin")
})
module.exports = router;