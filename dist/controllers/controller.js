"use strict";

Object.defineProperty(exports, "__esModule", {
    value: true
});

var _services = require("../services/services");

var _services2 = _interopRequireDefault(_services);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var getAllController = async function getAllController(req, res) {};

var getByIdController = async function getByIdController(req, res) {};

var postController = async function postController(req, res) {

    var jsonBody = req.body;
    var result = _services2.default.createPlan(jsonBody);

    if (result.error) {
        return res.status(401).send({ error: true, message: result.message });
    }

    return res.status(200).send({ "Validation Message": result.message });
};

var putController = async function putController(req, res) {};

var deleteController = async function deleteController(req, res) {};

exports.default = {
    getAllController: getAllController,
    getByIdController: getByIdController,
    postController: postController,
    putController: putController,
    deleteController: deleteController
};