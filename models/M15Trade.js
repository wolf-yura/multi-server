const mongoose = require('mongoose');
const Schema = mongoose.Schema;

let M15TradeSchema = new Schema({
    pair_id: String,
    timestamp: Number,
    open: Number,
    high: Number,
    low: Number,
    close: Number,
    volume: Number
});

module.exports.M15Trade = mongoose.model('m15trades', M15TradeSchema);