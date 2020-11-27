let express = require('express');
let router = express.Router();

let middleware_controller = require('../controllers/MiddlewareController');
let home_controller = require('../controllers/HomeController');

router.get('/', middleware_controller.m_checkLogin, function (req, res, next) {
    return "Hello world !!!";
});

module.exports = router;
