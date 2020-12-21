const colors = require('colors');
let BigNumber = require('big-number');
const { parseUnits } = require('ethers/lib/utils');
const Helpers = require('./helpers');
const k_functions = require('./k_functions')();
const Ticker = require('../models/Ticker').Ticker;
const Trade = require('../models/Trade').Trade;
const Market = require('../models/Market').Market;
const Order = require('../models/Order').Order;

const customRanger = {
    getMarketId: function (streams) {
        // console.log(streams)
        let marketID = "";
        for (let k = 0; k < streams.length; k++) {
            let item = streams[k];
            if (item.indexOf(".trades") > -1) marketID = item.replace(".trades", "");
        }
        return marketID;
    },
    getOwnerAddress: function (streams) {
        let ownerAddress = "";
        for (let k = 0; k < streams.length; k++) {
            let item = streams[k];
            if (item.indexOf(".myorders") > -1) ownerAddress = item.replace(".myorders", "");
        }
        return ownerAddress;
    },
    getKLineParams: function (streams) {
        let pairAddress = "", period = 15, periodStr;
        for (let k = 0; k < streams.length; k++) {
            let item = streams[k];
            if (item.indexOf(".kline-") > -1) {
                let itemSplits = item.split(".");
                if (itemSplits.length < 2) break;
                pairAddress = itemSplits[0];
                periodStr = itemSplits[1]?itemSplits[1].substring(6):"15m";
                switch (itemSplits[1]) {
                    case "kline-1m":
                        period = 1;
                        break;
                    case "kline-5m":
                        period = 5;
                        break;
                    case "kline-15m":
                        period = 15;
                        break;
                    case "kline-30m":
                        period = 30;
                        break;
                    case "kline-1h":
                        period = 60;
                        break;
                    case "kline-2h":
                        period = 120;
                        break;
                    case "kline-4h":
                        period = 240;
                        break;
                    case "kline-6h":
                        period = 360;
                        break;
                    case "kline-12h":
                        period = 720;
                        break;
                    case "kline-1d":
                        period = 1440;
                        break;
                    case "kline-3d":
                        period = 4320;
                        break;
                    default:
                        break;
                }
                break;
            }
        }
        return [pairAddress, period, periodStr];
    },
    getTicker: async function () {
        // console.log(" === getTicker === ".magenta);
        let k_tickers = {};
        let tickers = await Ticker.find({});
        for (let i = 0; i < tickers.length; i++) {
            k_tickers[tickers[i].pair_name] = {
                amount: tickers[i].amount.toString(),
                avg_price: tickers[i].avg_price.toString(),
                high: tickers[i].high.toString(),
                last: tickers[i].last.toString(),
                low: tickers[i].low.toString(),
                open: tickers[i].open.toString(),
                price_change_percent: tickers[i].price_change_percent,
                volume: tickers[i].volume.toString(),
                at: tickers[i].at.toString(),
                total_liquidity: tickers[i].total_liquidity,
                oneday_volume_usd: tickers[i].oneday_volume_usd,
                oneday_fee_usd: tickers[i].oneday_fee_vsd,
                pool_base_tokens: tickers[i].pool_base_tokens,  
                pool_quote_tokens: tickers[i].pool_quote_tokens,
                liquidity_change_usd: tickers[i].liquidity_change_usd,
                volume_change_usd: tickers[i].volume_change_usd,
                oneday_fee_usd: tickers[i].oneday_fee_usd
            }
        }
        return k_tickers;
    },
    getChartTrades: async function (pairAddress, period) {
        // console.log(" === getChartTrades === ".magenta, pairAddress);
        if (!pairAddress) return [];
        let pair = await Market.findOne({$or: [{id: pairAddress}, {pair_id: pairAddress}]});
        if (period < 15) period = 15;
        else if (period > 240) period = 240;
        let time_from = parseInt(Date.now() / 1000);
        let time_to = 0 // parseInt((Date.now() + 1000 * 60 * period) / 1000);

        /**
         *  caculate time range chart trades again
         */
        time_from = time_from - time_from%(60*period)
        time_to = time_from + 60*period
        // console.log(pair);
        let data = await Trade.find({market: pair.id, created_at: {$gte: time_from, $lte: time_to}}).sort({created_at: 1});
        if(data.length<1) return undefined
        let oldData = await Trade.find({market: pair.id, created_at: {$lte: time_from}}).sort({created_at: -1}).limit(0);
        // console.log("--ranger trade data", time_from, time_to, data.length);
        
        let periodData = [];
        if(oldData && oldData.length>0) periodData.push(oldData[0], ...data);       
    
        // console.log("--update chart", periodData);
        let chartData = [];
        if (periodData.length > 0) {
            let chart_item = [1605968100, 0.0, 0.0, 0.0, 0.0, 0.0]; // timestamp, open, high, low, close, volume
            chart_item[0] = time_from;
            chart_item[1] = periodData[0].price;
            chart_item[4] = periodData[periodData.length-1].price;
            for (let j = 0; j < periodData.length; j++) {
                chart_item[5] += periodData[j].amount;
            }
            periodData.sort(k_functions.comparePriceAccent);  // accent
            chart_item[2] = periodData[periodData.length - 1].price;
            chart_item[3] = periodData[0].price;
            chartData = chart_item;

            //------ update old data ----//
            // if(oldData && oldData.length>0)
            // {
            //     chart_item[1]= oldData[0].price;
            //     if(oldData[0].price > chart_item[2]) chart_item[2] = oldData[0].price;
            //     if(oldData[0].price < chart_item[3]) chart_item[3] = oldData[0].price;
            // }
        }
        else{
            let chart_item = [1605968100, 0.0, 0.0, 0.0, 0.0, 0.0]; 
             if(oldData && oldData.length>0){
                 chart_item[0] = time_from;
                 chart_item[1] = oldData[0].price;
                 chart_item[2] = oldData[0].price;
                 chart_item[3] = oldData[0].price;
                 chart_item[4] = oldData[0].price;
                //  chartData = chart_item;
             }
        }
        return chartData;
    },
    getOrderBook: async function (marketId) {
        // console.log("marketId: ", marketId);        
        let asks = []; let bids = [];
        let allBuyOrdersByMarket = await Order.find({market:marketId, status:"open", side: "buy"}).sort({price: -1}).limit(25);
        let allSellOrdersByMarket = await Order.find({market:marketId, status:"open", side: "sell"}).sort({price: 1}).limit(25);
        // console.log("market: ", marketId, "order books: buy=", allBuyOrdersByMarket.length, "sell=", allSellOrdersByMarket.length);
        for(let i=0;i<allBuyOrdersByMarket.length; i++)
        {
            if(allBuyOrdersByMarket[i].amount < 0.001) continue;
            bids.push([allBuyOrdersByMarket[i].price, allBuyOrdersByMarket[i].amount, allBuyOrdersByMarket[i].price * allBuyOrdersByMarket[i].amount] );
        }
        for(let i=0;i<allSellOrdersByMarket.length; i++)
        {
            if(allSellOrdersByMarket[i].amount < 0.001) continue;
            asks.push([allSellOrdersByMarket[i].price,  allSellOrdersByMarket[i].amount, allSellOrdersByMarket[i].price * allSellOrdersByMarket[i].amount ]);  
        }
        // for (let i = 0; i < askOrders.length; i++) {
        //     let inputAmount = k_functions.big_to_float(askOrders[i].inputAmount);
        //     let minReturn = k_functions.big_to_float(askOrders[i].minReturn);
        //     let price = parseFloat((minReturn / inputAmount).toFixed(6));
        //     asks.push([price, inputAmount]);
        // }
        // for (let j = 0; j < bidOrders.length; j++) {
        //     let inputAmount = k_functions.big_to_float(bidOrders[j].inputAmount);
        //     let minReturn = k_functions.big_to_float(bidOrders[j].minReturn);
        //     let price = parseFloat((inputAmount / minReturn).toFixed(6));
        //     bids.push([price, inputAmount]);
        // }
        return {asks: asks, bids: bids};
    },    
    // 
    getMyOrders: async function (ownerAddress, marketId, from_update_at=0, from_id=0) {

        // console.log("--- owner address: ", ownerAddress);  
        let myOrderAll=[];
        
        if(from_id===0)
            myOrderAll = await Order.find({ owner: ownerAddress}).sort({_id : 1}).limit(50);
        else
            myOrderAll = await Order.find({ owner: ownerAddress, $or:[{_id:{$gt: from_id}}, {updatedAt:{$gt: from_update_at}}]}).sort({_id : 1}).limit(50); //find({ owner: ownerAddress, _id:{$gt: from_id}}).sort({_id : 1}).limit(50);
            

        
        // let myOrderOpen = [];
        let myOrderHistory = [];
        // console.log("myorder count", myOrderAll.length)
        // console.log(myOrderAll);
        // let last_id = -1;
        for (let i = 0; i < myOrderAll.length; i++) {                                 
            // let inputAmount = k_functions.big_to_float(myOrderAll[i].inputAmount);
            // let minReturn = k_functions.big_to_float(myOrderAll[i].minReturn);
            // let price = parseFloat((minReturn / inputAmount).toFixed(6));                        
            // const side = myOrderAll[i].inputToken == pair.base_contract? "buy" : "sell";
            let amount = Math.round((myOrderAll[i].amount + Number.EPSILON) * 10000) / 10000;// myOrderAll[i].amount;

            let remaining_volume = 0;    

            let state = "done";
            if(myOrderAll[i].status ==="open")
              {
                  state = "wait"             
                  remaining_volume= amount; 
              }
            else if(myOrderAll[i].status ==="cancelled")
              state = "cancel";

            const orderData={
                state:state , 
                volume: amount,
                price:  Math.round((myOrderAll[i].price + Number.EPSILON) * 100000) / 100000, //     myOrderAll[i].price.toFixed(5), 
                id: myOrderAll[i].id, 
                remaining_volume: remaining_volume,
                origin_volume: amount,
                market: myOrderAll[i].market, 
                updated_at: myOrderAll[i].updatedAt,
                created_at: myOrderAll[i].createdAt,
                side : myOrderAll[i].side,
                tx_hash: myOrderAll[i].createdTxHash,
                ord_type: myOrderAll[i].ord_type,
                module: myOrderAll[i].status ==="open"?myOrderAll[i].module:undefined,
                witness: myOrderAll[i].status ==="open"?myOrderAll[i].witness:undefined,
                inputToken :  myOrderAll[i].status ==="open"?myOrderAll[i].inputToken:undefined,
                outputToken : myOrderAll[i].status ==="open"?myOrderAll[i].outputToken:undefined,
                minReturn : myOrderAll[i].status ==="open"?myOrderAll[i].minReturn:undefined,
                // pair : market.id
                };
            

            if(myOrderAll[i].status==="executed" || myOrderAll[i].status === "cancelled")
            {
                orderData.excuted_vloume= amount;//  Math.round((myOrderAll[i].amount + Number.EPSILON) * 100000) / 100000;// amount.toFixed(5); 
            }
            // if( myOrderAll[i].status==="open")
            //     myOrderOpen.push(orderData);
            // else
            myOrderHistory.push(orderData);
        }        
        if(myOrderAll.length>0)console.log( myOrderAll[myOrderAll.length-1]._id);
        return {orders: myOrderHistory, last_id: myOrderAll.length>0? myOrderAll[myOrderAll.length-1]._id:undefined };
    },
};

module.exports = function () {
    return customRanger;
};