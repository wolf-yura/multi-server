const mongoose = require('mongoose');
const Schema = mongoose.Schema;

let M240TradeSchema = new Schema({
    pair_id: String,
    timestamp: Number,
    open: Number,
    high: Number,
    low: Number,
    close: Number,
    volume: Number
});

module.exports.M240Trade = mongoose.model('m240trades', M240TradeSchema);