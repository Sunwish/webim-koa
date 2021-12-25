const Koa = require('koa');
const static = require ('koa-static'); // 静态路由模块
const router = new require('koa-router')(); // 路由模块
const bodyparser = require('koa-bodyparser'); // POST 解析模块
const path = require('path'); // 路径模块
const dao = require('./database/dao');
// const render = require('koa-ejs'); // koa-ejs 模块，暂时不用
const app = new Koa(); // 创建 Koa 服务


dao.connect(app, 'mongodb://127.0.0.1:27017/web-im')
.then(() => {
    console.log('Connect to mongodb successed.');
    // 使用 POST 解析
    app.use(bodyparser());
    
    // 配置路由
    app.use(router.routes()).use(router.allowedMethods());
    
    // 配置静态资源目录
    app.use(static('./'))
    app.listen(12345, () => {
        console.log('Koa listening on port 5000.');
    })
    router.post('/user', async ctx => {
        var body = ctx.request.body;
        [err, res] = await dao.addUser({
            'username': body.username,
            'password': body.password,
            'email': body.email,
            'avatar': body.avater
        });
        ctx.body = {
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
})
.catch(err => {
    console.error('Fail to connect to mongodb. ');
    console.error(err);
})
