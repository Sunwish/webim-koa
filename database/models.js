const mongo = require('mongoose');

//////////////////////////////////////// SCHEMA

const userSchema = mongo.Schema({
    username: String,
    password: String,
    email: String,
    avatar: String,
    nickname: String,
    houseplace: String,
    birthday: Object,
    imgUrl: String
});

const friendSchema = mongo.Schema({
    userId: {
        type: mongo.Schema.Types.ObjectId,
        ref: 'users'
    },
    friends: [{
        type: mongo.Schema.Types.ObjectId,
        ref: 'users'
    }]
})

//////////////////////////////////////// MODEL

var userModel = mongo.model('users', userSchema);
exports.userModel = userModel;

var friendModel = mongo.model('friends', friendSchema);
exports.friendModel = friendModel;