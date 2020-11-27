let mongoose = require('mongoose');
let config = require('./config')();

let RangerMock = require('./sockets/ranger.js');

mongoose.connect('mongodb://' + config.mongo.host + ':' + config.mongo.port + '/' + config.mongo.db_name,
    {useNewUrlParser: true, useUnifiedTopology: true}, async function (err, db) {
    let d = new Date();
    if (err) {
        console.log('[' + d.toLocaleString() + '] ' + 'Sorry, there is no mongo db server running.');
    } else {
        process.on('SIGINT', () => { console.log("Bye bye!"); process.exit(); });
        let server = new RangerMock(config.socket);
    }
});