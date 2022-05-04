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

const messageSchema = mongo.Schema({
    sender: {
        type: mongo.Schema.Types.ObjectId,
        ref: 'users'
    },
    receiver: {
        type: mongo.Schema.Types.ObjectId,
        ref: 'users'
    },
    content: {
        type: mongo.Schema.Types.String
    },
    time: {
        type: mongo.Schema.Types.Date
    },
    read: {
        type: mongo.Schema.Types.Boolean
    }
})

const groupnumberSchema = mongo.Schema({
    one:{
        type: String,
        default: "number"
    },
    groupnumber:{
        type: Number,
        default: 10000000
    }
})

const groupSchema = mongo.Schema({
    groupnickname: String,
    groupnumber: {
        type: Number,
        default:10000000,
        unique:true
    },
    createday: Object,
    capacity:Number,
    memnumber:Number,
    avatar: String,
    imgUrl: String,
    owner:{
        type: mongo.Schema.Types.ObjectId,
        ref: 'users'
    },
    managers:[{
        type: mongo.Schema.Types.ObjectId,
        ref: 'users'
    }],
    members:[{
        type: mongo.Schema.Types.ObjectId,
        ref: 'users'
    }]
})

const mygroupSchema = mongo.Schema({
    userId: {
        type: mongo.Schema.Types.ObjectId,
        ref: 'users'
    },
    normalgroups:[{
        type: mongo.Schema.Types.ObjectId,
        ref: 'groups'
    }],
    managegroups:[{
        type: mongo.Schema.Types.ObjectId,
        ref: 'groups'
    }]
})
//********************* new add code start *********************//
const groupMessageSchema = mongo.Schema({
    sender: {
        type: mongo.Schema.Types.ObjectId,
        ref: 'users'
    },
    group: {
        type: mongo.Schema.Types.ObjectId,
        ref: 'groups'
    },
    content: {
        type: mongo.Schema.Types.String
    },
    time: {
        type: mongo.Schema.Types.Date
    },
    readers: [{
        type: mongo.Schema.Types.Boolean,
        ref: 'users'
    }],
    unreaders: [{
        type: mongo.Schema.Types.ObjectId,
        ref: 'users'
    }]
})
//********************* new add code end *********************//
const notificationSchema = mongo.Schema({
    sender: {
        type: mongo.Schema.Types.ObjectId,
        ref: "users"
    },
    receiver: {
        type: mongo.Schema.Types.ObjectId,
        ref: "users"
    },
    type: {
        type: mongo.Schema.Types.Number
    },
    content: {
        type: mongo.Schema.Types.String
    },
    time: {
        type: mongo.Schema.Types.Date
    },
    read: {
        type: mongo.Schema.Types.Boolean
    },
    status: {
        type: mongo.Schema.Types.Number
    }
})
//////////////////////////////////////// MODEL

var userModel = mongo.model('users', userSchema);
exports.userModel = userModel;

var friendModel = mongo.model('friends', friendSchema);
exports.friendModel = friendModel;

var messageModel = mongo.model('messages', messageSchema);
exports.messageModel = messageModel;

var groupnumberModel = mongo.model('groupnumber',groupnumberSchema);
exports.groupnumberModel = groupnumberModel;

var groupModel = mongo.model('groups', groupSchema);
exports.groupModel = groupModel;

var mygroupsModel = mongo.model('mygroups', mygroupSchema);
exports.mygroupsModel = mygroupsModel;

//********************* new add code start *********************//
var groupMessageModel = mongo.model('groupmessages', groupMessageSchema);
exports.groupMessageModel = groupMessageModel;
//********************* new add code start *********************//
var notificationModel = mongo.model('notifications', notificationSchema);
exports.notificationModel = notificationModel;
