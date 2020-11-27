let _ = require("underscore");
let config = require('../config')();
let fs = require('fs');
let crypto = require('crypto');
let fetch = require('node-fetch');

module.exports = {
    name: "BaseController",
    extend: function (child) {
        return _.extend({}, this, child);
    },
    compareTimestampDecent: function (a, b) {
        if (a.timestamp < b.timestamp) return 1;
        if (a.timestamp > b.timestamp) return -1;
        return 0;
    },
    comparePriceDecent: function (a, b) {
        if (a.price < b.price) return 1;
        if (a.price > b.price) return -1;
        return 0;
    },
    compareTimestampAccent: function (a, b) {
        if (a.timestamp < b.timestamp) return -1;
        if (a.timestamp > b.timestamp) return 1;
        return 0;
    },
    comparePriceAccent: function (a, b) {
        if (a.price < b.price) return -1;
        if (a.price > b.price) return 1;
        return 0;
    },
    periodProcess: function (period_data, p_time) {
        let period_item = [1605968100, 0.0, 0.0, 0.0, 0.0, 0.0]; // timestamp, open, high, low, close, volume
        period_item[0] = p_time;  // timestamp
        period_item[1] = period_data[0].price;                            // open
        period_item[4] = period_data[period_data.length - 1].price;       // close
        for (let j = 0; j < period_data.length; j++) {
            period_item[5] += period_data[j].amount;                      // volume
        }
        period_data.sort(this.comparePriceAccent);  // accent
        period_item[2] = period_data[period_data.length - 1].price;       // low
        period_item[3] = period_data[0].price;                            // high
        return period_item
    }
};
