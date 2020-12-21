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
    total_liquidity: Number,
    oneday_volume_usd: Number,
    oneday_fee_usd: Number,
    pool_base_tokens: Number,  
    pool_quote_tokens: Number,
    liquidity_change_usd: Number,
    volume_change_usd: Number,
    
});

module.exports.Ticker = mongoose.model('tickers', TickerSchema);