const WebSocket = require('ws');
const Helpers = require('./helpers')
const customRanger = require('./customRanger')();
const Trade = require('../models/Trade').Trade;
const Market = require('../models/Market').Market;

const isSubscribed = (streams, routingKey) => {
    for (const i in streams) {
        const stream = streams[i];
        if (routingKey.startsWith(stream) || routingKey.endsWith(stream)) {
            return true;
        }
    }
    return false;
};

const sendEvent = (ws, routingKey, event) => {
    try {
        if (isSubscribed(ws.streams, routingKey)) {
            const payload = {};
            payload[routingKey] = event;
            ws.send(JSON.stringify(payload));
        }
    } catch (error) {
        console.log(`failed to send ranger message: ${error}`);
    }
};

// const tickersMock = (ws, markets) => () => {
//     sendEvent(ws, "global.tickers", Helpers.getTickers(markets));
// };
const tickersMock = (ws) => async () => {
    let ticker = await customRanger.getTicker();
    let pairTicker = {
        "global.tickers": ticker
    };
    // console.log("Global Ticker");
    ws.send(JSON.stringify(pairTicker));
};

const ordersMock = (ws) => async () => {
    //let ownerAddress= "0x7f1b39cff0e6e02f0e8d35dd49e302cc78a306e1";
    let marketId = customRanger.getMarketId(ws.streams);
    let ownerAddress= customRanger.getOwnerAddress(ws.streams);
    // console.log("market Id ", marketId);
    ws.sequences[marketId] = 1;    
    
    // console.log(`orderBookSnapshotMock called: ${marketId}`);    
    let orders = await customRanger.getMyOrders(ownerAddress, marketId);  

    if(orders.length>0)
    {        
        const last_order_updated_at = orders[0].updated_at;
        if(last_order_updated_at > ws.order_updated_at)
        {
            ws.order_updated_at= orders[0].updated_at;        
            console.log("---last update", ws.order_updated_at);
            try {
                if (isSubscribed(ws.streams, `${ownerAddress}.myorders`)) {            
                    let pairOrders = {
                    "private.orders": orders
                    };                    
                    
                    // console.log(`-----sending my orders: ${marketId}`);
                    // const payload = {};
                    // payload[`${marketId}.ob-snap`] = {"asks": orders.asks, "bids": orders.bids, "sequence":1};
                    ws.send(JSON.stringify(pairOrders));
                }
            } catch (error) {
                console.log(`failed to send ranger message: ${error}`);
            } 
        }       
    }
       
};

const balancesMock = (ws) => () => {
    sendEvent(ws, "balances", Helpers.getBalances());
};

/*
    Example: ["btcusd.update",{"asks":[["1000.0","0.1"]],"bids":[]}]
*/
const orderBookUpdateMock = (ws) => () => {
    let marketId = customRanger.getMarketId(ws.streams);
    sendEvent(ws, `${marketId}.update`, Helpers.getDepth(0));
};

// Inremental orderbook support
const orderBookSnapshotMock = (ws) => async () => {
    // ws.sequences[marketId] = 1;
    // console.log(`orderBookSnapshotMock called: ${marketId}`);
    // try {
    //     if (isSubscribed(ws.streams, `${marketId}.ob-inc`)) {
    //         console.log(`orderBookSnapshotMock sending: ${marketId}`);
    //         const payload = {};
    //         payload[`${marketId}.ob-snap`] = Helpers.getDepth(ws.sequences[marketId]);
    //         console.log("orderBookSnapshotMock: ", JSON.stringify(payload));
    //         ws.send(JSON.stringify(payload));
    //     }
    // } catch (error) {
    //     console.log(`failed to send ranger message: ${error}`);
    // }
    let marketId = customRanger.getMarketId(ws.streams);
    ws.sequences[marketId] = 1;
    console.log(`orderBookSnapshotMock called: ${marketId}`);
    let orders = await customRanger.getOrderBook(marketId);
    try {
        if (isSubscribed(ws.streams, `${marketId}.ob-inc`)) {
            console.log(`orderBookSnapshotMock sending: ${marketId}`);
            const payload = {};
            payload[`${marketId}.ob-snap`] = {"asks": orders.asks, "bids": orders.bids, "sequence":1};
            ws.send(JSON.stringify(payload));
        }
    } catch (error) {
        console.log(`failed to send ranger message: ${error}`);
    }
    // ws.send(JSON.stringify( {
    //     "julbbnb.ob-snap":
    //         {"asks": [["15.0","30.729274681425732"],["20.0","109.22927468142574"],["20.5","39.229274681425736"],["30.0","30.229274681425732"]],
    //             "bids":[["10.95","30.729274681425732"],["10.90","74.22927468142574"],["10.85","64.22927468142574"],["10.70","39.229274681425736"]],
    //             "sequence":1
    //         }}));
    // };
    // ws.send(JSON.stringify(orderBook));
};

