const jwt = require('jsonwebtoken');
const dao = require('../database/dao');
var onlineUsers = {};
var socketid2userid = {};

function notificationTypeToEventName(type) {
    switch(type) {
        case 200: return "notification_friend_add_request";
        case 201: return "notification_friend_add_refuse";
        default: return null;
    }
}

exports.onlineUsers = onlineUsers;
exports.handleSocket = 
function handleSocket(io) {
    io.on('connection', async socket => {
        //console.log('socket ' + socket.id + ' connected');
        socket.emit('connected');
        socket.on('authorization', async (data, callback) => {
            const userInfo = jwt.decode(data);
            if (onlineUsers[userInfo._id]) {
                if (callback) { callback({ "result": false }) }
                return;
            }

            // online
            onlineUsers[userInfo._id] = socket;
            socketid2userid[socket.id] = userInfo._id;
            console.log('[Socket - authorization] user ' + userInfo._id + ' online by socketId: ' + socket.id);
            if (!(await dao.isUserExist(userInfo._id))) {
                if (callback) {
                    callback({ "result": false });
                }
                return;
            }

            // get unread messages from db
            if (callback) callback({ "result": true });
            let [err, res] = await dao.getUnreadMessages(userInfo._id);
            if (err) {
                socket.emit('unread', {
                    "errCode": 100,
                    "errMessage": err
                });
                return;
            }
            
            // get unread notifications from db
            let [err_notifications, res_notifications] = await dao.getUnreadNotifications(userInfo._id);
            if (err_notifications) {
                socket.emit('unread', {
                    "errCode": 100,
                    "errMessage": err
                });
                return;
            }
            // sort unread messages by sender
            var res_sort = {};
            //console.log("res in socket auth:");
            //console.log(res);
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
            // sort notifications by type
            var notifcxs_sort = {};
            for(const notification of res_notifications) {
                let notificationEventName = notificationTypeToEventName(notification.type);
                if(!notifcxs_sort[notificationEventName]) { 
                    notifcxs_sort[notificationEventName] = []; 
                }
                notifcxs_sort[notificationEventName].push({
                    notification
                });
            }


             /************************************************/
            // get unread Group messages from db
            if (callback) callback({ "result": true });
            [err, group_res] = await dao.getUnreadGroupMessages(userInfo._id);
            if (err) {
                socket.emit('unread', {
                    "errCode": 100,
                    "errMessage": err
                });
                return;
            }
            // 将未读消息按 group 分类
            var group_res_sort = {};
            for(const message of group_res) {
                if(!group_res_sort[message.group._id]) { 
                    group_res_sort[message.group._id] = {
                        group: message.group,
                        messages: []
                    }; 
                }
                group_res_sort[message.group._id].messages.push({
                    _id: message._id,
                    sender: message.sender,
                    content: message.content,
                    time: message.time,
                    unreadNum: message.unreaders
                });
            }

            // emit unread messages
            socket.emit('unread', {
                "result": {
                    "friend": res_sort,
                    "group": group_res_sort,
                    "notifications": notifcxs_sort
                }
            })

        })

        socket.on('message_friend', async (data, callback) => {
            var senderid = socketid2userid[socket.id];

            // check friendship
            console.log('[Socket - message_friend] ' + senderid + ' sending message to ' + data._id + ' by sockeId: ' + socket.id);
            if(!(await dao.isFriend(senderid, data._id))) {
                if (callback) {
                    callback({
                    'errCode': 603,
                    'errMessage': 'No friend relationship to target user'
                    });
                }
                return;
            }

            // check receiver exist
            if (dao.isUserExist(data._id)) {
                // insert message into db
                let [err, res] = await dao.addMessage(senderid, data._id, data.content, data.time);

                // insert failed
                if (err) {
                    if (callback) {
                        callback({
                        "errCode": 100,
                        "errMessage": err
                        });
                    }
                }
                // insert succeed
                else {
                    if (callback) {
                        callback({
                        "result": res
                        });
                    }
                    // try send to receiver by socket
                    var receiverSocket = onlineUsers[data._id];
                    if (receiverSocket) {
                        // polulate sender info
                        let [_err, _res] = await dao.getUserById(senderid, dao.senderPopulateFields);
                        res.sender = _res;
                        // emit request notification
                        receiverSocket.emit('message_friend', res);
                    }
                }
            }
            // receiver not eixist
            else {
                if (callback) {
                    callback({
                    "errCode": 601,
                    "errMessage": 'Receiver not exist'
                    });
                }
            }
        })
        
        socket.on('notification_friend_add_request', async (data, callback) => {
            var senderid = socketid2userid[socket.id];

            // check receiver exist
            if (dao.isUserExist(data._id)) {
                // check is already friend
                if(await dao.isFriend(senderid, data._id)) {
                    if(callback) {
                        callback({
                            'errCode': 503,
                            'errMessage': 'Friend relationship already exists.'
                        });
                    }
                    return;
                }

                // insert message into db
                let [err, res] = await dao.addNotification(senderid, data._id, 200, data.content, data.time);

                // insert failed
                if (err) {
                    if (callback) {
                        callback({
                        "errCode": 100,
                        "errMessage": err
                        });
                    }
                }
                // insert succeed
                else {
                    if (callback) {
                        callback({
                        "result": res
                        });
                    }
                    // try send to receiver by socket
                    var receiverSocket = onlineUsers[data._id];
                    if (receiverSocket) {
                        // polulate sender info
                        let [_err, _res] = await dao.getUserById(senderid, dao.senderPopulateFields);
                        res.sender = _res;
                        // emit new message
                        receiverSocket.emit('notification_friend_add_request', res, received => {
                            if (received) {
                                /**
                                 * NOT IMPLEMENT: set message state read
                                 */
                            }
                        });
                    }
                }
            }
            // receiver not eixist
            else {
                if (callback) {
                    callback({
                    "errCode": 601,
                    "errMessage": 'Receiver not exist'
                    });
                }
            }

        })

        socket.on('message_group', async (data, callback) => {
            var senderid = socketid2userid[socket.id];

            // check friendship
            console.log('[Socket - message_group] ' + senderid + ' sending message to group ' + data._id + ' by sockeId: ' + socket.id);
            if(!(await dao.isGroupMember(senderid, data._id))) {
                if (callback) {
                    callback({
                    'errCode': 603,
                    'errMessage': 'you are not a member of this group'
                    });
                }
                return;
            }

            // check group exist
            if (dao.existGroup(data._id)) {
                // insert groupMessage into db
                [err, res] = await dao.addGroupMessage(senderid, data._id, data.content, data.time);

                // insert failed
                if (err) {
                    if (callback) {
                        callback({
                        "errCode": 100,
                        "errMessage": err
                        });
                    }
                }
                // insert succeed
                else {
                    if (callback) {
                        callback({
                        "result": res
                        });
                    }
                    // try send to receiver by socket
                    var receiverIds = res.unreaders;
                    for(var i = 0; i < receiverIds.push(); i++){
                        var receiverSocket = onlineUsers[receiverIds[i]];
                        if (receiverSocket) {
                            // polulate group info
                            [_err, groupInfo] = await dao.getGroupById(data._id);
                            res.group = groupInfo;
                            //polulate sender info
                            [_err, _res] = await dao.getUserById(senderid, dao.senderPopulateFields);
                            res.sender = _res;
                            // emit new message
                            receiverSocket.emit('message_group', res, received => {
                                if (received) {
                                    /**
                                     *  set message state read: await dao.setGroupMessagesRead(received._id,received.groupMessageIds)
                                     */
                                }
                            });
                        }
                    }
                }
            }
            // group not eixist
            else {
                if (callback) {
                    callback({
                    "errCode": 601,
                    "errMessage": 'this group is not exist'
                    });
                }
            }
        })
        
        socket.on('notification_friend_add_refuse', async (data, callback) => {
            var senderid = socketid2userid[socket.id];
            [err, notification] = await dao.getNotificationById(data._id);
            if(err) {
                if(callback) {
                    callback({
                        "errCode": 100,
                        "errMessage": err
                    });
                }
                return;
            }
            if(notification.status != 0) {
                if(callback) {
                    callback({
                        "errCode": 100,
                        "errMessage": "This request was already refuesed."
                    });
                }
                return;
            }
            // check receiver exist
            if (notification.sender) {
                // insert message into db
                [err, res] = await dao.addNotification(senderid, notification.sender, 201, data.content, data.time);

                // insert failed
                if (err) {
                    if (callback) {
                        callback({
                        "errCode": 100,
                        "errMessage": err
                        });
                    }
                }
                // insert succeed
                else {
                    if (callback) {
                        callback({
                        "result": res
                        });
                    }
                    // mark notification result
                    await dao.markNotificationResult(data._id, senderid, 2);
                    // try send to receiver by socket
                    var receiverSocket = onlineUsers[notification.sender];
                    if (receiverSocket) {
                        // polulate sender info
                        [_err, _res] = await dao.getUserById(senderid, dao.senderPopulateFields);
                        res.sender = _res;
                        // emit refuse notification
                        receiverSocket.emit('notification_friend_add_refuse', res);

                    }
                }
            }
            // receiver not eixist
            else {
                if (callback) {
                    callback({
                    "errCode": 601,
                    "errMessage": 'Receiver not exist'
                    });
                }
            }
        })

        socket.on('disconnect', async () => {
            //console.log('socket ' + socket.id + ' disconnected');

            // remove user from online list
            var userid = socketid2userid[socket.id];
            delete socketid2userid[socket.id];
            delete onlineUsers[userid];

            if (userid) {
                console.log('[Socket - disconnect] user ' + userid + ' offline');
            }
        })
    })
}