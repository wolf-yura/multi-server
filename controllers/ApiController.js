let path = require('path');
let fs = require('fs');
let crypto = require('crypto');
let colors = require('colors');

let BaseController = require('./BaseController');
const { transcode } = require('buffer');
let Market = require('../models/Market').Market;
let Trade = require('../models/Trade').Trade;
let M15Trade = require('../models/M15Trade').M15Trade;
let M30Trade = require('../models/M30Trade').M30Trade;
let M60Trade = require('../models/M60Trade').M60Trade;
let M120Trade = require('../models/M120Trade').M120Trade;
let M240Trade = require('../models/M240Trade').M240Trade;
let Ticker = require('../models/Ticker').Ticker;

module.exports = BaseController.extend({
    name: 'ApiController',
    api_markets: async function (req, res, next) {
        console.log("Markets URL".magenta);
        let k_markets = await Market.find({}).sort({volumeUSD: -1});
        return res.end(JSON.stringify(k_markets));
    },
    api_tickers: async function (req, res, next) {
        console.log("Ticker URL".magenta);
        let k_tickers = {};
        let tickers = await Ticker.find({});
        for (let i = 0; i < tickers.length; i++) {
            k_tickers[tickers[i].pair_name] = {
                at: tickers[i].at.toString(),
                ticker: {
                    amount: tickers[i].amount.toString(),
                    avg_price: tickers[i].avg_price.toString(),
                    high: tickers[i].high.toString(),
                    last: tickers[i].last.toString(),
                    low: tickers[i].low.toString(),
                    open: tickers[i].open.toString(),
                    price_change_percent: tickers[i].price_change_percent,
                    volume: tickers[i].volume.toString()
                }
            }
        }
        return res.end(JSON.stringify(k_tickers));
    },
    api_trades: async function (req, res, next) {
        console.log("Trade URL".magenta);
        let pair = await Market.findOne({id: req.params.id});
        let cur_t = new Date();
        let cur_ts = parseInt(cur_t.getTime() / 1000);
        let yes_ts = parseInt((cur_t - 1000 * 60 * 60 * 24 * 1) / 1000);
        // let trades = await Trade.find({pair_id: pair.pair_id, created_at: {$gte: yes_ts, $lte: cur_ts}}).select({_id: 0, pair_id: 0}).limit(50);
        let trades = await Trade.find({market: pair.id, created_at: {$gte: yes_ts, $lte: cur_ts}}).select({_id: 0, pair_id: 0}).limit(50);
        return res.end(JSON.stringify(trades))
    },
    api_k_line: async function (req, res, next) {
        let that = this;
        console.log("K Line URL".magenta);
        let pair = await Market.findOne({id: req.params.id});
        let period = parseInt(req.query.period);
        let time_from = parseInt(req.query.time_from);
        let time_to = parseInt(req.query.time_to);
        
        console.log(period, time_from, time_to);
        //---------//
        // time_from = time_from - time_from%(period*60);
        console.log("---time_from --to",  new Date(time_from*1000), new Date(time_to*1000)); 
        //---------//
        // let trades = await Trade.find({pair_id: pair.pair_id, created_at: {$gte: time_from, $lte: time_to}}).sort({created_at: 1});
        let trades = await Trade.find({market: req.params.id, created_at: {$gte: time_from, $lte: time_to}}).sort({created_at: 1});
        if (period < 15) period = 15;
        else if (period > 240) period = 240;
        console.log(trades.length, period);
        if (trades.length === 0) {
            console.log("   === No Data ===   ".red);
            return res.end(JSON.stringify({ no_data: true, nextTime: time_to }));
        }
        let chartData = [];
        let currentPeriod = time_from;
        let nextPeriod =  currentPeriod+ period*60; // parseInt(new Date(time_from * 1000).setMinutes(new Date(time_from * 1000).getMinutes() + period) / 1000);                        
        // nextPeriod = currentPeriod;
        // let nextPeriod = currentPeriod  + period*60;
        console.log("---trade data--", trades[trades.length-1].created_at, new Date(trades[trades.length-1].created_at*1000));
        console.log("--next", nextPeriod,new Date(nextPeriod*1000)) ;

        let periodData = [];
        let periodProcess = function (period_data, p_time, old_item=undefined) {
            if (period_data.length > 0) {
                let period_item = [1605968100, 0.0, 0.0, 0.0, 0.0, 0.0]; // timestamp, open, high, low, close, volume
                period_item[0] = p_time;
                period_item[1] = period_data[0].price;
                period_item[4] = period_data[periodData.length - 1].price;
                for (let j = 0; j < period_data.length; j++) {
                    period_item[5] += period_data[j].amount;
                }
                // console.log("old: ", period_data);
                period_data.sort(that.comparePriceAccent);  // accent
                // console.log("new: ", period_data);
                period_item[2] = period_data[period_data.length - 1].price;
                period_item[3] = period_data[0].price;
                return period_item
            }
        };
        // let printIndex = 0;
        for (let i = 0; i < trades.length; i++) {
            // if (printIndex > 2) break;
            if (trades[i].created_at > nextPeriod) {
            // if (trades[i].created_at > currentPeriod) {
                // currentPeriod = nextPeriod;
                // let tmp = nextPeriod;
                // nextPeriod = currentPeriod + 60*period;      //parseInt(new Date(tmp * 1000).setMinutes(new Date(tmp * 1000).getMinutes() + period) / 1000);                
                if (periodData.length > 0) {
                        // if (i  > trades.length-10) {
                        //     console.log("currentPeriod, nextPeriod: ".red, currentPeriod, nextPeriod);
                        //     console.log("PeriodData: ".red, periodData);
                        // }                    
                        
                    let chart_item = periodProcess(periodData, currentPeriod);
                        //--- update currentPeriod -----//
                    if(periodData[periodData.length-1].created_at > nextPeriod + period*60)
                        currentPeriod= periodData[periodData.length-1].created_at - periodData[periodData.length-1].created_at % (period * 60);
                    else
                        currentPeriod = currentPeriod + 60*period;
                    nextPeriod = currentPeriod + 60*period;
                        // if (printIndex < 3) console.log("ChartItem: ".red, chart_item);
                        // printIndex++;
                    chartData.push(chart_item);
                }
                periodData = [];
                if (i > 0) periodData.push(trades[i - 1]);
            }
            periodData.push(trades[i]);
        }
        console.log("--final current period", new Date(currentPeriod*1000),new Date(nextPeriod*1000));
        console.log(chartData[chartData.length-1], new Date(1000*chartData[chartData.length-1][0]));
        if (periodData.length > 1) {
            let chart_item_final = periodProcess(periodData, currentPeriod);
            console.log(chart_item_final);             
            chartData.push(chart_item_final);
        }        
        return res.end(JSON.stringify(chartData));
    },
    api_balance: async function (req, res, next) {
        console.log("peatio_balance URL");
        return res.end(JSON.stringify([
                {
                    "currency": "bch",
                    "balance": "10.12",
                    "locked": "0.1"
                },
                {
                    "currency": "btc",
                    "balance": "0.21026373",
                    "locked": "0.0"
                },
                {
                    "currency": "eth",
                    "balance": "5.0",
                    "locked": "0.0"
                },
                {
                    "currency": "dash",
                    "balance": "5.0",
                    "locked": "0.0"
                },
                {
                    "currency": "ltc",
                    "balance": "6.0",
                    "locked": "0.0"
                },
                {
                    "currency": "xrp",
                    "balance": null,
                    "locked": "0.0"
                },
                {
                    "currency": "zar",
                    "balance": "1000.0",
                    "locked": "0.0"
                },
                {
                    "currency": "usd",
                    "balance": "1000.0",
                    "locked": "0.0"
                },
                {
                    "currency": "eur",
                    "balance": "1000.0",
                    "locked": "0.0"
                }
            ]
        ))
    },
    api_config: async function (req, res, next) {
        console.log("barong_config URL");
        return res.end(JSON.stringify({
            "session_expire_time": 5000,
            "captcha_type": "none",
            "captcha_id": "123abc456xyz789",
            "password_min_entropy": 14
        }))
    },
    api_currencies: async function (req, res, next) {
        console.log("peatio_currencies URL");
        return res.end(JSON.stringify([
            {
                "id": "bch",
                "name": "Bitcoin Cash",
                "symbol": "฿",
                "explorer_transaction": "https://www.blocktrail.com/tBCC/tx/#{txid}",
                "explorer_address": "https://www.blocktrail.com/tBCC/address/#{address}",
                "type": "coin",
                "min_confirmations": 7,
                "deposit_fee": "0.0",
                "withdraw_fee": "0.01",
                "withdraw_limit_24h": "0.1",
                "withdraw_limit_72h": "0.2",
                "deposit_enabled": true,
                "withdrawal_enabled": true,
                "base_factor": 100000000,
                "precision": 8
            },
            {
                "id": "btc",
                "name": "Bitcoin",
                "symbol": "฿",
                "explorer_transaction": "https://testnet.blockchain.info/tx/#{txid}",
                "explorer_address": "https://testnet.blockchain.info/address/#{address}",
                "type": "coin",
                "min_confirmations": 6,
                "deposit_fee": "0.0",
                "withdraw_fee": "0.005",
                "withdraw_limit_24h": "0.1",
                "withdraw_limit_72h": "0.2",
                "deposit_enabled": true,
                "withdrawal_enabled": true,
                "base_factor": 100000000,
                "precision": 8
            },
            {
                "id": "dash",
                "name": "Dash",
                "symbol": "Đ",
                "explorer_transaction": "https://test.insight.dash.siampm.com/dash/tx/#{txid}",
                "explorer_address": "https://test.insight.dash.siampm.com/dash/address/#{address}",
                "type": "coin",
                "min_confirmations": 6,
                "deposit_fee": "0.0",
                "withdraw_fee": "0.01",
                "withdraw_limit_24h": "0.2",
                "withdraw_limit_72h": "0.5000000000000001",
                "deposit_enabled": false,
                "withdrawal_enabled": false,
                "base_factor": 100000000,
                "precision": 8
            },
            {
                "id": "eth",
                "name": "Ethereum",
                "symbol": "Ξ",
                "explorer_transaction": "https://rinkeby.etherscan.io/tx/#{txid}",
                "explorer_address": "https://rinkeby.etherscan.io/address/#{address}",
                "type": "coin",
                "min_confirmations": 7,
                "deposit_fee": "0.0",
                "withdraw_fee": "0.02",
                "withdraw_limit_24h": "0.2",
                "withdraw_limit_72h": "0.5000000000000001",
                "deposit_enabled": true,
                "withdrawal_enabled": true,
                "base_factor": 1e+18,
                "precision": 8
            },
            {
                "id": "ltc",
                "name": "Litecoin",
                "symbol": "Ł",
                "explorer_transaction": "https://chain.so/tx/LTCTEST/#{txid}",
                "explorer_address": "https://chain.so/address/LTCTEST/#{address}",
                "type": "coin",
                "min_confirmations": 5,
                "deposit_fee": "0.0",
                "withdraw_fee": "0.01",
                "withdraw_limit_24h": "0.5000000000000001",
                "withdraw_limit_72h": "1.2",
                "deposit_enabled": true,
                "withdrawal_enabled": true,
                "base_factor": 100000000,
                "precision": 8
            },
            {
                "id": "trst",
                "name": "WeTrust",
                "symbol": "Ξ",
                "explorer_transaction": "https://rinkeby.etherscan.io/tx/#{txid}",
                "explorer_address": "https://rinkeby.etherscan.io/address/#{address}",
                "type": "coin",
                "min_confirmations": 5,
                "deposit_fee": "0.0",
                "withdraw_fee": "0.02",
                "withdraw_limit_24h": "300.0",
                "withdraw_limit_72h": "600.0",
                "deposit_enabled": false,
                "withdrawal_enabled": true,
                "base_factor": 1000000,
                "precision": 8
            },
            {
                "id": "usd",
                "name": "US Dollar",
                "symbol": "$",
                "type": "fiat",
                "min_confirmations": 4,
                "deposit_fee": "0.0",
                "withdraw_fee": "0.01",
                "withdraw_limit_24h": "100.0",
                "withdraw_limit_72h": "200.0",
                "deposit_enabled": true,
                "withdrawal_enabled": true,
                "base_factor": 1,
                "precision": 2
            },
            {
                "id": "xrp",
                "name": "Ripple",
                "symbol": "ꭆ",
                "explorer_transaction": "https://bithomp.com/explorer/#{txid}",
                "explorer_address": "https://bithomp.com/explorer/#{address}",
                "type": "coin",
                "min_confirmations": 5,
                "deposit_fee": "0.0",
                "withdraw_fee": "0.02",
                "withdraw_limit_24h": "100.0",
                "withdraw_limit_72h": "200.0",
                "deposit_enabled": true,
                "withdrawal_enabled": false,
                "base_factor": 1000000,
                "precision": 8
            },
            {
                "id": "zar",
                "name": "ZAR",
                "symbol": "$",
                "type": "fiat",
                "min_confirmations": 7,
                "deposit_fee": "0.0",
                "withdraw_fee": "0.02",
                "withdraw_limit_24h": "100.0",
                "withdraw_limit_72h": "200.0",
                "deposit_enabled": true,
                "withdrawal_enabled": false,
                "base_factor": 1,
                "precision": 2
            },
            {
                "id": "eur",
                "name": "Euro",
                "symbol": "€",
                "type": "fiat",
                "min_confirmations": 6,
                "deposit_fee": "0.0",
                "withdraw_fee": "0.02",
                "withdraw_limit_24h": "2000.0",
                "withdraw_limit_72h": "1000000.0",
                "deposit_enabled": false,
                "withdrawal_enabled": false,
                "base_factor": 1,
                "precision": 2
            }
        ]))
    },
});