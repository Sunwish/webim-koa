var jwt = require('jsonwebtoken');
const dao = require('../database/dao');
const path = require('path'); // 路径模块

const jwtSecret = require('../config.json').jwtSecret;

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
        [err, res] = await dao.addUser({
            'username': body.username,
            'password': body.password,
            'email': body.email,
            'avatar': body.avater
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
                    expiresIn: 60 * 60 * 24 // 24 hours
                })
                ctx.body = {
                    'result': res,
                    'token': token
                }
            }
        }
    })
    router.post('/upload', async ctx => {
        if(!ctx.request.files || !ctx.request.files.file || !ctx.request.files.file.path || !ctx.request.files.file.name) {
            console.log('param error');
            ctx.body = 'param error';
            return;
        }
        const file = ctx.request.files.file;
        const fs = require('fs');
        // 创建读取流
        const reader = fs.createReadStream(file.path);
        const fileName = file.name;
        const filePath = path.join(__dirname, '../public/uploads/') + fileName;
        // 创建写入流
        const upStream = fs.createWriteStream(filePath);
        upStream.on('error', () => {
            console.log('server file path error');
            return;
        });

        // 从读取流通过管道写进写入流
        await new Promise((resolve, reject) => {
            reader.pipe(upStream).on('finish', () => {
                console.log('pipe file finish');
                ctx.body = {'url' : ctx.origin + '/uploads/' + fileName};
                resolve();
            }).on('error', (err) => {
                console.log('pipe file error');
                reject(err)
            });
        });
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