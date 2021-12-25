/////////////////////////////////////////////////////////////
// require models
const Koa = require('koa');
const static = require ('koa-static'); // 静态路由模块
const router = new require('koa-router')(); // 路由模块
const bodyparser = require('koa-bodyparser'); // POST 解析模块
const path = require('path'); // 路径模块
// const render = require('koa-ejs'); // koa-ejs 模块，暂时不用
/////////////////////////////////////////////////////////////
// require components
const dao = require('./database/dao');
const apiHandler = require('./apiHandler/apiHandler');
/////////////////////////////////////////////////////////////

const config = require('./config.json')
const app = new Koa(); // 创建 Koa 服务
dao.connect(app, 'mongodb://' + config.database.mongodb.host + ':' + config.database.mongodb.port + '/' + config.database.mongodb.collection)
.then(() => {
    console.log('Connect to mongodb successed.');

    configurateApp(app); // configurate middleware inside here
    apiHandler.handleApi(router);

    app.listen(12345, () => {
        console.log('Koa listening on port 5000.');
    })

})
.catch(err => {
    console.error('Fail to connect to mongodb. ');
    console.error(err);
})

function configurateApp(app) {
    // 使用 POST 解析
    app.use(bodyparser());
    
    // 配置路由
    app.use(router.routes()).use(router.allowedMethods());
    
    // 配置静态资源目录
    // app.use(static('./'))
}