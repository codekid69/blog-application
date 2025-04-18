const mongoose = require('mongoose');
require('dotenv').config();
async function connectToDb() {
    try {
        const instanceTimeout = setTimeout(() => {
            console.log(" Database Connection Time Out");
            process.exit(1);
        }, 10000)
        await mongoose.connect(process.env.MONGODB_URI)
        clearTimeout(instanceTimeout);
    } catch (error) {
        throw new Error (error);
    }
}



module.exports = connectToDb;