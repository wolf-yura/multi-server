const mongoose = require('mongoose');
const Schema = mongoose.Schema;

let TradeSchema = new Schema({
    id: String,  // transaction id for swap
    pair_id: String,
    price: Number,
    amount: Number,
    total: Number,
    market: String,  // bnbusdt
    taker_type: String,
    created_at: Number,  // timestamp/1000
});

module.exports.Trade = mongoose.model('trades', TradeSchema);
