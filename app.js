const Koa = require('koa');
const static = require ('koa-static'); // 静态路由模块
const router = new require('koa-router')(); // 路由模块
const bodyparser = require('koa-bodyparser'); // POST 解析模块
const path = require('path'); // 路径模块
// const render = require('koa-ejs'); // koa-ejs 模块，暂时不用
const app = new Koa(); // 创建 Koa 服务

// 使用 POST 解析
app.use(bodyparser());

// 配置路由
app.use(router.routes()).use(router.allowedMethods());

// 配置静态资源目录
app.use(static('./'))


app.listen(12345, () => {
    console.log('Koa listening on port 5000.');
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