const orderBookIncrementMock = (ws, marketId) => () => {
    let marketId = customRanger.getMarketId(ws.streams);
    let event = Helpers.getDepthIncrement();
    event.sequence = ++ws.sequences[marketId];
    sendEvent(ws, `${marketId}.ob-inc`, event);
};


// const getMyOrders = (ws) => async () => {    

//     console.log("----ws.streams ", ws.streams);
//     let marketId = customRanger.getMarketId(ws.streams);
//     ws.updated_at ++;
//     console.log(ws.updated_at);
//     // ws.sequences[marketId] = 1;
//     let ownerAddress= "0xafce130b2cd93d191a6c16e784a4f200107399ee";
//     console.log(`orderBookSnapshotMock called: ${ownerAddress}`);
//     let orders = await customRanger.getMyOrders(ownerAddress, marketId);
//     try {
//         if (isSubscribed(ws.streams, `${marketId}.ob-inc`)) {
//             console.log(`my order sending: ${ownerAddress}`);
//             const payload = {};
//             payload[`orders`] = {"open": orders.myOrderOpen , "history": orders.myOrderHistory};
//             ws.send(JSON.stringify(payload));
//         }
//     } catch (error) {
//         console.log(`failed to send ranger message: ${error}`);
//     }
//     // ws.send(JSON.stringify( {
//     //     "julbbnb.ob-snap":
//     //         {"asks": [["15.0","30.729274681425732"],["20.0","109.22927468142574"],["20.5","39.229274681425736"],["30.0","30.229274681425732"]],
//     //             "bids":[["10.95","30.729274681425732"],["10.90","74.22927468142574"],["10.85","64.22927468142574"],["10.70","39.229274681425736"]],
//     //             "sequence":1
//     //         }}));
//     // };
//     // ws.send(JSON.stringify(orderBook));
// };
/*
    Success order scenario:
        * Private messages:
            ["order",{"id":758,"at":1546605232,"market":"macarstc","kind":"bid","price":"1.17","state":"wait","remaining_volume":"0.1","origin_volume":"0.1"}]
            ["order",{"id":758,"at":1546605232,"market":"macarstc","kind":"bid","price":"1.17","state":"done","remaining_volume":"0.0","origin_volume":"0.1"}]
            ["trade",{"id":312,"kind":"bid","at":1546605232,"price":"1.17","remaining_volume":"0.1","ask_id":651,"bid_id":758,"market":"macarstc"}]

        * Public messages:
            ["macarstc.trades",{"trades":[{"tid":312,"type":"buy","date":1546605232,"price":"1.17","amount":"0.1"}]}]
*/

// Those functions are the same used in k-line mocked API
const minDay = 6;
const maxDay = 10;
const fakePeriod = 86400;

const timeToPrice = (time) => {
    return minDay + (maxDay - minDay) / 2 * (1 + Math.cos((time / fakePeriod) * 2 * Math.PI));
};

const timeToVolume = (time, periodInSeconds) => {
    return maxDay * 10 / 2 * (1 + Math.cos((time / fakePeriod) * 2 * Math.PI));
};

