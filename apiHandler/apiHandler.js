const dao = require('../database/dao');

exports.handleApi = 
function handleApi (router) {
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
    /* // 测试一下
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
    }) */
}