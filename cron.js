const cron = require("node-cron");
let mongoose = require('mongoose');
let config = require('./config')();

let CronController = require('./controllers/CronController');
const { Ticker } = require("./models/Ticker");
const { Order } = require("./models/Order");
const { Trade } = require("./models/Trade");
let Market = require('./models/Market').Market;
const intervalCronOrder = 20000;
// const intervalCronTrade = 30000
mongoose.connect('mongodb://' + config.mongo.host + ':' + config.mongo.port + '/' + config.mongo.db_name,
    {useNewUrlParser: true, useUnifiedTopology: true}, async function (err, db) {
        mongoose.set('useFindAndModify', false);
        let d = new Date();
        if (err) {
            console.log('[' + d.toLocaleString() + '] ' + 'DB error');
        } else {
            console.log('[' + d.toLocaleString() + '] ' + 'product cron ...');
            let marketCheck = await Market.findOne({});
            if (!marketCheck) await CronController.cron_markets();
            let tickets = await Ticker.findOne({});                
            if(!tickets) await CronController.cron_ticker_data();
            // let trades = await Trade.findOne({});   
            // if(!trades) await CronController.cron_trade();
            await CronController.cron_trade_data();
            // await CronController.cron_chart_15m();
            // await CronController.cron_chart_30m();
            // await CronController.cron_chart_60m();
            // await CronController.cron_chart_120m();
            // await CronController.cron_chart_240m();
            let orders = await Order.findOne({});
            if(!orders) await CronController.cron_order_data(true);

            console.log("All are created");
            // update trade data
            // cron.schedule('*/5 * * * *', async function () {  // per 1 minutes
            //     // await CronController.cron_trade();
            //     await CronController.live_trade();
            // });

            // setInterval(async function () {  // per 3 minutes            
            //     await CronController.cron_trade_data();
            // }, 1000);
            loop_cron_order_data();
            // update ticker data
            // cron.schedule('*/3 * * * *', async function () {  // per 3 minutes
            //     await CronController.cron_tickers();
            // });
            setInterval(
                async function () {  // per 2 minutes
                    // await CronController.cron_tickers();
                     await CronController.cron_ticker_data();
                },
                60000
            )
            // update order data
            // cron.schedule('*/3 * * * * *', async function () {  // per 5 minutes
            //     // await CronController.live_orders();
            //     await CronController.cron_order_data(false);
            // });

            // setInterval(
            //     async function () {  // per 2 second
            //         // await CronController.live_orders();
            //         await CronController.cron_order_data(false);
            //     },
            //     2000   
            // )
        }
    });

    async function loop_cron_trade_data() {
        await CronController.cron_trade_data();
         setTimeout(loop_cron_trade_data, 1000);            
    };

    async function loop_cron_order_data() {
        await CronController.cron_order_data();
         setTimeout(loop_cron_order_data, 1000);            
    }    

    