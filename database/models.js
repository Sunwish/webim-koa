const mongo = require('mongoose');

//////////////////////////////////////// SCHEMA

const userSchema = mongo.Schema({
    username: String,
    password: String,
    email: String,
    avatar: String
});

//////////////////////////////////////// MODEL

var userModel = mongo.model('users', userSchema);
exports.userModel = userModel;