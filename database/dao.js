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
    for(var i = 0; i < (_id == targetId ? 1 : 2); i++){
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
const senderPopulateFields = {
    _id: 1,
    username: 1,
    nickname: 1,
    avatar: 1,
    imgUrl: 1
};
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
        $or: [{
            sender: _idSelf,
            receiver: _idFriend
        }, {
            sender: _idFriend,
            receiver: _idSelf
        }]
    })
    .sort( { time: -1 } )
    .skip(+startIndex)
    .limit(+count)
    .populate({
        path: 'sender',
        select: senderPopulateFields
    })
    .populate({
        path: 'receiver',
        select: senderPopulateFields
    })
    .exec()
    .then(res => [null, res])
    .catch(err => [err]);
}

exports.getUnreadMessages =
function getUnreadMessages(_id) {
    return models.messageModel.find({
        receiver: _id,
        read: false
    }).populate({
        path: 'sender',
        select: senderPopulateFields
    })
    .sort( { time: -1 } )
    .exec()
    .then(res => [null, res])
    .catch(err => [err]);
}

exports.setMessagesRead =
function setMessagesRead (_idSelf, _ids) {
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

///////////////////////////////////////////////////////////////////////// GROUP

const memberPopulateFields = {
    _id: 1,
    username: 1,
    nickname: 1,
    avatar: 1,
    imgUrl: 1
};

const groupPopulateFields = {
    _id: 1,
    groupname: 1,
    groupnumber: 1,
    createday: 1,
    capacity:1,
    memnumber:1,
    avatar: 1,
    imgUrl: 1,
};

exports.test = 
async function test(){
    //console.log('[dao - createGroup] Creating new groupnumber model to db');
    /*
        [err, res] = await models.groupnumberModel.create({
            one:"number",
            groupnumber:10000000
        }).then(res => [null, res])
        .catch(err => [err]);
        if(err){
            return [err, false];
        }
    //    console.log('[dao - createGroup] success to Create a new groupnumber model to db');
        return [null, true];
        */
    return await models.groupModel.find({})
    .then(res => [null,res])
    .catch(err => [err,false]);
}


//创建群组
exports.createGroup = 
async function createGroup(group){
    const randamAvatar =  'https://api.prodless.com/avatar.png';
    if(!(group.avatar && group.avatar != '')) { group.avatar = randamAvatar; }
    [err, res]  = await models.groupModel.find({})
    .then(res => [null,res])
    .catch(err => [err,false]);
    if(res.push() == 0){
        console.log('[dao - createGroup] Creating new groupnumber model to db');
        [err, res] = await models.groupnumberModel.create({
            one:"number",
            groupnumber:10000000
        }).then(res => [null, res])
        .catch(err => [err, false]);
        if(err){
            return [err, false];
        }
        console.log('[dao - createGroup] success to Create a new groupnumber model to db');
        group.groupnumber = 10000000;
    }else{
        var groupnumber;
        groupnumber = await models.groupnumberModel.findOneAndRemove({
            one:"number"
        }).exec();
        while(!groupnumber){
            groupnumber = await models.groupnumberModel.findOneAndRemove({
                one:"number"
            }).exec();
        }
        groupnumber.groupnumber = groupnumber.groupnumber +1;
        [err, res] = await models.groupnumberModel.create({
            'one':"number",
            'groupnumber':groupnumber.groupnumber
        }).then(res => [null, res])
        .catch(err => [err,false]);
        if(err){
            return [err, false];
        }
        group.groupnumber = groupnumber.groupnumber;
    }
    console.log('[dao - createGroup] start a new groupModel transaction');
    var session = await models.groupModel.startSession();
    session.startTransaction();
    console.log('[dao - createGroup] start to Create a new group model to db');
    [err,res] = await models.groupModel.create(group)
                .then(res => [null, res])
                .catch(err => [err, false]);
    if(err){
        return [err, false];
    }
    console.log('[dao - createGroup] sucess to Create a new group model to db');

    var newGroup = await models.groupModel.findOne({groupnumber: group.groupnumber});
    var mygroup = await models.mygroupsModel.findOne({userId: newGroup.owner});
    if(!mygroup){
        console.log('[dao - createGroup] start to Create a new mygroup model to db');
        [err, res] = await models.mygroupsModel.create({
            userId:newGroup.owner,
            normalgroups:[],
            managegroups:[newGroup._id]
        })
        .then(res => [null, res])
        .catch(err => [err,false]);
        console.log(err);
        console.log(res);
        if(err){
            console.log('22222222222222222222222222');
            await session.commitTransaction();
            session.endSession();
            return [err, false];
        }
        console.log('[dao - createGroup] success to Create a new mygroup model to db');
    }else{
        mygroup.managegroups.push(newGroup._id);
        [err,res] = await mygroup.save()
            .then(res => [null,res])
            .catch(err =>[err, false]);
        if(err){
            var index = mygroup.managegroups.indexOf(newGroup._id);
            if(index > -1){
                mygroup.managegroups.splice(index, 1);
                [err,res] = await mygroup.save()
                .then(res => [null,res])
                .catch(err =>[err, false]);
            }
            await session.commitTransaction();
            session.endSession(); 
            return [err, false];
        }
    }
    
    return [err, true];
}
//群组是否存在
exports.existGroup = 
async function existGroup (_id) {
    if (!mongo.Types.ObjectId.isValid(_id)) return false;
    else return await models.groupModel.exists({
        _id: _id
    });
}

//是否有管理员权限：修改群信息，添加删除普通群成员
exports.hasAdminAuth =
async function hasAdminAuth(_id, groupId){
    if (!mongo.Types.ObjectId.isValid(_id) || !mongo.Types.ObjectId.isValid(groupId)) return false;
    var group = await models.groupModel.findOne({
        _id: groupId
    }).exec();
    if(group){
        var managers = group.managers;
        for(var i = 0; i < managers.push(); i++){
            if(managers[i] == _id){
                return true;
            }
        }
    }
    return false;
}

async function isGroupAdmin(_id, groupId){
    if (!mongo.Types.ObjectId.isValid(_id) || !mongo.Types.ObjectId.isValid(groupId)) return false;
    var group = await models.groupModel.findOne({
        _id: groupId
    }).exec();
    if(group){
        var managers = group.managers;
        for(var i = 0; i < managers.push(); i++){
            if(managers[i] == _id){
                return true;
            }
        }
    }
    return false;
}

//是否普通成员
exports.isNormalMember =
async function isNormalMember(_id, groupId){
    if (!mongo.Types.ObjectId.isValid(_id) || !mongo.Types.ObjectId.isValid(groupId)) return false;
    var group = await models.groupModel.findOne({
        _id: groupId
    }).exec();
    if(group){
        var members = group.members;
        for(var i = 0; i < members.push(); i++){
            if(members[i] == _id){
                return true;
            }
        }
    }
    return false;
}

//是否是群主权限：添加删除管理员，删除群组，管理权限
exports.hasGroupOwnerAuth =
async function hasGroupOwnerAuth(_id, groupId){
    if (!mongo.Types.ObjectId.isValid(_id) || !mongo.Types.ObjectId.isValid(groupId)) return false;
    var group = await models.groupModel.findOne({
        _id: groupId,
        owner: _id
    }).exec();
    if(group){
        return true;
    }else{
        return false;
    }
}

//
async function isGroupOwner(_id, groupId){
    if (!mongo.Types.ObjectId.isValid(_id) || !mongo.Types.ObjectId.isValid(groupId)) return false;
    var group = await models.groupModel.findOne({
        _id: groupId,
        owner: _id
    }).exec();
    if(group){
        return true;
    }else{
        return false;
    }
}

//查询所有群组
exports.groupSearch =
function groupSearch (content, searchType) {
    if(searchType == 0){
        // build regex string.
        var regexContent = new RegExp(content, 'i');
        // get gruops
        return models.groupModel.find(
            {
                // match from multi fields
                $or: [{
                    groupnickname: {
                        $regex: regexContent
                    }
                }]
        })
        .populate({
            path: 'owner',
            select: memberPopulateFields,
        })
        .populate({
            path: 'managers',
            select: memberPopulateFields,
        })
        .populate({
            path: 'members',
            select: memberPopulateFields,
        })
        .exec()
        .then(res => [null, res])
        .catch(err => [err]);
    }else if(searchType == 1){
        return models.groupModel.find(
            {
                // match from multi fields
                $or: [{
                    groupnumber: content
                }]
        })
        .populate({
            path: 'owner',
            select: memberPopulateFields,
        })
        .populate({
            path: 'managers',
            select: memberPopulateFields,
        })
        .populate({
            path: 'members',
            select: memberPopulateFields,
        })
        .exec()
        .then(res => [null, res])
        .catch(err => [err]);
    }else{
        return ["auth invalidate!!", null]
    }
    
}

//搜索我管理的群组
exports.myManageGroupsSearch =
function myManageGroupsSearch (_id, content, searchType) {
    if(!mongo.Types.ObjectId.isValid(_id)){
        return ["invalide _id", null] ;
    }
    if(searchType == 0){
        // build regex string.
        var regexContent = new RegExp(content, 'i');
        return models.mygroupsModel.findOne({
                userId: _id
        })
        .populate({
            path: 'managegroups',
            select: groupPopulateFields,
            match: {
                // match from multi fields
                $or: [{
                    groupnickname: {
                        $regex: regexContent,
                        $options: 'i'
                    }
                }]
            }
        })
        .select('userId managegroups')
        .exec()
        .then(res => [null, res])
        .catch(err => [err]);
    }else if(searchType == 1){
        return models.mygroupsModel.findOne({
                    userId: _id
        })
        .populate({
            path: 'managegroups',
            select: groupPopulateFields,
            match: {
                $or: [{
                    groupnumber: content
                }]
            }
        })
        .select('userId managegroups')
        .exec()
        .then(res => [null, res])
        .catch(err => [err]);

    }else{
        return ["auth invalidate!!", null]
    }
}

//搜索我的普通群组
exports.myNormalGroupsSearch =
function myNormalGroupsSearch (_id,content, searchType) {
    if(!mongo.Types.ObjectId.isValid(_id)){
        return ["invalide _id", null] ;
    }
    if(searchType == 0){
        // build regex string.
        var regexContent = new RegExp(content, 'i');
        return models.mygroupsModel.findOne({
                userId: _id
        })
        .populate({
            path: 'normalgroups',
            select: groupPopulateFields,
            match: {
                // match from multi fields
                $or: [{
                    groupnickname: {
                        $regex: regexContent,
                        $options: 'i'
                    }
                }]
            }
        })
        .select('userId managegroups')
        .exec()
        .then(res => [null, res])
        .catch(err => [err]);
    }else if(searchType == 1){
        return models.mygroupsModel.findOne({
                    userId: _id
        })
        .populate({
            path: 'normalgroups',
            select: groupPopulateFields,
            match: {
                $or: [{
                    groupnumber: content
                }]
            }
        })
        .select('userId normalgroups')
        .exec()
        .then(res => [null, res])
        .catch(err => [err]);

    }else{
        return ["auth invalidate!!", null]
    }
}

//获取我管理的群组
exports.getMyManageGroups =
function getMyManageGroups (_id) {
    if(!mongo.Types.ObjectId.isValid(_id)){
        return ["invalide _id", null] ;
    }
    return models.mygroupsModel.find({
            userId: _id
    })
    .populate('managegroups')
    .select('userId managegroups')
    .exec()
    .then(res => [null, res])
    .catch(err => [err]);
}

//获取我的普通群组
exports.getMyNormalGroups =
function getMyNormalGroups (_id) {
    if(!mongo.Types.ObjectId.isValid(_id)){
        return ["invalide _id", null] ;
    }
    return models.mygroupsModel.find({
        userId: _id
    })
    .populate('normalgroups')
    .select('_id normalgroups')
    .exec()
    .then(res => [null, res])
    .catch(err => [err]);
}

//修改群组名
exports.updateGroupName = 
async function updateGroupName(groupId, newgroupnickname){
        return models.groupModel.findByIdAndUpdate(groupId, {groupnickname:newgroupnickname}, {
                new: true
                }).exec()
                .then(res => [null, res])
                .catch(err => [err]);
}

//修改群组头像
exports.updateGroupAvatar =
function updateGroupAvatar (groupId, avatarName, imgUrl) {
    return models.groupModel.findByIdAndUpdate(groupId, {
        avatar: avatarName,
        imgUrl: imgUrl
    }, {
        new: true
    }).exec()
    .then(res => [null, res])
    .catch(err => [err]);
}

//解散群组
exports.disbandGroup = 
async function disbandGroup(userId, groupId){
    if (!(await hasGroupOwnerAuth(userId, groupId))) {
        return [null, false];
    }

    // Use transaction for delete group 
    var session = await models.mygroupsModel.startSession();
    session.startTransaction();
    var group = await models.groupModel.findById({
        _id:groupId
    }).exec();
    if(group){
        var managersNum = group.managers.push();
        var membersNum = group.members.push();
        for(var i = 0; i < membersNum; i++){
            models.mygroupsModel.findByIdAndUpdate(
                { "user": group.members[i], "referrals": groupId },
                { "$pull": { "normalgroups": groupId } },
                { "multi": true }
              ).catch(err => [err]);
            if(err){
                await session.abortTransaction();
                session.endSession();
                return [null, false]
            }
        }
        for(var i = 0; i < managersNum; i++){
            models.mygroupsModel.findByIdAndUpdate(
                { "user": group.managers[i], "referrals": groupId },
                { "$pull": { "managegroups": groupId } },
                { "multi": true }
              ).catch(err => [err]);
            if(err){
                await session.abortTransaction();
                session.endSession();
                return [null, false]
            }
        }
        models.mygroupsModel.findByIdAndUpdate(
            { "user": group.owner, "referrals": groupId },
            { "$pull": { "managegroups": groupId } },
            { "multi": true }
          ).catch(err =>[err]);
        if(err){
            await session.abortTransaction();
            session.endSession();
            return [null, false]
        }
    }else{
        await session.abortTransaction();
            session.endSession();
            return [null, false];
    }
    group = await models.groupModel.findByIdAndDelete({
        _id:groupId
    }).exec()
    .catch(err => [err]);
    if(err){
        await session.abortTransaction();
        session.endSession();
        return [null, false]
    }
    await session.commitTransaction();
    session.endSession();
    return [null, true];
}

//是否是群成员
exports.isGroupMember = 
async function isGroupMember(userId, groupId){
    if (!mongo.Types.ObjectId.isValid(userId) || !mongo.Types.ObjectId.isValid(groupId)) return false;
    var mygroup = await models.mygroupsModel.findOne({
        userId: userId
    }).exec();
    if(mygroup){
        var normalgroups = mygroup.normalgroups;
        for(var i = 0; i < normalgroups.push(); i++){
            if(normalgroups[i] == groupId){
                return true;
            }
        }
        var managegroups = mygroup.managegroups;
        for(var i = 0; i < managegroups.push(); i++){
            if(managegroups[i] == groupId){
                return true;
            }
        }
    }
    return false;
}

//加入群组
exports.joinGroup =
async function joinGroup (userId, groupId) {
    if(!mongo.Types.ObjectId.isValid(userId) || !mongo.Types.ObjectId.isValid(groupId)) {
        return ["invalidate params", false];
    }
    // Use transaction for add 
    var session = await models.mygroupsModel.startSession();
    session.startTransaction();

    var mygroup = await models.mygroupsModel.findOne({userId: userId});
    if(!mygroup){
        console.log('[dao - createGroup] start to Create a new mygroup model to db');
        [err, res] = await models.mygroupsModel.create({
            userId:userId,
            normalgroups:[groupId],
            managegroups:[]
        })
        .then(res => [null, res])
        .catch(err => [err,false]);
        if(err){
            await session.abortTransaction();
            session.endSession();
            return [null, false]
        }
        console.log('[dao - createGroup] success to Create a new mygroup model to db');
    }else{
        mygroup.normalgroups.push(groupId);
        [err,res] =  await mygroup.save()
                    .then(res => [null, res])
                    .catch(err => [err]);
        if(err){
            await session.abortTransaction();
            session.endSession();
            return [null, false]
        }
    }
    models.groupModel.findByIdAndUpdate(
        { _id: groupId }, 
        { $push: { members: userId } }
    ).catch(err => [err]);
    
    if(err){
        await session.abortTransaction();
        session.endSession();
        return [null, false]
    }
    await session.commitTransaction();
    session.endSession();
    return [null, true];
}

//退出群组
exports.quitGroup =
async function quitGroup (userId, groupId) {

    // Use transaction for quit 
    var session = await models.mygroupsModel.startSession();
    session.startTransaction();
    if(await isGroupOwner(userId, groupId)){
        return await disbandGroup(userId,groupId);       //群主退出则删除该群
    }else if(await isGroupAdmin(userId, groupId)){   //admin退出
        await models.mygroupsModel.findByIdAndUpdate(
            { userId: userId }, 
            { $pull: { managegroups: groupId } }
        ).catch(err => [err]);
        if(err){
            await session.abortTransaction();
            session.endSession();
            return [null, false]
        }
        await models.groupModel.findByIdAndUpdate(
            { _id: groupId }, 
            { $pull: { managers: userId } }
        ).catch(err => [err]);
        if(err){
            await session.abortTransaction();
            session.endSession();
            return [null, false]
        }
    }else{                                       ////////////普通成员退出
        await models.mygroupsModel.findByIdAndUpdate(
            { userId: userId }, 
            { $pull: { normalgroups: groupId } }
            ).catch(err => [err]);
        if(err){
            await session.abortTransaction();
            session.endSession();
            return [null, false]
        }
        await models.groupModel.findByIdAndUpdate(
            { _id: groupId }, 
            { $pull: { members: userId } }
        ).catch(err => [err]);
        if(err){
            await session.abortTransaction();
            session.endSession();
            return [null, false]
        }
    }
    
    await session.commitTransaction();
    session.endSession();
    return [null, true];
}

//添加群组管理员
exports.addGroupManager =
async function addGroupManager (userId, groupId) {
    // Use transaction for add
    var session = await models.mygroupsModel.startSession();
    session.startTransaction();
    await models.mygroupsModel.findByIdAndUpdate(
        { userId: userId }, 
        { $push: { managegroups: groupId } }
    ).catch(err => [err]);
    if(err){
        await session.abortTransaction();
        session.endSession();
        return [null, false]
    }
    await models.mygroupsModel.findByIdAndUpdate(
        { userId: userId }, 
        { $pull: { normalgroups: groupId } }
    ).catch(err => [err]);
    if(err){
        await session.abortTransaction();
        session.endSession();
        return [null, false]
    }
    await models.groupModel.findByIdAndUpdate(
        { _id: groupId }, 
        { $push: { managers: userId } }
    ).catch(err => [err]);
    if(err){
        await session.abortTransaction();
        session.endSession();
        return [null, false]
    }
    await models.groupModel.findByIdAndUpdate(
        { _id: groupId }, 
        { $pull: { members: userId } }
    ).catch(err => [err]);
    if(err){
        await session.abortTransaction();
        session.endSession();
        return [null, false]
    }
    
    await session.commitTransaction();
    session.endSession();
    return [null, true];
}

//删除群组管理员
exports.deleteGroupManager =
async function deleteGroupManager (userId, groupId) {
    if(!(await isGroupAdmin(userId, groupId))) {
        return [null, false];
    }

    // Use transaction for delete 
    var session = await models.mygroupsModel.startSession();
    session.startTransaction();
    await models.mygroupsModel.findByIdAndUpdate(
        { userId: userId }, 
        { $pull: { managegroups: groupId } }
    ).catch(err => [err]);
    if(err){
        await session.abortTransaction();
        session.endSession();
        return [null, false]
    }
    await models.mygroupsModel.findByIdAndUpdate(
        { userId: userId }, 
        { $push: { normalgroups: groupId } }
    ).catch(err => [err]);
    if(err){
        await session.abortTransaction();
        session.endSession();
        return [null, false]
    }
    await models.groupModel.findByIdAndUpdate(
        { _id: groupId }, 
        { $pull: { managers: userId } }
    ).catch(err => [err]);
    if(err){
        await session.abortTransaction();
        session.endSession();
        return [null, false]
    }
    await models.groupModel.findByIdAndUpdate(
        { _id: groupId }, 
        { $push: { members: userId } }
    ).catch(err => [err]);
    if(err){
        models.groupModel.findByIdAndUpdate(
            { _id: groupId }, 
            { $push: { managers: userId } }
        );
        await session.abortTransaction();
        session.endSession();
        return [null, false]
    }
    
    await session.commitTransaction();
    session.endSession();
    return [null, true];
}

//获取群所有成员
exports.getGroupAllMembers =
function getGroupAllMembers (groupId) {
    return models.groupModel.find({
            _id:groupId
    })
    .populate('owner')
    .populate('managers')
    .populate('members')
    .exec()
    .then(res => [null, res])
    .catch(err => [err]);
}

//查询群成员
exports.groupMembersSearch =
function groupMembersSearch (groupId, content, fuzzy) {
    // build regex string.
    var regexContent = '^' + content + (fuzzy == 'true' ? '' : '$');
    // get member
    return models.groupModel.findOne({
        _id: groupId
    }).populate({
        path: 'owner',
        select: memberPopulateFields,
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
    }).populate({
        path: 'managers',
        select: memberPopulateFields,
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
    }).populate({
        path: 'members',
        select: memberPopulateFields,
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
    })
    .select("_id owner managers members")
    .exec()
    .then(res => [null, res])
    .catch(err => [err]);
}