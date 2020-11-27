const mongoose = require('mongoose');
const Schema = mongoose.Schema;

let MarketSchema = new Schema({
    id: String,   // usdtbusd
    pair_id: String,  // 0x0800a8cf97cb8076771ac52a156eb4fc8a58e08a
    volumeUSD: Number,
    unique_code: Number,  // 1: unique, 2: duplicated
    name: String,
    base_unit: String,
    quote_unit: String,
    base_contract: String,
    quote_contract: String,
    state: String,
    amount_precision: Number,
    price_precision: Number,
    min_price: String,
    max_price: String,
    min_amount: String,
    filters: Object,
});

module.exports.Market = mongoose.model('markets', MarketSchema);