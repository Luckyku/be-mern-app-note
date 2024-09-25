const moongoose = require("mongoose")
const Schema = moongoose.Schema;

const userSchema = new Schema({
    fullName: {type: String},
    email: {type: String},
    password: {type: String},
    createdOn: {type: Date, default: Date.now}
})

module.exports = moongoose.model("user", userSchema)
