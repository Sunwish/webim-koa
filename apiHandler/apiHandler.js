var jwt = require('jsonwebtoken');
const dao = require('../database/dao');
const path = require('path'); // 路径模块
const fs = require('fs');

const config = require('../config.json');
const jwtSecret = config.jwtSecret;
const avatarDir = path.join(__dirname, '../public/uploads/avatars/');

exports.handleApi = 
function handleApi (router) {
    router.post('/login/register', async ctx => {
        var body = ctx.request.body;
        // Check infomation integrity
        if(body.username == null || body.username == ''){
            ctx.body = {
                'errCode': 101,
                'errMessage': 'Username connot be empty.'
            };
            return;
        }
        if(body.email == null || body.email == ''){
            ctx.body = {
                'errCode': 102,
                'errMessage': 'Email connot be empty.'
            };
            return;
        }
        // Check is user exist
        [err, res] = await dao.isUserNameExist(body.username);
        if(err){
            ctx.body = {
                'errCode': 100,
                'errMessage': err
            };
            return;
        }
        if(res == true){
            ctx.body = {
                'errCode': 103,
                'errMessage': 'Username [' + body.username + '] already exists!'
            };
            return;
        }
        [err, res] = await dao.isEmailExist(body.email)
        if(err){
            ctx.body = {
                'errCode': 100,
                'errMessage': err
            };
            return;
        }
        if(res == true){
            ctx.body = {
                'errCode': 104,
                'errMessage': 'Email [' + body.email + '] already exists!'
            };
            return;
        }
        // Add user
        console.log('[apiHandler - POST login/register] Adding new user to db.');
        var defulatAvarar = 'blank-avatar.png';
        [err, res] = await dao.addUser({
            'username': body.username,
            'password': body.password,
            'email': body.email,
            'avatar': defulatAvarar,
            'imgUrl': ctx.request.header.host + '/uploads/avatars/' + defulatAvarar,
            'nickname': body.username
        });
        ctx.body = {
            'errCode': err != null ? 100 : null,
            'errMessage': err,
            'result': res
        }
    })
    router.get('/users', async ctx => {
        [err, res] = await dao.getAllUsers();
        ctx.body = {
            'errMessage': err,
            'result': res
        }
    })
    router.post('/login/login', async ctx => {
        var body = ctx.request.body;
        var err, res, errMessage;
        if(+body.loginType == 0) {
            [err, res] = await dao.getUserByUsername(body.account);
        }
        else if(+body.loginType == 1) {
            [err, res] = await dao.getUserByEmail(body.account);
        }
        if(err != null){
            ctx.body = {
                'errCode': err != null ? 100 : null,
                'errMessage': err
            }
            return;
        }
        else if(res == null){
            ctx.body = {
                'errCode': 201,
                'errMessage': 'Account [' + body.account + '] does not exist.'
            }
            return;
        }
        else {
            if(res.password != body.password) {
                ctx.body = {
                    'errCode': 202,
                    'errMessage': 'Incorrect password.'
                }
            } else {
                // Login success
                const token = jwt.sign(res.toJSON(), jwtSecret, {
                    expiresIn: 365 * 60 * 60 * 24 // 365 * 24 hours
                })
                res.password = undefined;
                ctx.body = {
                    'result': res,
                    'token': token
                }
            }
        }
    })
    router.post('/upload/avatar', async ctx => {
        // 身份认证
        const userInfo = jwt.decode(ctx.header.authorization.split(' ')[1]);
        if(userInfo == null) {
            console.log('[apiHandler - POST upload/avatar] Authorization invalid.');
            ctx.body = {
                'errCode': 301,
                'errMessage': 'authorization invalid',
            };
            return;
        }

        // 上传图像参数验证
        if(!ctx.request.files || !ctx.request.files.file || !ctx.request.files.file.path || !ctx.request.files.file.name) {
            console.log('param error');
            ctx.body = {
                'errCode': 302,
                'errMessage': 'param error',
            };
            return;
        }
        const file = ctx.request.files.file;
        // 创建读取流
        const reader = fs.createReadStream(file.path);
        const fileName = userInfo._id + '-' + Date.now() + '.jpg';
        const filePath = avatarDir + fileName;
        // 创建写入流
        const upStream = fs.createWriteStream(filePath);
        upStream.on('error', () => {
            console.log('server file path error');
            ctx.body = {
                'errCode': 100,
                'errMessage': 'server file path error',
            };
            return;
        });

        // 从读取流通过管道写进写入流
        console.log('[apiHandler - POST upload/avatar] Piping avatar file to server disk.');
        await new Promise((resolve, reject) => {
            reader.pipe(upStream).on('finish', async () => {
                console.log('[apiHandler - POST upload/avatar] Pipe file finish.');

                // 更新头像
                [err, res] = await dao.updateUserAvatar(userInfo._id, fileName, ctx.request.header.host + '/uploads/avatars/' + fileName);
                if(err != null){
                    ctx.body = {
                        'errCode': 304,
                        'errMessage': err,
                        'result': {
                            'avatar': fileName,
                            'imgUrl': ctx.request.header.host + '/uploads/avatars/' + fileName
                        }
                    }
                } else {
                    ctx.body = {
                        'result' : {
                            'avatar': fileName,
                            'imgUrl' : ctx.request.header.host + '/uploads/avatars/' + fileName
                        }
                    };
                }
                resolve();
            }).on('error', (err) => {
                console.log('[apiHandler - POST upload/avatar] Pipe file error.');
                ctx.body = {
                    'errCode': 100,
                    'errMessage': 'pipe file error',
                };
                reject(err)
            });
        });
    })
    router.post('/update/avatar', async ctx => {
        // 获取身份信息
        const userInfo = jwt.decode(ctx.header.authorization.split(' ')[1]);
        if(userInfo == null) {
            console.log('[apiHandler - POST update/avatar] Authorization invalid.');
            ctx.body = {
                'errCode': 301,
                'errMessage': 'authorization invalid',
            };
            return;
        }

        // 验证指定头像文件是否存在
        var body = ctx.request.body;
        if(!fs.existsSync(avatarDir + body.avatar)) {
            ctx.body = {
                'errCode': 303,
                'errMessage': 'Avatar file [' + body.avatar + '] is not found.'
            }
            return;
        }

        // 修改头像
        console.log('[apiHandler - POST update/avatar] Updating user ' + userInfo._id + '\'s avatar');
        [err, res] = await dao.updateUserAvatar(userInfo._id, body.avatar, ctx.request.header.host + '/uploads/avatars/' + body.avatar);

        if(err != null){
            ctx.body = {
                'errCode': err != null ? 100 : null,
                'errMessage': err
            }
            return;
        }
        ctx.body = {
            'result': {
                avatar: res.avatar,
                imgUrl: res.imgUrl
            }
        };

    })
    router.get('/getAcc', async ctx => {
        // 获取身份信息
        const userInfo = jwt.decode(ctx.header.authorization.split(' ')[1]);
        if(userInfo == null) {
            console.log('[apiHandler - GET getAcc] Authorization invalid.');
            ctx.body = {
                'errCode': 301,
                'errMessage': 'authorization invalid',
            };
            return;
        }
        [err, res] = await dao.getUserById(userInfo._id);
        if(err != null){
            ctx.body = {
                'errCode': err != null ? 100 : null,
                'errMessage': err
            }
            return;
        }
        else if(res == null){
            ctx.body = {
                'errCode': 201,
                'errMessage': 'Account [' + body.account + '] does not exist.'
            }
            return;
        }
        res.password = undefined;
        ctx.body = {
            'result': res
        }
    })
    router.post('/changeAccInform', async ctx => {
        // 获取身份信息
        const userInfo = jwt.decode(ctx.header.authorization.split(' ')[1]);
        if(userInfo == null) {
            console.log('[apiHandler - POST changeAccInform] Authorization invalid.');
            ctx.body = {
                'errCode': 301,
                'errMessage': 'authorization invalid',
            };
            return;
        }
        var accInfo = ctx.request.body;
        [err, res] = await dao.updateUserInfo(userInfo._id, accInfo);

        if(err != null){
            ctx.body = {
                'errCode': err != null ? 100 : null,
                'errMessage': err
            }
            return;
        }

        res.password = undefined;
        ctx.body = {
            'result': res
        };
    })
    
    router.post('/friend', async ctx => {
        // 获取身份信息
        const userInfo = jwt.decode(ctx.header.authorization.split(' ')[1]);
        if(userInfo == null) {
            console.log('[apiHandler - POST friend] Authorization invalid.');
            ctx.body = {
                'errCode': 301,
                'errMessage': 'authorization invalid',
            };
            return;
        }
        var targetId = ctx.request.body._id;
        // 验证目标用户id合法性
        if (!(await dao.isUserExist(targetId))) {
            ctx.body = {
                'errCode': 502,
                'errMessage': 'target user _id invalid'
            }
            return;
        }
        // 验证是否不是好友
        if (await dao.isFriend(userInfo._id, targetId)) {
            ctx.body = {
                'errCode': 503,
                'errMessage': 'Friend relationship already exists.'
            }
            return;
        }

        [err, res] = await dao.addFriend(userInfo._id, targetId)
        if(err != null){
            ctx.body = {
                'errCode': err != null ? 100 : null,
                'errMessage': err
            }
            return;
        }
        ctx.body = {
            'result': res
        };
    })

    router.delete('/friend', async ctx => {
        // 获取身份信息
        const userInfo = jwt.decode(ctx.header.authorization.split(' ')[1]);
        if(userInfo == null) {
            console.log('[apiHandler - DELETE friend] Authorization invalid.');
            ctx.body = {
                'errCode': 301,
                'errMessage': 'authorization invalid',
            };
            return;
        }
        var targetId = ctx.request.query._id;
        // 验证目标用户id合法性
        if (!(await dao.isUserExist(targetId))) {
            ctx.body = {
                'errCode': 502,
                'errMessage': 'target user _id invalid'
            }
            return;
        }
        // 验证是否不是好友
        if (!(await dao.isFriend(userInfo._id, targetId))) {
            ctx.body = {
                'errCode': 504,
                'errMessage': 'friend relationship not exist.'
            }
            return;
        }

        [err, res] = await dao.deleteFriend(userInfo._id, targetId)
        if(err != null){
            ctx.body = {
                'errCode': err != null ? 100 : null,
                'errMessage': err
            }
            return;
        }
        ctx.body = {
            'result': res
        };

    })

    router.get('/friends', async ctx => {
        // 获取身份信息
        const userInfo = jwt.decode(ctx.header.authorization.split(' ')[1]);
        if(userInfo == null) {
            console.log('[apiHandler - GET friends] Authorization invalid.');
            ctx.body = {
                'errCode': 301,
                'errMessage': 'authorization invalid',
            };
            return;
        }

        [err, res] = await dao.getFriends(userInfo._id);
        if(err != null){
            ctx.body = {
                'errCode': err != null ? 100 : null,
                'errMessage': err
            }
            return;
        }
        
        if(!res) { res = { 'friends': [] } }
        ctx.body = {
            'result': res
        };
        
    })
    
    router.get('/friendsSearch', async ctx => {
        // 获取身份信息
        const userInfo = jwt.decode(ctx.header.authorization.split(' ')[1]);
        if(userInfo == null) {
            console.log('[apiHandler - GET friendsSearach] Authorization invalid.');
            ctx.body = {
                'errCode': 301,
                'errMessage': 'authorization invalid',
            };
            return;
        }

        [err, res] = await dao.friendsSearch(userInfo._id, ctx.query.content, ctx.query.fuzzy);
        if(err != null){
            ctx.body = {
                'errCode': err != null ? 100 : null,
                'errMessage': err
            }
            return;
        }
        
        if(!res) { res = { 'friends': [] } }
        ctx.body = {
            'result': res
        };
    })

    router.get('/usersSearch', async ctx => {
        [err, res] = await dao.usersSearch(ctx.query.content, ctx.query.fuzzy);
        if(err != null){
            ctx.body = {
                'errCode': err != null ? 100 : null,
                'errMessage': err
            }
            return;
        }
        
        ctx.body = {
            'result': {
                'users': res
            }
        };
    })

    router.post('/message', async ctx => {
        // 获取身份信息
        const userInfo = jwt.decode(ctx.header.authorization.split(' ')[1]);
        if(userInfo == null) {
            console.log('[apiHandler - POST message] Authorization invalid.');
            ctx.body = {
                'errCode': 301,
                'errMessage': 'authorization invalid',
            };
            return;
        }

        // 验证id合法性
        var body = ctx.request.body;
        if(!(await dao.isUserExist(userInfo._id))) {
            ctx.body = {
                'errCode': 600,
                'errMessage': 'Sender not exist'
            }
            return;
        }
        if(!(await dao.isUserExist(body._id))) {
            ctx.body = {
                'errCode': 601,
                'errMessage': 'Receiver not exist'
            }
            return;
        }

        // 验证好友关系
        if(!(await dao.isFriend(userInfo._id, body._id))) {
            ctx.body = {
                'errCode': 603,
                'errMessage': 'No friend relationship to target user'
            }
            return;
        }

        [err, res] = await dao.addMessage(userInfo._id, body._id, body.content, body.time);

        if(err != null){
            ctx.body = {
                'errCode': err != null ? 100 : null,
                'errMessage': err
            }
            return;
        }
        
        ctx.body = {
            'result': res
        };
    })

    router.get('/friendMessages', async ctx => {
        // 获取身份信息
        const userInfo = jwt.decode(ctx.header.authorization.split(' ')[1]);
        if(userInfo == null) {
            console.log('[apiHandler - GET friendMessages] Authorization invalid.');
            ctx.body = {
                'errCode': 301,
                'errMessage': 'authorization invalid',
            };
            return;
        }

        // 验证id合法性
        var query = ctx.query;
        if(!(await dao.isUserExist(userInfo._id))) {
            ctx.body = {
                'errCode': 600,
                'errMessage': 'Sender not exist'
            }
            return;
        }
        if(!(await dao.isUserExist(query._id))) {
            ctx.body = {
                'errCode': 601,
                'errMessage': 'Receiver not exist'
            }
            return;
        }
        
        [err, res] = await dao.getFriendMessages(userInfo._id, query._id, query.startIndex, query.count);
        
        if(err != null){
            ctx.body = {
                'errCode': err != null ? 100 : null,
                'errMessage': err
            }
            return;
        }
        
        ctx.body = {
            'result': res
        };

    })

    router.get('/unreadMessages', async ctx => {
        // 获取身份信息
        const userInfo = jwt.decode(ctx.header.authorization.split(' ')[1]);
        if(userInfo == null) {
            console.log('[apiHandler - GET unreadMessages] Authorization invalid.');
            ctx.body = {
                'errCode': 301,
                'errMessage': 'authorization invalid',
            };
            return;
        }

        // 验证id合法性
        var query = ctx.query;
        if(!(await dao.isUserExist(userInfo._id))) {
            ctx.body = {
                'errCode': 600,
                'errMessage': 'Self not exist'
            }
            return;
        }

        [err, res] = await dao.getUnreadMessages(userInfo._id);
        
        if(err != null){
            ctx.body = {
                'errCode': err != null ? 100 : null,
                'errMessage': err
            }
            return;
        }
        
        // 将未读消息按 sender 分类
        var res_sort = {};
        for(const message of res) {
            if(!res_sort[message.sender._id]) { 
                res_sort[message.sender._id] = {
                    sender: message.sender,
                    messages: []
                }; 
            }
            res_sort[message.sender._id].messages.push({
                _id: message._id,
                content: message.content,
                time: message.time
            });
        }

        ctx.body = {
            'result': res_sort
        };
    })

    router.put('/messagesRead', async ctx => {
        // 获取身份信息
        const userInfo = jwt.decode(ctx.header.authorization.split(' ')[1]);
        if(userInfo == null) {
            console.log('[apiHandler - PUT messageRead] Authorization invalid.');
            ctx.body = {
                'errCode': 301,
                'errMessage': 'authorization invalid',
            };
            return;
        }

        // 验证id合法性
        var body = ctx.request.body;
        if(!(await dao.isUserExist(userInfo._id))) {
            ctx.body = {
                'errCode': 600,
                'errMessage': 'Self not exist'
            }
            return;
        }

        [err, res] = await dao.setMessagesRead(userInfo._id, body._ids);
        
        if(err != null){
            ctx.body = {
                'errCode': err != null ? 100 : null,
                'errMessage': err
            }
            return;
        }
        
        ctx.body = {
            'result': res
        };

    })

    router.put('/messagesReadFrom', async ctx => {
        // 获取身份信息
        const userInfo = jwt.decode(ctx.header.authorization.split(' ')[1]);
        if(userInfo == null) {
            console.log('[apiHandler - PUT messageReadFrom] Authorization invalid.');
            ctx.body = {
                'errCode': 301,
                'errMessage': 'authorization invalid',
            };
            return;
        }

        // 验证id合法性
        var body = ctx.request.body;
        if (!dao.isObjectIdValid(userInfo._id)) {
            ctx.body = {
                'errCode': 600,
                'errMessage': 'Self not exist'
            }
            return;
        }
        if (!dao.isObjectIdValid(body._id)) {
            ctx.body = {
                'errCode': 601,
                'errMessage': 'Sender not exist'
            }
            return;
        }

        [err, res] = await dao.setMessagesReadFrom(userInfo._id, body._id);
        
        if(err != null){
            ctx.body = {
                'errCode': err != null ? 100 : null,
                'errMessage': err
            }
            return;
        }
        
        ctx.body = {
            'result': res
        };

    })

    /////////////////////////////////////////////////////////////////////////////////////////// 群组api
    //上传群组头像
    router.post('/groups/uploadavatar', async ctx => {
        // 身份认证
        const userInfo = jwt.decode(ctx.header.authorization.split(' ')[1]);
        if(userInfo == null || (! (await dao.hasAdminAuth(userInfo._id, body.groupId)) && ! (await dao.hasGroupOwnerAuth(userInfo._id, body.groupId)) )) {
            console.log('authorization invalid');
            ctx.body = {
                'errCode': 301,
                'errMessage': 'authorization invalid',
            };
            return;
        }

        // 上传图像参数验证
        if(!ctx.request.files || !ctx.request.files.file || !ctx.request.files.file.path || !ctx.request.files.file.name) {
            console.log('param error');
            ctx.body = {
                'errCode': 302,
                'errMessage': 'param error',
            };
            return;
        }
        const file = ctx.request.files.file;
        var groupInfo = ctx.request.body;
        // 创建读取流
        const reader = fs.createReadStream(file.path);
        const fileName = groupInfo._id + '-' + Date.now() + '.jpg';
        const filePath = avatarDir + fileName;
        // 创建写入流
        const upStream = fs.createWriteStream(filePath);
        upStream.on('error', () => {
            console.log('server file path error');
            ctx.body = {
                'errCode': 100,
                'errMessage': 'server file path error',
            };
            return;
        });

        // 从读取流通过管道写进写入流
        await new Promise((resolve, reject) => {
            reader.pipe(upStream).on('finish', async () => {
                console.log('pipe file finish');

                // 更新头像
                [err, res] = await dao.updateGroupAvatar(groupInfo._id, fileName, ctx.request.header.host + '/uploads/avatars/' + fileName);
                if(err != null){
                    ctx.body = {
                        'errCode': 304,
                        'errMessage': err,
                        'result': {
                            'avatar': fileName,
                            'imgUrl': ctx.request.header.host + '/uploads/avatars/' + fileName
                        }
                    }
                } else {
                    ctx.body = {
                        'result' : {
                            'avatar': fileName,
                            'imgUrl' : ctx.request.header.host + '/uploads/avatars/' + fileName
                        }
                    };
                }
                resolve();
            }).on('error', (err) => {
                console.log('pipe file error');
                ctx.body = {
                    'errCode': 100,
                    'errMessage': 'pipe file error',
                };
                reject(err)
            });
        });
    })

    //更新群组头像
    router.post('/groups/updateavatar', async ctx => {
        // 获取身份信息
        const userInfo = jwt.decode(ctx.header.authorization.split(' ')[1]);
        var body = ctx.request.body;

        if(userInfo == null ) {
            console.log('authorization invalid');
            ctx.body = {
                'errCode': 301,
                'errMessage': 'authorization invalid',
            };
            return;
        }
        if(! (await dao.hasAdminAuth(userInfo._id, body.groupId)) && ! (await dao.hasGroupOwnerAuth(userInfo._id, body.groupId)) ) {
            console.log('authorization invalid');
            ctx.body = {
                'errCode': 301,
                'errMessage': "you don't have authorization to update group avatar!!",
            };
            return;
        }
        // 验证指定头像文件是否存在
        if(!fs.existsSync(avatarDir + body.avatar)) {
            ctx.body = {
                'errCode': 303,
                'errMessage': 'Avatar file [' + body.avatar + '] is not found.'
            }
            return;
        }

        // 修改头像
        [err, res] = await dao.updateUserAvatar(userInfo._id, body.avatar, ctx.request.header.host + '/uploads/avatars/' + body.avatar);

        if(err != null){
            ctx.body = {
                'errCode': err != null ? 100 : null,
                'errMessage': err
            }
            return;
        }
        ctx.body = {
            'result': {
                avatar: res.avatar,
                imgUrl: res.imgUrl
            }
        };

    })
    //创建群组
    router.post('/groups/create', async ctx => {
        const userInfo = jwt.decode(ctx.header.authorization.split(' ')[1]);
        var body = ctx.request.body;

        if(userInfo == null) {
            console.log('authorization invalid');
            ctx.body = {
                'errCode': 301,
                'errMessage': 'authorization invalid',
            };
            return;
        }
        // Check infomation integrity
        if(body.groupnickname == null || body.groupnickname == ''){
            ctx.body = {
                'errCode': 201,
                'errMessage': 'groupnickname connot be empty.'
            };
            return;
        }
        // create group
        var defulatAvarar = 'blank-avatar.png';
        [err, res] = await dao.createGroup({
            'groupnickname': body.groupnickname,
            'groupnumber': 0,
            'createday': Date.now(),
            'capacity':200,
            'memnumber':1,
            'avatar': defulatAvarar,
            'imgUrl': ctx.request.header.host + '/uploads/avatars/' + defulatAvarar,
            'owner':userInfo._id,
            'managers':[],
            'members':[]
        });

        ctx.body = {
            'errCode': !res ? 202 : null,
            'errMessage': !res ? "failure to create a new group!"+err : null,
            'result': !res ? null : "success to create a new group!",
        }
        return; 
    })

    //搜索群组
    router.get('/groups/Search', async ctx => {
        const userInfo = jwt.decode(ctx.header.authorization.split(' ')[1]);

        if(userInfo == null) {
            console.log('authorization invalid');
            ctx.body = {
                'errCode': 301,
                'errMessage': 'authorization invalid',
            };
            return;
        }
        // search group
        if(ctx.query.searchField == 0){
            [err, res] = await dao.groupSearch(ctx.query.content, ctx.query.searchType);
            ctx.body = {
                'errCode': err != null ? 203 : null,
                'errMessage': err,
                'result': res
            }
        }else if(ctx.query.searchField == 1){
            [err, res] = await dao.myNormalGroupsSearch(userInfo._id, ctx.query.content, ctx.query.searchType);
            ctx.body = {
                'errCode': err != null ? 203 : null,
                'errMessage': err,
                'result': res
            }
        }else if(ctx.query.searchField == 2){
            [err, res] = await dao.myManageGroupsSearch(userInfo._id, ctx.query.content, ctx.query.searchType);
            ctx.body = {
                'errCode': err != null ? 203 : null,
                'errMessage': err,
                'result': res
            }
        }else{
            ctx.body = {
                'errCode': 211,
                'errMessage': "error searchField"
            }
        }
        
    })

    //获取我管理的群组
    router.get('/groups/getMyManageGroups', async ctx => {
        const userInfo = jwt.decode(ctx.header.authorization.split(' ')[1]);
        var body = ctx.request.body;

        if(userInfo == null) {
            console.log('authorization invalid');
            ctx.body = {
                'errCode': 301,
                'errMessage': 'authorization invalid',
            };
            return;
        }
        // get myManageGroups
        [err, res] = await dao.getMyManageGroups(userInfo._id);
        ctx.body = {
            'errCode': err != null ? 203 : null,
            'errMessage': err,
            'result': res
        }
    })

    //获取我普通群组
    router.get('/groups/getMyNormalGroups', async ctx => {
        const userInfo = jwt.decode(ctx.header.authorization.split(' ')[1]);
        var body = ctx.request.body;

        if(userInfo == null) {
            console.log('authorization invalid');
            ctx.body = {
                'errCode': 301,
                'errMessage': 'authorization invalid',
            };
            return;
        }
        // get myManageGroups
        [err, res] = await dao.getMyNormalGroups(userInfo._id);
        ctx.body = {
            'errCode': err != null ? 203 : null,
            'errMessage': err,
            'result': res
        }
    })

    //修改群组名
    router.post('/groups/updateGroupName', async ctx => {
        const userInfo = jwt.decode(ctx.header.authorization.split(' ')[1]);
        var body = ctx.request.body;

        if(userInfo == null ) {
            console.log('authorization invalid');
            ctx.body = {
                'errCode': 301,
                'errMessage': 'authorization invalid',
            };
            return;
        }
        if(!(await dao.existGroup(body.groupId))){
            console.log('authorization invalid');
            ctx.body = {
                'errCode': 301,
                'errMessage': "this group isn't exist!!",
            };
            return;
        }
        if(! (await dao.hasAdminAuth(userInfo._id, body.groupId)) && ! (await dao.hasGroupOwnerAuth(userInfo._id, body.groupId)) ) {
            console.log('authorization invalid');
            ctx.body = {
                'errCode': 301,
                'errMessage': "you don't have authorization to update group name!!",
            };
            return;
        }
        //  update GroupName
        [err, res] = await dao.updateGroupName(body.groupId, body.newgroupnickname);
        ctx.body = {
            'errCode': err != null ? 204 : null,
            'errMessage': err,
            'result': res
        }
    })

    //解散群组
    router.delete('/groups/disbandGroup', async ctx => {
        const userInfo = jwt.decode(ctx.header.authorization.split(' ')[1]);

        if(userInfo == null) {
            console.log('authorization invalid');
            ctx.body = {
                'errCode': 301,
                'errMessage': 'authorization invalid',
            };
            return;
        }
        
        if(!(await dao.existGroup(ctx.query.groupId))){
            console.log('authorization invalid');
            ctx.body = {
                'errCode': 301,
                'errMessage': "this group isn't exist!!",
            };
            return;
        }

        if(! (await dao.hasGroupOwnerAuth(userInfo._id, ctx.query.groupId)) ) {
            console.log('authorization invalid');
            ctx.body = {
                'errCode': 301,
                'errMessage': "you don't have authorization to disband this group!!",
            };
            return;
        }
        //  disband Group 
        [err, res] = await dao.disbandGroup(ctx.query.groupId);
        ctx.body = {
            'errCode': !res ? 205 : null,
            'errMessage': !res ? "failure to disband a group!" : null,
            'result': res ? "success to disband a group!" : null
        }
    })

    //加入群组
    router.post('/groups/joinGroup', async ctx => {
        const userInfo = jwt.decode(ctx.header.authorization.split(' ')[1]);
        var body = ctx.request.body;

        if(userInfo == null) {
            console.log('authorization invalid');
            ctx.body = {
                'errCode': 301,
                'errMessage': 'authorization invalid',
            };
            return;
        }
        
        if(!(await dao.existGroup(body.groupId))){
            console.log('authorization invalid');
            ctx.body = {
                'errCode': 301,
                'errMessage': "this group isn't exist!!",
            };
            return;
        }
        if(await dao.isGroupMember(userInfo._id, body.groupId)){
            ctx.body = {
                'Message': "has already join this group!!!"
            }
            return;
        }
        //  join a Group 
        [err, res] = await dao.joinGroup(userInfo._id, body.groupId);
        ctx.body = {
            'errCode': !res ? 206 : null,
            'errMessage': !res ? "failure to join a group!" : null,
            'result': res ? "success to join a group!" : null
        }
    })
    
    //邀请加入群组
    router.post('/groups/inviteJoinGroup', async ctx => {
        const userInfo = jwt.decode(ctx.header.authorization.split(' ')[1]);
        var body = ctx.request.body;

        if(userInfo == null) {
            console.log('authorization invalid');
            ctx.body = {
                'errCode': 301,
                'errMessage': 'authorization invalid',
            };
            return;
        }

        if(!(await dao.existGroup(body.groupId))){
            console.log('authorization invalid');
            ctx.body = {
                'errCode': 301,
                'errMessage': "this group isn't exist!!",
            };
            return;
        }

        if(! (await dao.hasAdminAuth(userInfo._id, body.groupId)) && ! (await dao.hasGroupOwnerAuth(userInfo._id, body.groupId)) ){
            ctx.body = {
                'Message': "you don't have authorization to invite others to join this group!!!"
            }
            return;
        }

        if(await dao.isGroupMember(body.userId, body.groupId)){
            ctx.body = {
                'Message': "this user has already join this group!!!"
            }
            return;
        }
        
        //  join a Group 
        [err, res] = await dao.joinGroup(body.userId, body.groupId);
        ctx.body = {
            'errCode': !res ? 206 : null,
            'errMessage': !res ? "failure to invite others to join this group!" : null,
            'result': res ? "success to invite others to join this group!" : null
        }
    })

    //退出群组
    router.delete('/groups/quitGroup', async ctx => {
        const userInfo = jwt.decode(ctx.header.authorization.split(' ')[1]);

        if(userInfo == null) {
            console.log('authorization invalid');
            ctx.body = {
                'errCode': 301,
                'errMessage': 'authorization invalid',
            };
            return;
        }
        
        if(!(await dao.existGroup(ctx.query.groupId))){
            console.log('authorization invalid');
            ctx.body = {
                'errCode': 301,
                'errMessage': "this group isn't exist!!",
            };
            return;
        }
        if(!(await dao.isGroupMember(userInfo._id, ctx.query.groupId))) {
            ctx.body = {
                'Message': "you hasn't join this group!!!"
            }
            return ;
        }
        //  quit a Group 
        [err, res] = await dao.quitGroup(userInfo._id, ctx.query.groupId);
        ctx.body = {
            'errCode': !res ? 207 : null,
            'errMessage': !res ? "failure to quit a group!" : null,
            'result': res ? "success to quit a group!" : null
        }
    })

    //踢出群组
    router.delete('/groups/kickOutGroup', async ctx => {
        const userInfo = jwt.decode(ctx.header.authorization.split(' ')[1]);
        if(userInfo == null) {
            console.log('authorization invalid');
            ctx.body = {
                'errCode': 301,
                'errMessage': 'authorization invalid',
            };
            return;
        }
        
        if(!(await dao.existGroup(ctx.query.groupId))){
            ctx.body = {
                'errCode': 301,
                'errMessage': "this group isn't exist!!",
            };
            return;
        }

        if(!(await dao.isGroupMember(ctx.query.userId, ctx.query.groupId))) {
            ctx.body = {
                'Message': "the people who you want to kickOut hasn't join this group!!!"
            }
            return ;
        }
        
        if(await dao.hasGroupOwnerAuth(userInfo._id, ctx.query.groupId)){
            [err, res] = await dao.quitGroup(ctx.query.userId, ctx.query.groupId);
            ctx.body = {
                'errCode': !res ? 207 : null,
                'errMessage': !res ? "failure to kick user Out of this group!" : null,
                'result': res ? "success to kick user Out of this group!" : null
            }
            return;
        }
        
        if((await dao.hasAdminAuth(userInfo._id, ctx.query.groupId)) && (await dao.isNormalMember(ctx.query.userId, ctx.query.groupId))){
            [err, res] = await dao.quitGroup(body.userId, ctx.query.groupId);
            ctx.body = {
                'errCode': !res ? 207 : null,
                'errMessage': !res ? "failure to kick user Out of this group!" : null,
                'result': res ? "success to kick user Out of this group!" : null
            }
        }
        ctx.body = {
            'Message': "you don't have authorization to kick others Out of this group!!!"
        }
        return;
    })

    //添加群组管理员
    router.post('/groups/addGroupManager', async ctx => {
        const userInfo = jwt.decode(ctx.header.authorization.split(' ')[1]);
        var body = ctx.request.body;

        if(userInfo == null) {
            console.log('authorization invalid');
            ctx.body = {
                'errCode': 301,
                'errMessage': 'authorization invalid',
            };
            return;
        }
        if(!(await dao.isUserExist(body.userId))){
            console.log('authorization invalid');
            ctx.body = {
                'errCode': 301,
                'errMessage': "this user isn't exist!!",
            };
            return;
        }
        if(!(await dao.existGroup(body.groupId))){
            console.log('authorization invalid');
            ctx.body = {
                'errCode': 301,
                'errMessage': "this group isn't exist!!",
            };
            return;
        }
        if( !(await dao.hasGroupOwnerAuth(userInfo._id, body.groupId))) {
            console.log('authorization invalid');
            ctx.body = {
                'errCode': 301,
                'errMessage': "you don't have authorization to add a group manager!!",
            };
            return;
        }
        
        if(!(await dao.isNormalMember(body.userId, body.groupId))) {
            ctx.body = {
                'errCode': 301,
                'errMessage': 'the people has already been one of the manager of this group!! ',
            };
            return;
        }

        //  add a Group Manager
        [err, res] = await dao.addGroupManager(body.userId, body.groupId);
        ctx.body = {
            'errCode': !res ? 208 : null,
            'errMessage': !res ? "failure to add a Group Manager!" : null,
            'result': res ? "success to add a Group Manager!" : null
        }
    })

    //删除群组管理员身份
    router.delete('/groups/deleteGroupManager', async ctx => {
        const userInfo = jwt.decode(ctx.header.authorization.split(' ')[1]);

        if(userInfo == null ) {
            console.log('authorization invalid');
            ctx.body = {
                'errCode': 301,
                'errMessage': 'authorization invalid',
            };
            return;
        }
        if(!(await dao.isUserExist(ctx.query.userId))){
            console.log('authorization invalid');
            ctx.body = {
                'errCode': 301,
                'errMessage': "this user isn't exist!!",
            };
            return;
        }
        if(!(await dao.existGroup(ctx.query.groupId))){
            console.log('authorization invalid');
            ctx.body = {
                'errCode': 301,
                'errMessage': "this group isn't exist!!",
            };
            return;
        }

        if( !(await dao.hasGroupOwnerAuth(userInfo._id, ctx.query.groupId))) {
            console.log('authorization invalid');
            ctx.body = {
                'errCode': 301,
                'errMessage': "you don't have authorization to delete a group manager!!",
            };
            return;
        }
        //  delete a Group Manager
        [err, res] = await dao.deleteGroupManager(ctx.query.userId, ctx.query.groupId);
        ctx.body = {
            'errCode': !res ? 208 : null,
            'errMessage': !res ? "failure to delete a Group Manager!" : null,
            'result': res ? "success to delete a Group Manager!" : null
        }
    })

    //获取群所有成员
    router.get('/groups/getGroupAllMembers', async ctx => {
        const userInfo = jwt.decode(ctx.header.authorization.split(' ')[1]);
        var body = ctx.request.body;

        if(userInfo == null) {
            console.log('authorization invalid');
            ctx.body = {
                'errCode': 301,
                'errMessage': 'authorization invalid',
            };
            return;
        }
        if(!(await dao.existGroup(ctx.query.groupId))){
            ctx.body = {
                'errCode': 301,
                'errMessage': "this group isn't exist!!",
            };
            return;
        }
        if(!(await dao.isGroupMember(userInfo._id, ctx.query.groupId))){
            console.log('authorization invalid');
            ctx.body = {
                'errCode': 301,
                'errMessage': "you are not one of this group,and don't have authorization to search!",
            };
            return;
        }
        // get Group All Members
        [err, res] = await dao.getGroupAllMembers(ctx.query.groupId);
        ctx.body = {
            'errCode': err != null ? 209 : null,
            'errMessage': err,
            'result': res
        }
    })

    //查询群成员
    router.get('/groups/groupMembersSearch', async ctx => {
        const userInfo = jwt.decode(ctx.header.authorization.split(' ')[1]);

        if(userInfo == null) {
            console.log('authorization invalid');
            ctx.body = {
                'errCode': 301,
                'errMessage': 'authorization invalid',
            };
            return;
        }
        if(!(await dao.existGroup(ctx.query.groupId))){
            ctx.body = {
                'errCode': 301,
                'errMessage': "this group isn't exist!!",
            };
            return;
        }
        if(!(await dao.isGroupMember(userInfo._id, ctx.query.groupId))){
            console.log('authorization invalid');
            ctx.body = {
                'errCode': 301,
                'errMessage': "you are not one of this group,and don't have authorization to search!",
            };
            return;
        }
        // search Group  Member
        [err, res] = await dao.groupMembersSearch(ctx.query.groupId, ctx.query.content, ctx.query.fuzzy);
        ctx.body = {
            'errCode': err != null ? 210 : null,
            'errMessage': err,
            'result': res
        }
    })


    router.get('/test/user/:_id', async ctx => {
        [err, res] = await dao.getUserById(ctx.params._id);
        if(err != null){
            ctx.body = {
                'errCode': err != null ? 100 : null,
                'errMessage': err
            }
            return;
        }
        else if(res == null){
            ctx.body = {
                'errCode': 201,
                'errMessage': 'Account _id [' + ctx.params._id + '] does not exist.'
            }
            return;
        }
        ctx.body = {
            'result': res
        }
    })
    // 测试一下
    router.get('/', async cxt => {
        cxt.body = 'Hello Web IM Api!';
    })
    // 地址 query
    router.get('/test', async ctx => {
        ctx.body = ctx.query;
    })
    // 路由参数
    router.get('/test/:msg', async ctx => {
        ctx.body = ctx.params;
    })
    // POST body
    router.post('/test', async ctx => {
        ctx.body = ctx.request.body;
    })
}