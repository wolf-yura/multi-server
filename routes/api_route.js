let express = require('express');
let router = express.Router();

let api_controller = require('../controllers/ApiController');

router.get('/peatio/account/balances', function (req, res, next) {
    api_controller.api_balance(req, res,next);
});
router.get('/finex/public/markets', function (req, res, next) {
    api_controller.api_markets(req, res, next);
});
router.get('/barong/identity/configs', function (req, res, next) {
    api_controller.api_config(req, res, next);
});
router.get('/peatio/public/currencies', function (req, res, next) {
    api_controller.api_currencies(req, res, next);
});
router.get('/peatio/public/markets/tickers', function (req, res, next) {
    api_controller.api_tickers(req, res, next)
});
router.get('/peatio/public/markets/:id/trades', function (req, res, next) {
    api_controller.api_trades(req, res, next);
});
router.get('/finex/public/markets/:id/k-line', function (req, res, next) {
    api_controller.api_k_line(req, res, next);
});
// router.get('/', function (req, res, next) {
//     return "Hello world !!!";
// });

module.exports = router;
