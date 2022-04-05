const mongo = require('mongoose');
const models = require('./models');
const bodyParser = require('body-parser');

exports.connect = 
function connect (app, connectString) {
    return new Promise((resolve, reject) => {
        mongo.connect(connectString, {
            useUnifiedTopology: true,
            useNewUrlParser: true
        }, err => {
            if(err) { return reject(err) }
            resolve(null);
        });
    });
}

/////////////////////////////////////////////////

exports.addUser = 
function addUser (user) {
    const randamAvatar =  'https://api.prodless.com/avatar.png';
    if(!(user.avatar && user.avatar != '')) { user.avatar = randamAvatar; }
    return new models.userModel(user).save()
    .then(res => [null, res])
    .catch(err => [err]);
}

exports.getAllUsers =
function getAllUsers () {
    return models.userModel.find({}).exec()
    .then(result => [null, result])
    .catch(err => [err]);
}

exports.isUserExist =
async function isUserExist (_id) {
    if (!mongo.Types.ObjectId.isValid(_id)) return false;
    else return await models.userModel.exists({
        _id: _id
    });
}

exports.isUserNameExist = 
function isUserNameExist (username) {
    return models.userModel.exists({
        username: username
    }).then(result => [null, result])
    .catch(err => [err]);
}

exports.isEmailExist = 
function isEmailExist (email) {
    return models.userModel.exists({
        email: email
    }).then(result => [null, result])
    .catch(err => [err]);
}

exports.getUserByUsername =
function getUserByUsername (username) {
    return models.userModel.findOne({
        username: username
    }).exec()
    .then(res => [null, res])
    .catch(err => [err]);
}

exports.getUserByEmail =
function getUserByEmail (email) {
    return models.userModel.findOne({
        email: email
    }).exec()
    .then(res => [null, res])
    .catch(err => [err]);
}

exports.getUserById =
function getUserById (_id) {
    return models.userModel.findById(_id).exec()
    .then(res => [null, res])
    .catch(err => [err]);
}

exports.updateUserAvatar =
function updateUserAvatar (_id, avatarName, imgUrl) {
    return models.userModel.findByIdAndUpdate(_id, {
        avatar: avatarName,
        imgUrl: imgUrl
    }, {
        new: true
    }).exec()
    .then(res => [null, res])
    .catch(err => [err]);
}

exports.updateUserInfo = 
function updateUserInfo (_id, userInfo) {
    var user = models.userModel.findById(_id);
    return models.userModel.findByIdAndUpdate(_id, {
        imgUrl: !userInfo.imgUrl ? user.imgUrl : userInfo.imgUrl,
        nickname: !userInfo.nickname ? user.nickname : userInfo.nickname,
        houseplace: !userInfo.houseplace ? user.houseplace : userInfo.houseplace,
        birthday: !userInfo.birthday ? user.birthday : userInfo.birthday,
    }, {
        new: true
    }).exec()
    .then(res => [null, res])
    .catch(err => [err]);
}

/////////////////////////////////////////////////
const friendPopulateFields = {
    _id: 1,
    username: 1,
    nickname: 1,
    avatar: 1,
    imgUrl: 1
};

exports.getFriends = 
function getFriends (_id) {
    return models.friendModel.findOne({
        userId: _id
    }).populate({
        path: 'friends',
        select: friendPopulateFields,
    }).select({
        _id: 0,
        friends: 1
    }).exec()
    .then(res => [null, res])
    .catch(err => [err]);
}

exports.addFriend =
async function addFriend (_id, targetId) {
    var id_A = _id;
    var id_B = targetId;

    // Use transaction for adding 2 freind models
    var session = await models.friendModel.startSession();
    session.startTransaction();
    for(var i = 0; i < 2; i++){
        // i = 0: add B as A's friend;
        // i = 1: add A as B's friend;
        var friend = await models.friendModel.findOne({
            userId: id_A
        }).exec();
        
        if (friend) {
            console.log('[dao - addFriend] Inserting new friend to user ' + _id);
            friend.friends.push(id_B);
            [err, res] = await friend.save()
            .then(res => [null, res])
            .catch(err => [err])
            if(err) {
                await session.abortTransaction();
                session.endSession();
                return [err];
            }
        }
        else {
            console.log('[dao - addFriend] Creating new friend model to db');
            [err, res] = await models.friendModel.create({
                userId: id_A,
                friends: [id_B]
            }).then(res => [null, res])
            .catch(err => [err]);
            if(err) {
                await session.abortTransaction();
                session.endSession();
                return [err];
            }
        }
        id_A = targetId;
        id_B = _id;
    }
    await session.commitTransaction();
    session.endSession();
    return [null, true];
}