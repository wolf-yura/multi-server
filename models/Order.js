const mongoose = require('mongoose');
const Schema = mongoose.Schema;

let OrderSchema = new Schema({
    id: String,  // '0x8a4fc7924189678a0caa9a85bd9e927467ac73fbc84972cfab40afc295ea03ad',
    market:String, // 'julbbnb'
    price: String, // 1.23
    inputAmount: String,  // '20667310718197501589',
    inputToken: String,  // '0x32dffc3fe8e3ef3571bf8a72c0d0015c5373f41d',
    minReturn: String,  // '1013103466578308901421',
    module: String,   // '0xa4410e6891245100f1dd4b57e2d631dbc1267cf3',
    outputToken: String,   // '0xe9e7cea3dedca5984780bafc599bd69add087d56',
    owner: String,   // '0xe3c97ceaccaeda1a4145da51d1994252507d56d4',
    secret: String,  // '0x206c696d69745f6f72646572732020d83ddc0986d24e3b906b2a3594c5f7b8ad',
    status: String,  // 'open',
    witness: String,  // '0xf05677f7c568e73b57f4e7485509308c1dbb3530',
    bought: String,
    createdAt: Number,  // '1606338157',
    updatedAt: Number,
    blockNumber: Number,
    createdTxHash: String, // '0x12a84d6039e6ba8f6bddea26ce1ef22fbbb3ff5c5b817062fc3618987ffd0883',
    cancelledTxHash: String,
    executedTxHash: String,
    side: String, // "buy" or "sell"
});

module.exports.Order = mongoose.model('orders', OrderSchema);