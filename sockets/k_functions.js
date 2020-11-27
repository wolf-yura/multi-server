const k_functions = {
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
    big_to_float: function (bigString) {  // 18 float point
        let point = 18;
        if (bigString.length > 18) {
            let newBigStr = bigString.substr(0, bigString.length - point) + "." + bigString.substr(bigString.length - point);
            return parseFloat(newBigStr);
        } else {
            let zeroStr = "00000000000000000";
            let newBigStr = "0." + zeroStr.substr(0, point - bigString.length) + bigString;
            return parseFloat(newBigStr);
        }
    }
};

module.exports = function () {
    return k_functions;
};