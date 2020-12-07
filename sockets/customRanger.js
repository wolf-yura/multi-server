const colors = require('colors');
let BigNumber = require('big-number');
const { parseUnits } = require('ethers/lib/utils');
const k_functions = require('./k_functions')();
const Ticker = require('../models/Ticker').Ticker;
const Trade = require('../models/Trade').Trade;
const Market = require('../models/Market').Market;
const Order = require('../models/Order').Order;

const customRanger = {
    getMarketId: function (streams) {
        console.log(streams)
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
        let pairAddress = "", period = 15;
        for (let k = 0; k < streams.length; k++) {
            let item = streams[k];
            if (item.indexOf(".kline-") > -1) {
                let itemSplits = item.split(".");
                if (itemSplits.length < 2) break;
                pairAddress = itemSplits[0];
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
        return [pairAddress, period];
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
            }
        }
        return k_tickers;
    },
    getChartTrades: async function (pairAddress, period) {
        // console.log(" === getChartTrades === ".magenta, pairAddress);
        if (!pairAddress) return [];
        let pair = await Market.findOne({$or: [{id: pairAddress}, {pair_id: pairAddress}]});
        if (period < 30) period = 20;
        else if (period > 240) period = 240;
        let time_to = parseInt(Date.now() / 1000);
        let time_from = parseInt((Date.now() - 1000 * 60 * period) / 1000);
        // console.log(pair);
        let data = await Trade.find({pair_id: pair.pair_id, created_at: {$gte: time_from, $lte: time_to}}).sort({created_at: 1});
        // console.log(time_from, time_to, data.length);
        let periodData = [];
        let startIndex = 0;
        for (let i = 0; i < data.length; i++) {
            if (data[i].created_at < time_from) break;
            if (data[i].created_at >= time_from && data[i].created_at <= time_to) {
                periodData.push(data[i]);
                startIndex++;
            }
        }
        if (data.length > (startIndex + 1)) periodData.push(data[startIndex]);
        let chartData = [];
        if (periodData.length > 0) {
            let chart_item = [1605968100, 0.0, 0.0, 0.0, 0.0, 0.0]; // timestamp, open, high, low, close, volume
            chart_item[0] = time_to;
            chart_item[1] = periodData[periodData.length - 1].price;
            chart_item[4] = periodData[0].price;
            for (let j = 0; j < periodData.length; j++) {
                chart_item[5] += periodData[j].amount;
            }
            periodData.sort(k_functions.comparePriceAccent);  // accent
            chart_item[2] = periodData[periodData.length - 1].price;
            chart_item[3] = periodData[0].price;
            chartData = chart_item;
        }
        return chartData;
    },
    getOrderBook: async function (marketId) {
        console.log("marketId: ", marketId);
        let pair = await Market.findOne({$or: [{id: marketId}, {pair_id: marketId}]});
        if (!pair) return {asks: [], bids: []};
        let askOrders = await Order.find({inputToken: pair.base_contract, outputToken: pair.quote_contract}).sort({createdAt: -1}).limit(25);
        let bidOrders = await Order.find({inputToken: pair.quote_contract, outputToken: pair.base_contract}).sort({createdAt: -1}).limit(25);
        let asks = []; let bids = [];
        for (let i = 0; i < askOrders.length; i++) {
            let inputAmount = k_functions.big_to_float(askOrders[i].inputAmount);
            let minReturn = k_functions.big_to_float(askOrders[i].minReturn);
            let price = parseFloat((minReturn / inputAmount).toFixed(6));
            asks.push([price, inputAmount]);
        }
        for (let j = 0; j < bidOrders.length; j++) {
            let inputAmount = k_functions.big_to_float(bidOrders[j].inputAmount);
            let minReturn = k_functions.big_to_float(bidOrders[j].minReturn);
            let price = parseFloat((inputAmount / minReturn).toFixed(6));
            bids.push([price, inputAmount]);
        }
        return {asks: asks, bids: bids};
    },
    // 
    getMyOrders: async function (ownerAddress, marketId) {
        console.log("--- owner address: ", ownerAddress);          
        console.log("--- market id ", marketId)      ;
        let pair = await Market.findOne({$or: [{id: marketId}, {pair_id: marketId}]});
        let base_contract = pair.base_contract;
        let quote_contract = pair.quote_contract;

        if(base_contract == "0xbb4cdb9cbd36b01bd1cbaebf2de08d9173bc095c")
           base_contract =  "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee";
        if(quote_contract == "0xbb4cdb9cbd36b01bd1cbaebf2de08d9173bc095c")
            quote_contract =  "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee";
        
        console.log(base_contract, quote_contract);

        // let myOrderAll = await Order.find({ owner: ownerAddress, $or: [
        //        { inputToken: base_contract, outputToken: quote_contract  },
        //        { outputToken: base_contract, inputToken: quote_contract  } ]
        //      }).limit(500);

        let myOrderAll = await Order.find({ owner: ownerAddress }).limit(500);

        let myOrderOpen = [];
        let myOrderHistory = [];
        console.log("myorder count", myOrderAll.length)

        for (let i = 0; i < myOrderAll.length; i++) {                                 
            let inputAmount = k_functions.big_to_float(myOrderAll[i].inputAmount);
            let minReturn = k_functions.big_to_float(myOrderAll[i].minReturn);
            let price = parseFloat((minReturn / inputAmount).toFixed(6));
            // const side = myOrderAll[i].inputToken == pair.base_contract? "buy" : "sell";
            let remaining_volume = 0;
            let inputToken = myOrderAll[i].inputToken;
            let outputToken = myOrderAll[i].outputToken;
            if(inputToken == "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee")
                inputToken =  "0xbb4cdb9cbd36b01bd1cbaebf2de08d9173bc095c";
            if(outputToken == "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee")
                outputToken =  "0xbb4cdb9cbd36b01bd1cbaebf2de08d9173bc095c";        
            // console.log(inputToken, outputToken);
            const market = await Market.findOne( {$or: [ { quote_contract: inputToken, base_contract:outputToken }, { base_contract: inputToken, quote_contract:outputToken  } ]});
            
            const side = inputToken == market.base_contract? "buy" : "sell";
            if(side =="sell")
                price = 1.0/ price;

            let state = "done";
            if(myOrderAll[i].status ==="open")
              {
                  state = "wait"             
                  remaining_volume= inputAmount; 
              }
            else if(myOrderAll[i].status ==="cancelled")
              state = "cancel";
            const market_id= market.id;
            // console.log(market_id);
            const orderData={
                state:state , 
                volume: inputAmount,
                price: price, 
                id: myOrderAll[i].id, 
                remaining_volume: remaining_volume, 
                origin_volume: inputAmount, 
                market: escape(market.id), 
                at: myOrderAll[i].createdAt,
                side : side,
                // pair : market.id
                };
            

            if(myOrderAll[i].status==="executed" || myOrderAll[i].status === "cancelled")
            {
                orderData.excuted_vloume= inputAmount; 
            }
            if( myOrderAll[i].status==="open")
                myOrderOpen.push(orderData);
            else
                myOrderHistory.push(orderData);
        }        
        return {myOrderOpen: myOrderOpen, myOrderHistory: myOrderHistory};
    },
};

module.exports = function () {
    return customRanger;
};