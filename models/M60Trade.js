const mongoose = require('mongoose');
const Schema = mongoose.Schema;

let M60TradeSchema = new Schema({
    pair_id: String,
    timestamp: Number,
    open: Number,
    high: Number,
    low: Number,
    close: Number,
    volume: Number
});

module.exports.M60Trade = mongoose.model('m60trades', M60TradeSchema);