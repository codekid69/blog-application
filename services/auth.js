const JWT = require('jsonwebtoken');
const secret = "oOAaZz$abc";

async function createTokenForUser(user) {
    const payload = {
        _id: user._id,
        email: user.email,
        name: user.name,
        role: user.role,
        pic: user.profileImageUrl
    }
    const token = JWT.sign(payload, secret, {
        expiresIn: '24h'
    });

    return token;

}

function validateToken(token) {
    const payload = JWT.verify(token, secret);
    return payload;
}


module.exports = { createTokenForUser, validateToken };
