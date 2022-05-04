const redis = require('redis');
const client = redis.createClient(6379, '127.0.0.1');

exports.connectClient =
function connectClient (cb) {
    client.on('error', err => {
        cb(err);
        client.quit();
    });
    client.connect();
}

exports.setLoginUser =
function setLoginUser (account, password, token) {
    client.hSet(account, 'password', password);
    client.hSet(account, 'token', token);
    client.expire(account, 60*60*2);
}

exports.getLoginUser =
async function getLoginUser (account, password) {
    var data = await client.hGetAll(account);
    if (password == data.password) {
        return data.token;
    }
    return undefined;
}
