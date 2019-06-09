"use strict";

var _validation = require("../utils/validation");

var getAll = async function getAll() {};

var getById = async function getById(id) {};

var createPlan = function createPlan(body) {

    var jsonBody = body;

    var errors = (0, _validation.validateJson)(jsonBody);

    if (errors.length > 1) {

        var message = "";
        for (var value in errors) {
            message += errors[value][stack] + ", ";
        }

        message = message.substring(0, message.length - 1);

        return {
            error: "true",
            message: message
        };
    }

    return {
        error: false,
        message: "No Errors"
    };
};

var updatePlan = async function updatePlan(id, body) {};

var deletePlan = async function deletePlan(id) {};

module.exports = {
    getAll: getAll,
    getById: getById,
    createPlan: createPlan,
    updatePlan: updatePlan,
    deletePlan: deletePlan
};