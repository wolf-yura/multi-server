let config = {
    port: 9002,
    socket: 9003,
    base_url: 'http://127.0.0.1:9002',
    mongo: {
        host: '127.0.0.1',
        port: 27017,
        db_name: 'dextrading'
    },
};

module.exports = function () {
    return config;
};