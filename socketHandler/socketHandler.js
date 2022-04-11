const jwt = require('jsonwebtoken');
const dao = require('../database/dao');
var onlineUsers = {};
var socketid2userid = {};

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
            console.log('[Socket - authorization] user ' + userInfo._id + ' online');
            if (!(await dao.isUserExist(userInfo._id))) {
                if (callback) {
                    callback({ "result": false });
                }
                return;
            }

            // get unread messages from db
            if (callback) callback({ "result": true });
            [err, res] = await dao.getUnreadMessages(userInfo._id);
            if (err) {
                socket.emit('unread', {
                    "errCode": 100,
                    "errMessage": err
                });
                return;
            }
            
            // sort unread messages by sender
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

            // emit unread messages
            socket.emit('unread', {
                "result": {
                    "friend": res_sort
                }
            })

        })

        socket.on('message_chat', (content) => {
            console.log('message_chat: ' + content);
            io.emit('message_chat', {
                content: content
            });
        })
        
        socket.on('disconnect', async () => {
            //console.log('socket ' + socket.id + ' disconnected');

            // remove user from online list
            var userid = socketid2userid[socket.id];
            delete socketid2userid[socket.id];
            delete onlineUsers[userid];

            console.log('[Socket - disconnect] user ' + userid + ' offline');
        })
    })
}