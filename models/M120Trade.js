const mongoose = require('mongoose');
const Schema = mongoose.Schema;

let M120TradeSchema = new Schema({
    pair_id: String,
    timestamp: Number,
    open: Number,
    high: Number,
    low: Number,
    close: Number,
    volume: Number
});

module.exports.M120Trade = mongoose.model('m120trades', M120TradeSchema);