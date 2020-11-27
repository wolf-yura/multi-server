const mongoose = require('mongoose');
const Schema = mongoose.Schema;

let M30TradeSchema = new Schema({
    pair_id: String,
    timestamp: Number,
    open: Number,
    high: Number,
    low: Number,
    close: Number,
    volume: Number
});

module.exports.M30Trade = mongoose.model('m30trades', M30TradeSchema);