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