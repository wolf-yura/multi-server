const cron = require("node-cron");
let mongoose = require('mongoose');
let config = require('./config')();

let CronController = require('./controllers/CronController');
const { Ticker } = require("./models/Ticker");
const { Order } = require("./models/Order");
let Market = require('./models/Market').Market;

mongoose.connect('mongodb://' + config.mongo.host + ':' + config.mongo.port + '/' + config.mongo.db_name,
    {useNewUrlParser: true, useUnifiedTopology: true}, async function (err, db) {
        let d = new Date();
        if (err) {
            console.log('[' + d.toLocaleString() + '] ' + 'DB error');
        } else {
            console.log('[' + d.toLocaleString() + '] ' + 'product cron ...');
            let marketCheck = await Market.findOne({});
            if (!marketCheck) await CronController.cron_markets();
            let tickets = await Ticker.findOne({});                
            if(!tickets) await CronController.cron_tickers();
            let markets = await Market.findOne({});
            if(!markets) await CronController.cron_trade();
            // await CronController.cron_chart_15m();
            // await CronController.cron_chart_30m();
            // await CronController.cron_chart_60m();
            // await CronController.cron_chart_120m();
            // await CronController.cron_chart_240m();
            let orders = await Order.findOne({});
            if(!orders) await CronController.cron_orders();

            console.log("All are created");
            // update trade data
            cron.schedule('*/1 * * * *', async function () {  // per 1 minutes
                // await CronController.cron_trade();
                await CronController.live_trade();
            });
            // update ticker data
            cron.schedule('*/3 * * * *', async function () {  // per 3 minutes
                await CronController.cron_tickers();
            });
            // update order data
            cron.schedule('*/5 * * * *', async function () {  // per 5 minutes
                await CronController.live_orders();
            });
        }
    });