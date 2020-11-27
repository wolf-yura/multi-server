const colors = require('colors');
let BigNumber = require('big-number');
const k_functions = require('./k_functions')();
const Ticker = require('../models/Ticker').Ticker;
const Trade = require('../models/Trade').Trade;
const Market = require('../models/Market').Market;
const Order = require('../models/Order').Order;

const customRanger = {
    getMarketId: function (streams) {
        let marketID = "";
        for (let k = 0; k < streams.length; k++) {
            let item = streams[k];
            if (item.indexOf(".trades") > -1) marketID = item.replace(".trades", "");
        }
        return marketID;
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
        // let askOrders = await Order.find({inputToken: pair.base_contract, outputToken: pair.quote_contract}).sort({createdAt: -1}).limit(25);
        let orders = await Order.find({}).sort({createdAt: -1}).limit(3);
        for (let i = 0; i < orders.length; i++) {
            console.log(orders[i].inputToken);
            console.log(orders[i].inputAmount);
            let inputAmount = k_functions.big_to_float(orders[i].inputAmount);
            console.log(inputAmount);
        }
    },
};

module.exports = function () {
    return customRanger;
};