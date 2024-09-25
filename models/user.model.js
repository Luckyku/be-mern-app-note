const moongoose = require("mongoose")
const Schema = moongoose.Schema

const userSchema = new Schema({
    fullName: {type: String},
    email: {type: String},
    password: {type: String},
    createdOn: {type: Date, default: Date.now}
})

module.exports = moongoose.model("user", userSchema)

// later on
// const mongoose = require("mongoose");
// const Schema = mongoose.Schema;

// const userSchema = new Schema({
//     fullName: { type: String, required: true },
//     email: { type: String, required: true, unique: true, match: /.+\@.+\..+/ }, // Ensure email is unique and matches basic email pattern
//     password: { type: String, required: true },
//     createdOn: { type: Date, default: Date.now } // Use Date.now function for default value
// });

// module.exports = mongoose.model("User", userSchema); // Capitalize "User" for model name