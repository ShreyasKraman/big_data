'use strict';

Object.defineProperty(exports, "__esModule", {
    value: true
});
exports.validateJson = undefined;

var _schema = require('./schema');

var Validator = require('jsonschema').Validator;


var v = new Validator();

v.addSchema(_schema.planCostSharesSchema, '/planCostShares');
v.addSchema(_schema.planserviceCostSharesSchema, '/planserviceCostShares');
v.addSchema(_schema.linkedPlanServicesSchema, '/linkedPlanServices');
v.addSchema(_schema.linkedServiceSchema, '/linkedService');

var validateJson = exports.validateJson = function validateJson(body) {

    return v.validate(body, _schema.JsonSchema).errors;
};