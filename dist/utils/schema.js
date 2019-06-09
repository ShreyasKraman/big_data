"use strict";

//JSON Schema for REST API

var planCostSharesSchema = {
    "id": "/planCostShares",
    "type": "object",
    "properties": {
        "deductible": { "type": "number" },
        "_org": { "type": "string" },
        "copay": { "type": "number" },
        "objectId": { "type": "string" },
        "objectType": { "type": "string" }
    },
    "required": ["objectId", "objectType"]
};

var linkedServiceSchema = {
    "id": "/linkedService",
    "type": "object",
    "properties": {
        "_org": { "type": "string" },
        "objectId": { "type": "string" },
        "objectType": { "type": "string" },
        "name": { "type": "string" }
    },
    "required": ["objectId", "objectType"]
};

var planserviceCostSharesSchema = {
    "id": "/planserviceCostShares",
    "type": "object",
    "properties": {
        "deductible": { "type": "number" },
        "_org": { "type": "string" },
        "copay": { "type": "number" },
        "objectId": { "type": "string" },
        "objectType": { "type": "string" }
    },
    "required": ["objectId", "objectType"]
};

var linkedPlanServicesSchema = {
    "id": "/linkedPlanServices",
    "type": "array",
    "items": {
        "oneOf": [{
            "type": "object",
            "properties": {
                "linkedService": { "$ref": "/linkedService" },
                "planserviceCostShares": { "$ref": "/planserviceCostShares" },
                "_org": { "type": "string" },
                "objectId": { "type": "string" },
                "objectType": { "type": "string" }
            },
            "required": ["objectId", "objectType"]
        }]
    }
};

var JsonSchema = {
    "id": "/jsonSchema",
    "type": "object",
    "properties": {
        "planCostShares": { "$ref": "/planCostShares" },
        "linkedPlanServices": { "$ref": "/linkedPlanServices" },
        "_org": { "type": "string" },
        "objectId": { "type": "string" },
        "objectType": { "type": "string" },
        "planType": { "type": "string" },
        "creationDate": { "type": "string" }
    },
    "required": ["objectId", "objectType"]
};

module.exports = {
    planCostSharesSchema: planCostSharesSchema,
    linkedPlanServicesSchema: linkedPlanServicesSchema,
    linkedServiceSchema: linkedServiceSchema,
    planserviceCostSharesSchema: planserviceCostSharesSchema,
    JsonSchema: JsonSchema
};