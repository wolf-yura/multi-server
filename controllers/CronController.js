let Function = require('./FunctionController');
let BaseController = require('./BaseController');
const Helpers = require('../sockets/helpers');
const { min } = require('underscore');
const { argsToArgsConfig } = require('graphql/type/definition');
const { id } = require('ethers/lib/utils');
let Market = require('../models/Market').Market;
let Order = require('../models/Order').Order;
let Trade = require('../models/Trade').Trade;
let M15Trade = require('../models/M15Trade').M15Trade;
let M30Trade = require('../models/M30Trade').M30Trade;
let M60Trade = require('../models/M60Trade').M60Trade;
let M120Trade = require('../models/M120Trade').M120Trade;
let M240Trade = require('../models/M240Trade').M240Trade;
let Ticker = require('../models/Ticker').Ticker;
const k_functions = require('../sockets/k_functions')();

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
    //----- updated cron for ticker -----//
    cron_ticker_data: async function () {        
        console.log("---start cron ticker");
        let time_to = parseInt(Date.now() / 1000);
        let time_24h_old = parseInt(new Date().setDate(new Date().getDate() - 1) / 1000);
        let time_48h_old = parseInt(new Date().setDate(new Date().getDate() - 2) / 1000);
                
        let markets = await Market.find({});
        for (let i = 0; i < markets.length; i++) {
            let curMarket = markets[i];
            let pair_id = markets[i].pair_id;
            let pair_name = markets[i].id;  // ex: julbbnb
            // console.log("--- pair name ", pair_name);
            let today_trades = await Trade.find({created_at:{$gte: time_24h_old, $lte: time_to}, market: pair_name}).sort({created_at:1});
            let yesterday_trades = await Trade.find({created_at:{$gte: time_48h_old, $lte: time_24h_old}, market: pair_name});            
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
               
            let sumPrice = 0;
            let sumVolume = 0;                            
            let sumAmount = 0;                        
            if(today_trades.length>1)
            {
                let lowestPrice = 10000000000;
                for(let ii=0; ii<today_trades.length-1;ii++)
                {
                    let trade = today_trades[ii];
                    sumPrice += trade.price;
                    sumVolume += (trade.amount*trade.price);
                    sumAmount += trade.amount;
                    if(trade.price<lowestPrice)     lowestPrice= trade.price;
                    if(trade.price>tickerItem.high)    tickerItem.high= trade.price;
                }                
                tickerItem.avg_price = sumPrice/today_trades.length;
                tickerItem.open  = today_trades[0].price;
                tickerItem.last  = today_trades[today_trades.length-1].price;
                tickerItem.low   = lowestPrice;
            }
            let sumPriceOld = 0, avgPriceOld=0;       
            if(yesterday_trades.length>1)
            {                
                for(let ii=0; ii<yesterday_trades.length-1;ii++)
                {
                    let trade = yesterday_trades[ii];
                    sumPriceOld += trade.price;                   
                }                
                avgPriceOld = sumPriceOld/yesterday_trades.length;  
                tickerItem.price_change_percent = (tickerItem.avg_price / avgPriceOld-1)*100;
                if (tickerItem.price_change_percent < 0) tickerItem.price_change_percent = tickerItem.price_change_percent.toFixed(2) + "%";
                else tickerItem.price_change_percent = "+" + tickerItem.price_change_percent.toFixed(2) + "%";                              
            }
                        
            tickerItem.amount = sumAmount;
            tickerItem.volume = sumVolume;
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
        console.log("---cron trade");
        let checkTime = parseInt(Date.now() / 1000);
        let tradeHistory = await Trade.find({}).sort({created_at: 1}).limit(1);  // accent time        
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
        let tradeHistory = await Trade.find({}).sort({created_at: -1}).limit(1);  // decent time
        if (tradeHistory  && tradeHistory.length>0) checkTime = tradeHistory[0].created_at;
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
        let all_trades = await Trade.find({}).sort({created_at: 1}).limit(1);  // accent
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
        let all_trades = await Trade.find({}).sort({created_at: 1}).limit(1);  // accent
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
        let all_trades = await Trade.find({}).sort({created_at: 1}).limit(1);  // accent
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
        let all_trades = await Trade.find({}).sort({created_at: 1}).limit(1);  // accent
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
    //------ do cron job by block number ** made by ruymaster ** -----//
    cron_order_data: async function (bInit = false) {                
        let orderHistory = undefined;
        if(!bInit) orderHistory = await Order.find({ord_type:"limit"}).sort({updatedAt: -1}).limit(1);        
        let limitOrdersFromAt = 1000;
        // if(orderHistory) orderHistory = orderHistory.sort()
        if (orderHistory && orderHistory.length>0) {
            limitOrdersFromAt = orderHistory[0].updatedAt;
        }
        //let orders = await Function.k_order_from_block(fromBlockNumber);
        let orders = await Function.k_limit_order_history(limitOrdersFromAt);        
        console.log("--limit orders from ", limitOrdersFromAt);
        if(orders)
        {
            console.log("Lenth : ", orders.length);
            for (let i = 0; i < orders.length; i++) {
                let checkOrder = await Order.findOne({id: orders[i].id });            
                if (!checkOrder) {
                    const newOrder = await this.add_limit_order(orders[i])               
                }
                else
                {
                    // console.log(checkOrder.id, checkOrder.status, checkOrder.blockNumber);
                    // checkOrder.status = orders[i].status;
                    // checkOrder.createdAt = orders[i].createdAt;
                    // await checkOrder.save();
                    this.update_limit_order(orders[i], checkOrder);
                }
            }
        }
        //---- add  market order ------------//
        orderHistory = undefined;
        if(!bInit) orderHistory = await Order.find({ord_type:"market"}).sort({updatedAt: -1}).limit(1);        
        let marketOrdersFromAt = 0;
        if (orderHistory && orderHistory.length>0) {
            marketOrdersFromAt = orderHistory[0].updatedAt;
        }
        orders = await Function.k_market_order_history(marketOrdersFromAt);        
        console.log("--market orders from ", marketOrdersFromAt);
        if(orders)
        {
            console.log("market order Lenth: ", orders.length);
            for (let i = 0; i < orders.length; i++) {                
                let checkOrder = await Order.findOne({id: orders[i].id });            
                if (!checkOrder) {
                    const newOrder = await this.add_market_order(orders[i])                
                }
                else
                {
                    // this.update_limit_order(orders[i], checkOrder);
                }
            }
        }
        
        await this.cron_trade_data();
    },
    add_limit_order: async function (newOrder) {
        const {marketId, orderSide, pairId }= await Helpers.getMarketIdFromLimitOrder(newOrder);
        // let orderSide = "buy";
        // if(Market.findOne({id: marketId}).quote_contract === newOrder.outputToken)
        //     orderSide = "sell";
                
        let inputAmount = k_functions.big_to_float(newOrder.inputAmount);
        let minReturn = k_functions.big_to_float(newOrder.minReturn);
        let price = parseFloat((inputAmount/minReturn ).toFixed(6));       
        let amount = minReturn;        
        if(orderSide==="sell")
        {
             price = parseFloat((minReturn/ inputAmount ).toFixed(6));
             amount = inputAmount;
        }

        if(newOrder.bought)
            {
                console.log("----bought", newOrder.id);
                const bought = k_functions.big_to_float(newOrder.bought);
                price = parseFloat((inputAmount/ bought).toFixed(6));
                amount = bought;
                if(orderSide==="sell")
                {
                    price = parseFloat((bought/ inputAmount ).toFixed(6));
                    amount = inputAmount;
                }        
            }

        //console.log(newOrder);
        let orderItem = new Order({
            id: newOrder.id,
            market: marketId,
            inputAmount: newOrder.inputAmount,
            inputToken: newOrder.inputToken,
            minReturn: newOrder.minReturn,
            module: newOrder.module,
            outputToken: newOrder.outputToken,
            owner: newOrder.owner,
            secret: newOrder.secret,
            status: newOrder.status,
            witness: newOrder.witness,
            bought: newOrder.bought,
            createdAt: parseInt(newOrder.createdAt),
            createdTxHash: newOrder.createdTxHash,
            updatedAt:parseInt(newOrder.updatedAt),
            cancelledTxHash: newOrder.cancelledTxHash,
            executedTxHash: newOrder.executedTxHash,
            blockNumber: newOrder.blockNumber,
            side: orderSide,
            price: price,
            ord_type: "limit",
            amount:amount,
            pair_id: pairId
        });
        await orderItem.save();
        return orderItem;
    },
    update_limit_order: async function(newOrder, oldOrder) {
        
        let price = oldOrder.price;
        let amount = oldOrder.amount;        
        if(newOrder.bought)
        {
            console.log("---update bought", oldOrder.id);
            let inputAmount = k_functions.big_to_float(newOrder.inputAmount);        
            let bought = k_functions.big_to_float(newOrder.bought);
            price = parseFloat((inputAmount/bought ).toFixed(6));
            amount = bought;
            if(oldOrder.side==="sell")
            {
                price = parseFloat((bought/ inputAmount ).toFixed(6));
                amount = inputAmount;
            }
        }
        oldOrder.updatedAt = newOrder.updatedAt;
        oldOrder.bought = newOrder.bought;
        oldOrder.price = price;
        oldOrder.amount = amount;
        oldOrder.status = newOrder.status;
        oldOrder.cancelledTxHash = newOrder.cancelledTxHash;
        oldOrder.executedTxHash = newOrder.executedTxHash;
        await oldOrder.save()
        // await Order.findOneAndUpdate({id: newOrder.id }, {
        //     $set:{ updatedAt: newOrder.updatedAt, 
        //         bought: newOrder.bought,
        //         status: newOrder.status,
        //         cancelledTxHash:newOrder.cancelledTxHash,
        //         executedTxHash:newOrder.executedTxHash,
        //         }}); 
    },
    add_market_order: async function (newOrder) {
        const {marketId, orderSide, pairId }= await Helpers.getMarketIdFromMarketOrder(newOrder);
        // let orderSide = "buy";
        // if(Market.findOne({id: marketId}).quote_contract === newOrder.outputToken)
        //     orderSide = "sell";
        if(marketId===undefined || orderSide === undefined) return;
        let price, amount, inputToken, outputToken;
        if(orderSide === "buy")
        {
            price = parseFloat(newOrder.amount1In)/ parseFloat(newOrder.amount0Out);   //  example "julb/bnb" amount0Out: 0.024 julb, amount1In: 0.03 bnb
            amount = parseFloat(newOrder.amount0Out);      
            inputToken =  newOrder.pair.token1.id;                     //
            outputToken =  newOrder.pair.token0.id;                     //

        }
        else
        {
            price = parseFloat(newOrder.amount1Out)/ parseFloat(newOrder.amount0In);   //  example "julb/bnb" amount0Out: 0.0 julb, amount1In: 0.024 bnb
            amount = parseFloat(newOrder.amount0In);                                                       //
            inputToken =  newOrder.pair.token0.id;                     //
            outputToken =  newOrder.pair.token1.id;                     //
        }         
         
        let orderItem = new Order({
            id: newOrder.id,
            market: marketId,
            // inputAmount: newOrder.inputAmount,
            inputToken: inputToken,
            // minReturn: newOrder.minReturn,
            // module: newOrder.module,
            outputToken: outputToken,
            owner: newOrder.from,
            // secret: newOrder.secret,
            status: "executed",
            // witness: newOrder.witness,
            // bought: newOrder.bought,
            createdAt: parseInt(newOrder.timestamp),
            createdTxHash: newOrder.transaction.id,
            updatedAt:parseInt(newOrder.timestamp),
            // cancelledTxHash: nu,
            executedTxHash: newOrder.transaction.id,
            blockNumber: newOrder.transaction.blockNumber,
            side: orderSide,
            price: price,
            ord_type: "market",
            amount:amount,
            pair_id: pairId
        });
        await orderItem.save();
        return orderItem;
    },
    //---- updated cron for trade ** made by ruymaster **------//
    cron_trade_data: async function() {
        console.log("--start--trade");
        let oneOrder = await Order.findOne({status:"executed"});
        if(!oneOrder) 
        {
            console.log("---no order");
            return;
        }              
        let lastTrade=await Trade.find({}).sort({created_at:-1}).limit(1)
        let fromTime = 0;
        if(!lastTrade || lastTrade.length<1)
             {
                 console.log("--no--trade")                        
              }  
              else fromTime = lastTrade[0].created_at;

        let orders =await  Order.find({status:"executed", ord_type:"market" , market:{$exists: true}, updatedAt:{$gte:fromTime}}).sort({updatedAt:1}).limit(1000);
        if( orders.length<1) 
        {
            console.log("no syncing order and trade");
            return;
        }
        console.log("--executed new orders ", orders.length, orders[orders.length-1].updatedAt);
        for(let i=0; i< orders.length; i++ )
        {
            let order = orders[i];
            trade = await Trade.findOne({id:order.id});
            if(trade) 
            {
                console.log("--ignore order", order.id);
                continue;
            }                  
            let trade_item = {
              id: order.id,
              // pair_id: o.pair.id,
              price: order.price,
              amount: order.amount,
              total: order.amount*order.price,
              market: order.market,
              created_at: order.updatedAt,
              taker_type: order.side,
              pair_id: order.pair_id
          };
          let newTradeItem = new Trade(trade_item);
          await newTradeItem.save();
        }        
    }
});
