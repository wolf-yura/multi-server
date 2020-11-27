const mongoose = require('mongoose');
const Schema = mongoose.Schema;

let TickerSchema = new Schema({
    pair_id: String,    // pair id
    pair_name: String,  // ex: julbbnb
    amount: Number,
    low: Number,
    high: Number,
    last: Number,
    open: Number,
    volume: Number,
    avg_price: Number,  // bnbusdt
    price_change_percent: String,
    at: Number,  // timestamp/1000
});

module.exports.Ticker = mongoose.model('tickers', TickerSchema);