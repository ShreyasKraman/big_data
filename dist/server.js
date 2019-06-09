'use strict';

var _express = require('express');

var _express2 = _interopRequireDefault(_express);

var _redis = require('redis');

var _redis2 = _interopRequireDefault(_redis);

var _router = require('./router/router');

var _router2 = _interopRequireDefault(_router);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var app = (0, _express2.default)();

//create and connect redis client
var client = _redis2.default.createClient();

// output redis errors to console
client.on('error', function (err) {
    console.log("error", err);
});

//Parse the request into body
app.use(_express2.default.json());

//Check if its working
app.get('/', function (req, res) {
    return res.send('App is working');
});

app.use('/plan', _router2.default);

var PORT = 3000;

app.listen(PORT, function () {
    console.log('server running on port 3000');
});

module.exports = {
    app: app
};