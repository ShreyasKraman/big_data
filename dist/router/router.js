'use strict';

var _express = require('express');

var _express2 = _interopRequireDefault(_express);

var _controller = require('../controllers/controller');

var _controller2 = _interopRequireDefault(_controller);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var router = _express2.default.Router();

//Get all plans
router.get('/plan', _controller2.default.getAllController);
//get plan by id
router.get('/plan/:Id', _controller2.default.getByIdController);

//post plan
router.post('/plan', _controller2.default.postController);

//make changes to the plan
router.put('/plan/:id', _controller2.default.putController);

//delete plan by id
router.delete('/plan/:id', _controller2.default.deleteController);

module.exports = router;