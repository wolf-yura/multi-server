let Function = require('./FunctionController');
let BaseController = require('./BaseController');
let Market = require('../models/Market').Market;
let Order = require('../models/Order').Order;
let Trade = require('../models/Trade').Trade;
let M15Trade = require('../models/M15Trade').M15Trade;
let M30Trade = require('../models/M30Trade').M30Trade;
let M60Trade = require('../models/M60Trade').M60Trade;
let M120Trade = require('../models/M120Trade').M120Trade;
let M240Trade = require('../models/M240Trade').M240Trade;
let Ticker = require('../models/Ticker').Ticker;

let stop_timestamp = 1514764800;  // 2018-01-01
module.exports = BaseController.extend({
    name: 'CronController',
    cron_markets: async function () {
        let marketList = await Function.k_markets();
        for (let i = 0; i < marketList.length; i++) {
            let checkItem = await Market.findOne({pair_id: marketList[i].id});
            if (checkItem) continue;
            let symbol1 = marketList[i].token0.symbol.toLowerCase();
            if (symbol1 === 'wbnb') symbol1 = "bnb";
            let symbol2 = marketList[i].token1.symbol.toLowerCase();
            if (symbol2 === 'wbnb') symbol2 = "bnb";
            let unique_code = 1;
            let checkUnique = await Market.findOne({base_unit: symbol2, quote_unit: symbol1});
            if (checkUnique) unique_code = 2;
            let item = {
                "id": symbol1 + symbol2,
                "pair_id": marketList[i].id,
                "volumeUSD": marketList[i].volumeUSD,
                "unique_code": unique_code,
                "name": symbol1.toUpperCase() + "/" + symbol2.toUpperCase(),
                "base_unit": symbol1,
                "quote_unit": symbol2,
                "base_contract": marketList[i].token0.id,
                "quote_contract": marketList[i].token1.id,
                "state": "enabled",
                "amount_precision": 3,
                "price_precision": 5,
                "min_price": "0.000001",
                "max_price": "0",
                "min_amount": "0.001",
                "filters": [
                    {
                        "rules": [
                            {
                                "limit": "1",
                                "step": "0.01"
                            },
                            {
                                "limit": "10",
                                "step": "0.1"
                            },
                            {
                                "limit": "100",
                                "step": "1"
                            },
                            {
                                "limit": "1000",
                                "step": "10"
                            },
                            {
                                "limit": "0",
                                "step": "100"
                            }
                        ],
                        "type": "custom_price_steps"
                    }
                ]
            };
            let newItem = new Market(item);
            await newItem.save();
        }
    },
    cron_tickers: async function () {
        let time_to = parseInt(Date.now() / 1000);
        let time_from = parseInt(new Date().setDate(new Date().getDate() - 1) / 1000);
        let markets = await Market.find({});
        for (let i = 0; i < markets.length; i++) {
            let pair_id = markets[i].pair_id;
            let pair_name = markets[i].id;  // ex: julbbnb
            let transactions = await Function.k_ticker(pair_id, time_from, time_to);
            let tickerItem = {
                "pair_id": pair_id,
                "pair_name": pair_name,
                "amount": 0.0,
                "low": 0.0,
                "high": 0.0,
                "last": 0.0,
                "open": 0.0,
                "volume": 0.0,
                "avg_price": 0.0,
                "price_change_percent": "+0.00%",
                "at": time_to,
            };
            if (transactions.length > 0) {
                let data = []; let sum_amount = 0, sum_price = 0;
                for (let k = 0; k < transactions.length; k++) {
                    let item = transactions[k];
                    let dataItem = { amount: 0, price: 0, timestamp: parseInt(item.timestamp) };
                    if (item.amount0In === "0") {
                        dataItem.amount = parseFloat(item.amount0Out);
                        try {
                            dataItem.price = parseFloat((parseFloat(item.amount1In) / parseFloat(item.amount0Out)).toFixed(6));
                        } catch (e) {
                            dataItem.price = 0;
                        }
                    } else {
                        dataItem.amount = parseFloat(item.amount0In);
                        try {
                            dataItem.price = parseFloat((parseFloat(item.amount1Out) / parseFloat(item.amount0In)).toFixed(6));
                        } catch (e) {
                            dataItem.price = 0;
                        }
                    }
                    sum_amount += dataItem.amount;
                    sum_price += dataItem.price;
                    data.push(dataItem);
                }
                data.sort(this.compareTimestampDecent);  // decent
                tickerItem.amount = sum_amount;
                tickerItem.volume = sum_amount;
                tickerItem.last = data[0].price;
                tickerItem.open = data[data.length - 1].price;
                tickerItem.avg_price = parseFloat((sum_price / data.length).toFixed(6));
                if (data[0].price !== 0) {
                    let price_change_percent = (data[data.length - 1].price - data[0].price) * 100 / data[0].price;
                    if (price_change_percent < 0) tickerItem.price_change_percent = price_change_percent.toFixed(2) + "%";
                    else tickerItem.price_change_percent = "+" + price_change_percent.toFixed(2) + "%";
                }
                data.sort(this.comparePriceDecent);  // decent
                tickerItem.high = data[0].price;
                tickerItem.low = data[data.length - 1].price;
            }
            let checkTickerItem = await Ticker.findOne({pair_id: pair_id});
            if (checkTickerItem) {
                await checkTickerItem.updateOne({
                    amount: tickerItem.amount,
                    low: tickerItem.low,
                    high: tickerItem.high,
                    last: tickerItem.last,
                    open: tickerItem.open,
                    volume: tickerItem.volume,
                    avg_price: tickerItem.avg_price,
                    price_change_percent: tickerItem.price_change_percent,
                    at: tickerItem.at
                });
            } else {
                let newTickerItem = new Ticker(tickerItem);
                await newTickerItem.save();
            }
        }
    },
    save_trade_data: async function (trades) {
        for (let k = 0; k < trades.length; k++) {
            let item = trades[k];
            let checkTradeItem = await Trade.findOne({id: item.id});
            if (checkTradeItem) continue;
            let symbol1 = item.pair.token0.symbol.toLowerCase();
            if (symbol1 === "wbnb") symbol1 = "bnb";
            let symbol2 = item.pair.token1.symbol.toLowerCase();
            if (symbol2 === "wbnb") symbol2 = "bnb";
            let trade_item = {
                id: item.id,
                pair_id: item.pair.id,
                price: 0,
                amount: 0,
                total: parseFloat(item.amountUSD),
                market: symbol1 + symbol2,
                created_at: parseInt(item.timestamp),
                taker_type: ""
            };
            if (item.amount0In === "0") {
                trade_item.taker_type = "sell";
                trade_item.amount = parseFloat(item.amount0Out);
                try {
                    trade_item.price = parseFloat((parseFloat(item.amount1In) / parseFloat(item.amount0Out)).toFixed(6));
                } catch (e) {
                    trade_item.price = 0;
                }
            } else {
                trade_item.taker_type = "buy";
                trade_item.amount = parseFloat(item.amount0In);
                try {
                    trade_item.price = parseFloat((parseFloat(item.amount1Out) / parseFloat(item.amount0In)).toFixed(6));
                } catch (e) {
                    trade_item.price = 0;
                }
            }
            let newTradeItem = new Trade(trade_item);
            await newTradeItem.save();
        }
    },
    cron_trade: async function () {
        let checkTime = parseInt(Date.now() / 1000);
        let tradeHistory = await Trade.find({}).sort({created_at: 1});  // accent time
        if (tradeHistory && tradeHistory.length) checkTime = tradeHistory[0].created_at;
        console.log("CheckTime: ".red, checkTime);
        if (checkTime < stop_timestamp) {
            console.log("Stop timestamp: ", checkTime);
            return;
        }
        let markets = await Market.find({});
        let pairs = [];
        for (let i = 0; i < markets.length; i++) pairs.push(markets[i].pair_id);
        let trades = await Function.k_trades(pairs, checkTime);
        console.log("trade length:".red, trades.length);
        await this.save_trade_data(trades);
    },
    live_trade: async function () {
        let checkTime = parseInt(Date.now() / 1000);
        let tradeHistory = await Trade.find({}).sort({created_at: -1});  // decent time
        if (tradeHistory && tradeHistory.length) checkTime = tradeHistory[0].created_at;
        let currentTime = parseInt(Date.now() / 1000);
        let markets = await Market.find({});
        let pairs = [];
        for (let i = 0; i < markets.length; i++) pairs.push(markets[i].pair_id);
        let trades = await Function.k_live_trades(pairs, checkTime, currentTime);
        console.log(checkTime, currentTime, "length: ", trades.length);
        this.save_trade_data(trades);
    },
    cron_chart_15m: async function () {
        let period = 15;
        let all_trades = await Trade.find({}).sort({created_at: 1});  // accent
        let firstItem = all_trades[0];
        let time_from = firstItem.created_at;
        let time_to = parseInt(new Date(firstItem.created_at * 1000).setMinutes(new Date(firstItem.created_at * 1000).getMinutes() + period) / 1000);
        let markets = await Market.find({});
        for (let i = 0; i < markets.length; i++) {
            let pair_id = markets[i].pair_id;
            let trades = await Trade.find({pair_id: pair_id}).sort({created_at: 1});
            let periodData = [];
            for (let j = 0; j < trades.length; j++) {
                if (trades[j].created_at > time_to) {
                    time_from = time_to;
                    let tmp = time_to;
                    time_to = parseInt(new Date(tmp * 1000).setMinutes(new Date(tmp * 1000).getMinutes() + period) / 1000);
                    if (periodData.length > 0) {
                        let chart_item = this.periodProcess(periodData, time_from);
                        let newItem = new M15Trade({
                            pair_id: pair_id,
                            timestamp: chart_item[0],
                            open: chart_item[1],
                            high: chart_item[2],
                            low: chart_item[3],
                            close: chart_item[4],
                            volume: chart_item[5]
                        });
                        await newItem.save()
                    }
                }
                periodData.push(trades[j]);
            }
        }
    },
    cron_chart_30m: async function () {
        let period = 30;
        let all_trades = await Trade.find({}).sort({created_at: 1});  // accent
        let firstItem = all_trades[0];
        let time_from = firstItem.created_at;
        let time_to = parseInt(new Date(firstItem.created_at * 1000).setMinutes(new Date(firstItem.created_at * 1000).getMinutes() + period) / 1000);
        let markets = await Market.find({});
        for (let i = 0; i < markets.length; i++) {
            let pair_id = markets[i].pair_id;
            let trades = await Trade.find({pair_id: pair_id}).sort({created_at: 1});
            let periodData = [];
            for (let j = 0; j < trades.length; j++) {
                if (trades[j].created_at > time_to) {
                    time_from = time_to;
                    let tmp = time_to;
                    time_to = parseInt(new Date(tmp * 1000).setMinutes(new Date(tmp * 1000).getMinutes() + period) / 1000);
                    if (periodData.length > 0) {
                        let chart_item = this.periodProcess(periodData, time_from);
                        let newItem = new M30Trade({
                            pair_id: pair_id,
                            timestamp: chart_item[0],
                            open: chart_item[1],
                            high: chart_item[2],
                            low: chart_item[3],
                            close: chart_item[4],
                            volume: chart_item[5]
                        });
                        await newItem.save()
                    }
                }
                periodData.push(trades[j]);
            }
        }
    },
    cron_chart_60m: async function () {
        let period = 60;
        let all_trades = await Trade.find({}).sort({created_at: 1});  // accent
        let firstItem = all_trades[0];
        let time_from = firstItem.created_at;
        let time_to = parseInt(new Date(firstItem.created_at * 1000).setMinutes(new Date(firstItem.created_at * 1000).getMinutes() + period) / 1000);
        let markets = await Market.find({});
        for (let i = 0; i < markets.length; i++) {
            let pair_id = markets[i].pair_id;
            let trades = await Trade.find({pair_id: pair_id}).sort({created_at: 1});
            let periodData = [];
            for (let j = 0; j < trades.length; j++) {
                if (trades[j].created_at > time_to) {
                    time_from = time_to;
                    let tmp = time_to;
                    time_to = parseInt(new Date(tmp * 1000).setMinutes(new Date(tmp * 1000).getMinutes() + period) / 1000);
                    if (periodData.length > 0) {
                        let chart_item = this.periodProcess(periodData, time_from);
                        let newItem = new M60Trade({
                            pair_id: pair_id,
                            timestamp: chart_item[0],
                            open: chart_item[1],
                            high: chart_item[2],
                            low: chart_item[3],
                            close: chart_item[4],
                            volume: chart_item[5]
                        });
                        await newItem.save()
                    }
                }
                periodData.push(trades[j]);
            }
        }
    },
    cron_chart_120m: async function () {
        let period = 120;
        let all_trades = await Trade.find({}).sort({created_at: 1});  // accent
        let firstItem = all_trades[0];
        let time_from = firstItem.created_at;
        let time_to = parseInt(new Date(firstItem.created_at * 1000).setMinutes(new Date(firstItem.created_at * 1000).getMinutes() + period) / 1000);
        let markets = await Market.find({});
        for (let i = 0; i < markets.length; i++) {
            let pair_id = markets[i].pair_id;
            let trades = await Trade.find({pair_id: pair_id}).sort({created_at: 1});
            let periodData = [];
            for (let j = 0; j < trades.length; j++) {
                if (trades[j].created_at > time_to) {
                    time_from = time_to;
                    let tmp = time_to;
                    time_to = parseInt(new Date(tmp * 1000).setMinutes(new Date(tmp * 1000).getMinutes() + period) / 1000);
                    if (periodData.length > 0) {
                        let chart_item = this.periodProcess(periodData, time_from);
                        let newItem = new M120Trade({
                            pair_id: pair_id,
                            timestamp: chart_item[0],
                            open: chart_item[1],
                            high: chart_item[2],
                            low: chart_item[3],
                            close: chart_item[4],
                            volume: chart_item[5]
                        });
                        await newItem.save()
                    }
                }
                periodData.push(trades[j]);
            }
        }
    },
    cron_chart_240m: async function () {
        let period = 240;
        let all_trades = await Trade.find({}).sort({created_at: 1});  // accent
        let firstItem = all_trades[0];
        let time_from = firstItem.created_at;
        let time_to = parseInt(new Date(firstItem.created_at * 1000).setMinutes(new Date(firstItem.created_at * 1000).getMinutes() + period) / 1000);
        let markets = await Market.find({});
        for (let i = 0; i < markets.length; i++) {
            let pair_id = markets[i].pair_id;
            let trades = await Trade.find({pair_id: pair_id}).sort({created_at: 1});
            let periodData = [];
            for (let j = 0; j < trades.length; j++) {
                if (trades[j].created_at > time_to) {
                    time_from = time_to;
                    let tmp = time_to;
                    time_to = parseInt(new Date(tmp * 1000).setMinutes(new Date(tmp * 1000).getMinutes() + period) / 1000);
                    if (periodData.length > 0) {
                        let chart_item = this.periodProcess(periodData, time_from);
                        let newItem = new M240Trade({
                            pair_id: pair_id,
                            timestamp: chart_item[0],
                            open: chart_item[1],
                            high: chart_item[2],
                            low: chart_item[3],
                            close: chart_item[4],
                            volume: chart_item[5]
                        });
                        await newItem.save()
                    }
                }
                periodData.push(trades[j]);
            }
        }
    },
    cron_orders: async function () {
        let time_to = parseInt(Date.now() / 1000);
        let orders = await Function.k_order_history(time_to);
        for (let i = 0; i < orders.length; i++) {
            let orderItem = new Order({
                id: orders[i].id,
                inputAmount: orders[i].inputAmount,
                inputToken: orders[i].inputToken,
                minReturn: orders[i].minReturn,
                module: orders[i].module,
                outputToken: orders[i].outputToken,
                owner: orders[i].owner,
                secret: orders[i].secret,
                status: orders[i].status,
                witness: orders[i].witness,
                bought: orders[i].bought,
                createdAt: parseInt(orders[i].createdAt),
                createdTxHash: orders[i].createdTxHash,
            });
            await orderItem.save();
        }
    },
    live_orders: async function () {
        let time_to = parseInt(Date.now() / 1000);
        let time_from = parseInt(new Date("2020-09-25") / 1000);
        let orderHistory = await Order.find({}).sort({createdAt: -1});
        if (orderHistory && orderHistory.length) {
            time_from = orderHistory[0].createdAt;
        }
        let orders = await Function.k_order_live(time_from, time_to);
        console.log(time_from, time_to);
        console.log("Live Orders: ", orders.length);
        for (let i = 0; i < orders.length; i++) {
            let checkOrder = await Order.findOne({id: orders[i].id});
            if (!checkOrder) {
                let orderItem = new Order({
                    id: orders[i].id,
                    inputAmount: orders[i].inputAmount,
                    inputToken: orders[i].inputToken,
                    minReturn: orders[i].minReturn,
                    module: orders[i].module,
                    outputToken: orders[i].outputToken,
                    owner: orders[i].owner,
                    secret: orders[i].secret,
                    status: orders[i].status,
                    witness: orders[i].witness,
                    bought: orders[i].bought,
                    createdAt: parseInt(orders[i].createdAt),
                    createdTxHash: orders[i].createdTxHash,
                });
                await orderItem.save();
            }
        }
    },
});
