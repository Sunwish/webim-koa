const mongo = require('mongoose');
const models = require('./models');
const bodyParser = require('body-parser');

exports.connect = 
function connect (app, connectString) {
    app.use(bodyParser.urlencoded({ extended: false }));
    app.use(bodyParser.json());
    return new Promise((resolve, reject) => {
        mongo.connect(connectString, {
            useUnifiedTopology: true,
            useNewUrlParser: true
        }, err => {
            if(err) { return reject(err) }
            resolve(null);
        });
    });
}

/////////////////////////////////////////////////