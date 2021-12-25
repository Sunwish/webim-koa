const mongo = require('mongoose');

//////////////////////////////////////// SCHEMA

const userSchema = mongo.Schema({
    username: String,
    password: String,
    email: String,
    avater: String
});

//////////////////////////////////////// MODEL

var userModel = mongo.model('users', userSchema);
exports.userModel = userModel;