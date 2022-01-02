/////////////////////////////////////////////////////////////
// require models
const Koa = require('koa');
const cors = require('koa2-cors'); // 跨域处理模块
// const static = require ('koa-static'); // 静态路由模块
const router = new require('koa-router')(); // 路由模块
const bodyparser = require('koa-bodyparser'); // POST 解析模块
const path = require('path'); // 路径模块
// const render = require('koa-ejs'); // koa-ejs 模块，暂时不用
const koajwt = require('koa-jwt'); // koa-jwt 验证中间件
/////////////////////////////////////////////////////////////
// require components
const dao = require('./database/dao');
const apiHandler = require('./apiHandler/apiHandler');
/////////////////////////////////////////////////////////////

const config = require('./config.json');
const { nextTick } = require('process');
const app = new Koa(); // 创建 Koa 服务

dao.connect(app, 'mongodb://' + config[config.mode].database.mongodb.host + ':' + config[config.mode].database.mongodb.port + '/' + config[config.mode].database.mongodb.collection)
.then(() => {
    console.log('Connect to mongodb successed.');
    dbTest(); // db test

    configurateApp(app); // configurate middleware inside here
    apiHandler.handleApi(router);

    app.listen(config.debug.koa.port, () => {
        console.log('Koa listening on port ' + config.debug.koa.port + '.');
    })

})
.catch(err => {
    console.error('Fail to connect to mongodb. ');
    console.error(err);
})

function configurateApp(app) {
    // 配置跨域
    app.use(cors());
    
    // 使用 POST 解析
    app.use(bodyparser());
    
    // 错误处理
    app.use((ctx, next) => {
        return next().catch(err => {
            if(err.status == 401){
                ctx.status = 401;
                ctx.body = 'Authorization failed, Please set valid Authorization header! Format is Authorization: Bearer <token>'
            } else {
                throw err;
            }
        })
    })

    // 验证请求的 token
    app.use(koajwt({
        secret: config.jwtSecret
    }).unless({
        // 登录接口和测试接口不做 token 验证
        path: [/\/login\/register/, /\/login\/login/, /\/test/, '/']
    }))

    // 配置路由
    app.use(router.routes()).use(router.allowedMethods());
    
    // 配置静态资源目录
    // app.use(static('./'))
}

async function dbTest() {
    //[err, res] = await dao.isUserNameExist('Sunwish0');
    //console.log(err, res);
}