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

exports.friendsSearch =
function friendsSearch (_id, content, fuzzy) {
    // build regex string.
    var regexContent = '^' + content + (fuzzy == 'true' ? '' : '$');
    // get friend
    return models.friendModel.findOne({
        userId: _id
    }).populate({
        path: 'friends',
        select: friendPopulateFields,
        match: {
            // match from multi fields
            $or: [{
                username: {
                    $regex: regexContent,
                    $options: 'i'
                }
            }, {
                nickname: {
                    $regex: regexContent,
                    $options: 'i'
                }
            }]
        }
    }).select({
        _id: 0,
        friends: 1
    }).exec()
    .then(res => [null, res])
    .catch(err => [err]);
}

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

async function isFriend (_id, targetId) {
    // Check id valid
    if (!mongo.Types.ObjectId.isValid(_id) || !mongo.Types.ObjectId.isValid(targetId)) {
        return false;
    }
    var friend = await models.friendModel.findOne({
        userId: _id,
        friends: targetId
    }).exec();
    return friend != null;
}
exports.isFriend = isFriend;

exports.addFriend =
async function addFriend (_id, targetId) {
    var id_A = _id;
    var id_B = targetId;
    if(await isFriend(_id, targetId)) {
        return [null, false];
    }

    // Use transaction for adding 2 freind models
    var session = await models.friendModel.startSession();
    session.startTransaction();
    var sessionUUID = session.id.id.toUUID().toString();
    console.log('[dao - addFriend] Start add friend transaction ' + sessionUUID + ' for user ' + _id + ' and ' + targetId + '.');
    for(var i = 0; i < 2; i++){
        // i = 0: add B as A's friend;
        // i = 1: add A as B's friend;
        var friend = await models.friendModel.findOne({
            userId: id_A
        }).exec();
        
        if (friend) {
            friend.friends.push(id_B);
            [err, res] = await friend.save()
            .then(res => [null, res])
            .catch(err => [err])
            if(err) {
                await session.abortTransaction();
                session.endSession();
                console.log('[Error] [dao - addFriend] Add friend transaction '+ sessionUUID +' failed.');
                return [err];
            }
        }
        else {
            [err, res] = await models.friendModel.create({
                userId: id_A,
                friends: [id_B]
            }).then(res => [null, res])
            .catch(err => [err]);
            if(err) {
                await session.abortTransaction();
                session.endSession();
                console.log('[Error] [dao - addFriend] Add friend transaction '+ sessionUUID +' failed.');
                return [err];
            }
        }
        id_A = targetId;
        id_B = _id;
    }
    await session.commitTransaction();
    session.endSession();
    console.log('[dao - addFriend] Add friend transaction '+ sessionUUID +' committed.');
    return [null, true];
}

exports.deleteFriend =
async function deleteFriend (_id, targetId) {
    var id_A = _id;
    var id_B = targetId;
    if (!(await isFriend(_id, targetId))) {
        return [null, false];
    }

    // Use transaction for delete friend from 2 friend models
    var session = await models.friendModel.startSession();
    session.startTransaction();
    var sessionUUID = session.id.id.toUUID().toString();
    console.log('[dao - deleteFriend] Start delete friend transaction ' + sessionUUID + ' for user ' + _id + ' and ' + targetId + '.');
    for(var i = 0; i < 2; i++){
        // i = 0: delete B from A's friends;
        // i = 1: delete A from B's friends;
        var friend = await models.friendModel.findOne({
            userId: id_A
        }).exec();
        
        if (friend) {
            var index = friend.friends.indexOf(id_B);
            if (index > -1) {
                friend.friends.splice(index, 1);
                [err, res] = await friend.save()
                .then(res => [null, res])
                .catch(err => [err])
                if(err) {
                    await session.abortTransaction();
                    session.endSession();
                    console.log('[Error] [dao - deleteFriend] Delete friend transaction '+ sessionUUID +' failed.');
                    return [err];
                }
            } else {
                // 好友关系一致性错误
                await session.abortTransaction();
                session.endSession();
                console.error('!!![ERROR] [dao - deleteFriend] Consistency error found in friend relationship between user ' + _id + ' and ' + targetId + '.');
                console.log('[Error] [dao - deleteFriend] Delete friend transaction '+ sessionUUID +' failed.');
                return [null, false];
            }
        }
        else {
            // 好友关系一致性错误
            await session.abortTransaction();
            session.endSession();
            console.error('!!![ERROR] [dao - deleteFriend] Consistency error found in friend relationship between user ' + _id + ' and ' + targetId + '.');
            console.log('[Error] [dao - deleteFriend] Delete friend transaction '+ sessionUUID +' failed.');
            return [null, false];
        }
        id_A = targetId;
        id_B = _id;
    }
    await session.commitTransaction();
    session.endSession();
    console.log('[dao - deleteFriend] Delete friend transaction '+ sessionUUID +' committed.');
    return [null, true];
}

exports.usersSearch =
function usersSearch (content, fuzzy) {
    // build regex string.
    var regexContent = '^' + content + (fuzzy == 'true' ? '' : '$');
    // get friend
    return models.userModel.find({
        // match from multi fields
        $or: [{
            username: {
                $regex: regexContent,
                $options: 'i'
            }
        }, {
            nickname: {
                $regex: regexContent,
                $options: 'i'
            }
        }]
    }).select({
        password: 0
    }).exec()
    .then(res => [null, res])
    .catch(err => [err]);
}

///////////////////////////////////////////////// MESSAGE
exports.addMessage =
function addMessage(sender, receiver, content, time){
    return models.messageModel.create({
        sender: sender,
        receiver: receiver,
        content: content,
        time: time,
        read: false
    })
    .then(res => [null, res])
    .catch(err => [err]);
}

exports.getFriendMessages =
function getFriendMessages(_idSelf, _idFriend, startIndex = 0, count = 50) {
    return models.messageModel.find({
        sender: _idSelf,
        receiver: _idFriend
    })
    .sort( { time: -1 } )
    .skip(+startIndex)
    .limit(+count)
    .exec()
    .then(res => [null, res])
    .catch(err => [err]);
}

exports.getUnreadMessages =
function getUnreadMessages(_id) {
    return models.messageModel.find({
        receiver: _id,
        read: false
    })
    .sort( { time: -1 } )
    .exec()
    .then(res => [null, res])
    .catch(err => [err]);
}

exports.setMessageRead =
function setMessageRead (_idSelf, _ids) {
    var promises = [];
    for (const _id of _ids) {
        promises.push(models.messageModel.findOneAndUpdate({
            _id: _id,
            receiver: _idSelf
        }, {
            read: true
        }).exec().then(() => true).catch(() => false))
    }
    return Promise.all(promises)
    .then(res => [null, res])
    .catch(err => [err]);
}