const kLine = (time, period) => {
    const periodInSeconds = parseInt(period * 60);
    const roundedTime = parseInt(time / periodInSeconds) * periodInSeconds;
    const open = timeToPrice(time);
    const close = timeToPrice(time + periodInSeconds);
    const delta = (maxDay - minDay) / fakePeriod * periodInSeconds * 2;
    const high = Math.max(open, close) + delta;
    const low = Math.min(open, close) - delta;
    const volume = timeToVolume(time, periodInSeconds);

    return [roundedTime, open, high, low, close, volume].map().toString()
};

let tradeIndex = 100000;
let orderIndex = 100;

const matchedTradesMock = (ws) => async () => {
    let marketId = customRanger.getMarketId(ws.streams);
    
    let price = 0.1;
    let volume = 1000;
    let pair = await Market.findOne({id: marketId});                
    let trades = await Trade.find({market: pair.id, created_at: {$gt: ws.recent_trades_updated_at}}).select({_id: 0, pair_id: 0}).sort({created_at:1}).limit(10);
    console.log("recent trades".blue,   trades, ws.recent_trades_updated_at);
    
        
    // const tradeId = tradeIndex++;    
    // const takerType = Math.random() < 0.5 ? "buy" : "sell";
    // price += 0.01;
    // volume += 50;       
    // let at = parseInt(Date.now() / 1000);
    // let remainingVolume = volume;
    // const executedVolume = volume - remainingVolume;

    //     const publicTrade = {
    //     "tid": tradeId,
    //     "date": at,
    //     "taker_type": takerType,
    //     "price": price,
    //     "amount": volume,
    //     "total": (volume * price).toFixed(4)
    // };

    // // sendEvent(ws, `${marketId}.trades`, { "trades": [publicTrade] });    
    
    if(trades && trades.length>0)
    {
        let sendTrades =[];
        for(let i=0; i<trades.length; i++)
        {
            const trade = trades[i];
            let oneTrade ={
                "id" : trade.id,
                "tid": trade.id,
                "date": trade.created_at,
                "taker_type": trade.taker_type,
                "price": trade.price,
                "amount": trade.amount,
                "total": trade.total
            };
            sendTrades.push(oneTrade);
        }
        sendEvent(ws, `${marketId}.trades`, { "trades": sendTrades });    
        ws.recent_trades_updated_at =  trades[trades.length-1].created_at;
    }
};

// const klinesMock = (ws, marketId) => () => {
//     let at = parseInt(Date.now() / 1000);

