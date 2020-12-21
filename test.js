const cron = require("node-cron");
let mongoose = require('mongoose');
let config = require('./config')();

let CronController = require('./controllers/CronController');
const { Ticker } = require("./models/Ticker");
const { Order } = require("./models/Order");
const { Trade } = require("./models/Trade");
let Market = require('./models/Market').Market;
let Function = require('./controllers/FunctionController');

// let {getBnbPrice, getPairsData } = require('./controllers/utils/GlobalData');
let {getTopPairsData} = require('./controllers/utils/PairData');

let dayjs = require('dayjs');
let utc = require('dayjs/plugin/utc')

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

            // let orders = await Function.k_limit_order_history(1604214040); 
            

            const utcCurrentTime = dayjs()
            const utcOneDayBack = utcCurrentTime.subtract(1, 'day').unix()
            // let test  = await Function.k_block(utcOneDayBack);
            const utcTwoDaysBack = utcCurrentTime.subtract(2, 'day').unix()
            const utcOneWeekBack = utcCurrentTime.subtract(1, 'week').unix()
            const utcTwoWeeksBack = utcCurrentTime.subtract(2, 'week').unix()
            
            const pairs  = await  Market.find();
            const pairList = pairs.map(pair=>{return pair.pair_id});

            // let [oneDayBlock, twoDayBlock, oneWeekBlock, twoWeekBlock] = await getBlocksFromTimestamps([
            //     utcOneDayBack,
            //     utcTwoDaysBack,
            //     utcOneWeekBack,
            //     utcTwoWeeksBack
            //   ])
            // let bnbPrice = await getBnbPrice();
            let pairsData = await getTopPairsData(pairList);
            let pair  = pairsData.find(e => {return e.id==='0xccfe1a5b6e4ad16a4e41a9142673dec829f39402';})
              // get fees	  // get fees
            const usingUtVolume = false;
            const fees =
            pair.oneDayVolumeUSD || pair.oneDayVolumeUSD === 0 ? 
            usingUtVolume ? (pair.oneDayVolumeUntracked * 0.003) : (pair.oneDayVolumeUSD * 0.003): '_';

              console.log(pair, fees)

            // console.log(orders?orders.length:"--null-");

              
        }
    });