const cron = require("node-cron");
let mongoose = require('mongoose');
let config = require('./config')();

let CronController = require('./controllers/CronController');
const { Ticker } = require("./models/Ticker");
const { Order } = require("./models/Order");
const { Trade } = require("./models/Trade");
let Market = require('./models/Market').Market;
let Function = require('./controllers/FunctionController');

mongoose.connect('mongodb://' + config.mongo.host + ':' + config.mongo.port + '/' + config.mongo.db_name,
    {useNewUrlParser: true, useUnifiedTopology: true}, async function (err, db) {
        mongoose.set('useFindAndModify', false);
        let d = new Date();
        if (err) {
            console.log('[' + d.toLocaleString() + '] ' + 'DB error');
        } else {
            console.log('[' + d.toLocaleString() + '] ' + 'Test script ...');
            //-- cront ticker test --//
            // await CronController.cron_ticker_data();            

            // ----- cron order test --//
            // let checkOrder = await Order.findOne({id: "0x283b438f36110b5f4073ceeb7126994d086f23713af67e215c3024107d0c8f3d-0" });
            // if (!checkOrder) {
            //     console.log("--new save")
            // }
            // console.log(checkOrder);            

            //-----  
            // await CronController.cron_trade_data();
            // const timeoutObj = setTimeout(() => {
            //     console.log('timeout beyond time');
            //   }, 1000);

            let orders = await Function.k_limit_order_history(1604214040); 
            console.log(orders?orders.length:"--null-");

              
        }
    });