//     sendEvent(ws, `${marketId}.kline-1m`, kLine(at, 1));
//     sendEvent(ws, `${marketId}.kline-5m`, kLine(at, 5));
//     sendEvent(ws, `${marketId}.kline-15m`, kLine(at, 15));
//     sendEvent(ws, `${marketId}.kline-30m`, kLine(at, 30));
//     sendEvent(ws, `${marketId}.kline-1h`, kLine(at, 60));
//     sendEvent(ws, `${marketId}.kline-2h`, kLine(at, 120));
//     sendEvent(ws, `${marketId}.kline-4h`, kLine(at, 240));
//     sendEvent(ws, `${marketId}.kline-6h`, kLine(at, 360));
//     sendEvent(ws, `${marketId}.kline-12h`, kLine(at, 720));
//     sendEvent(ws, `${marketId}.kline-1d`, kLine(at, 1440));
//     sendEvent(ws, `${marketId}.kline-3d`, kLine(at, 4320));
//     sendEvent(ws, `${marketId}.kline-1w`, kLine(at, 10080));
// };
const klinesMock = (ws) => async () => {
    const [pairAddress, period, periodStr] = customRanger.getKLineParams(ws.streams);    

    let kLineItem = await customRanger.getChartTrades(pairAddress, period);
    console.log("kLineItem: ".red, kLineItem, pairAddress, periodStr);
    if(kLineItem && kLineItem.length && kLineItem.length>0)
        ws.send(JSON.stringify({kline: {item: kLineItem, pair: pairAddress, period: periodStr}}));
};
class RangerMock {
    constructor(port) {
        this.port = port;
        this.start();
    }
    start() {
        this.wss = new WebSocket.Server({ port: this.port });
        const url = `ws://0.0.0.0:${this.port}`.green;
        console.log(`Ranger: listening on ${url}`);
        const ranger = this;
        this.wss.on('connection', function connection(ws, request) {
            ranger.initConnection(ws, request);
            ws.on('message', (message) => ranger.onMessage(ws, message));
            ws.on('close', () => ranger.closeConnection(ws));
        });
    }
    close() {
        this.wss.close();
    }
    // timerList= [];
    initConnection(ws, request) {
        ws.authenticated = true;
        ws.timers = [];
        ws.streams = [];
        ws.sequences = {};
        ws.order_updated_at = 0;
        ws.recent_trades_updated_at = parseInt( Date.now()/1000);
        console.log(`Ranger: connection accepted, url: ${request.url}`);

        this.subscribe(ws, Helpers.getStreamsFromUrl(request.url));
        // console.log("----streams", ws.streams);
        
        
        ws.timers.push(setInterval(tickersMock(ws), 3000));
        
        // ws.timers.push(setInterval(orderBookIncrementMock(ws), 2000));
        // ws.timers.push(setInterval(orderBookUpdateMock(ws), 2000));
        ws.timers.push(setInterval(matchedTradesMock(ws), 3000));
        ws.timers.push(setInterval(klinesMock(ws), 5000));
        ws.timers.push(setInterval(ordersMock(ws), 4000));
        ws.timers.push(setInterval(orderBookSnapshotMock(ws),7000));
        
    }
    closeConnection(ws) {
        console.log('Ranger: connection closed');   
    //--- when socket is closed, all timers are closed.     
       ws.timers.forEach(timer => {
        //    console.log(timer)
        clearInterval(timer)    
       });
       
        
    }
    onMessage(ws, message) {
        if (message.length === 0)
            return;
        try {
            console.log('Ranger: received message: %s', message);
            var payload = JSON.parse(message);

            if ("jwt" in payload) {
                if (payload["jwt"] === "Bearer null") {
                    ws.send(JSON.stringify({ "error": { "message": "Authentication failed." } }));
                } else {
                    ws.send(JSON.stringify({ "success": { "message": "Authenticated." } }));
                    ws.authenticated = true;
                }
            }
            switch (payload["event"]) {
                case "subscribe":
                    this.subscribe(ws, payload["streams"]);
                    break;

                case "unsubscribe":
                    this.unsubscribe(ws, payload["streams"]);
                    break;
            }
        } catch (err) {
            console.log(`Ranger: Something went wrong: ${err} (message: ${message})`);
        }

    }
    subscribe(ws, streams) {
        console.log("subscribed streams: ".magenta, streams);
        let marketId = customRanger.getMarketId(streams);
        ws.streams = Helpers.unique(ws.streams.concat(streams));
        // console.log("subcribed to ws.streams: ".magenta, marketId, ws.streams);
        // orderBookSnapshotMock(ws, marketId)();
        // this.markets.forEach((name) => {
        // let { marketId } = Helpers.getMarketInfos(name);
        orderBookSnapshotMock(ws, marketId)();
        // ordersMock(ws);
        //-----my orders ------//
        ordersMock(ws)();

        // });
        ws.send(JSON.stringify({ "success": { "message": "subscribed", "streams": ws.streams } }))
    }
    unsubscribe(ws, streams) {
        ws.streams = ws.streams.filter((value) => streams.indexOf(value) === -1);
        console.log("unsubscribed streams".yellow, streams);
        ws.timers.pop()
        ws.send(JSON.stringify({ "success": { "message": "unsubscribed", "streams": ws.streams } }))
    }
}

module.exports = RangerMock;
