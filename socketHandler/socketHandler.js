

exports.handleSocket = 
function handleSocket(io) {
    io.on('connection', (socket) => {
        console.log('user ' + socket.id + ' connected');
        socket.emit('connected', '');

        socket.on('message_chat', (content) => {
            console.log('message_chat: ' + content);
            io.emit('message_chat', {
                content: content
            });
        })

        socket.on('disconnect', () => {
            console.log('user ' + socket.id + ' disconnected');
        })
    })
}