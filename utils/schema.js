//JSON Schema for REST API

const planCostSharesSchema = {
    "id":"/planCostShares",
    "type":"object",
    "properties": {
        "deductible": {"type" : "number"},
		"_org": {"type" : "string"},
		"copay": {"type" : "number"},
		"objectId": {"type" : "string"},
		"objectType": {"type" : "string"}
    },
    "required":["objectId","objectType"],
};

const linkedServiceSchema = {
    "id":"/linkedService",
    "type":"object",
    "properties":{
        "_org": {"type":"string"},
		"objectId": {"type":"string"},
		"objectType": {"type":"string"},
		"name": {"type":"string"},
    },
    "required":["objectId","objectType"],
};

const planserviceCostSharesSchema = {
    "id":"/planserviceCostShares",
    "type":"object",
    "properties": {
        "deductible": {"type":"number"},
		"_org": {"type":"string"},
		"copay": {"type":"number"},
		"objectId": {"type":"string"},
		"objectType": {"type":"string"}
    },
    "required":["objectId","objectType"],
};

const linkedPlanServicesSchema = {
    "id":"/linkedPlanServices",
    "type":"array",
    "items":{
        "oneOf":[
            {
                "type":"object",
                "properties":{
                    "linkedService":{"$ref":"/linkedService"},
                    "planserviceCostShares":{"$ref":"/planserviceCostShares"},
                    "_org": {"type":"string"},
                    "objectId": {"type":"string"},
                    "objectType": {"type":"string"}
                },
                "required":["objectId","objectType"],
            }
        ]
    }
}


const JsonSchema = 
{   
    "id":"/jsonSchema",
    "type":"object",
    "properties":{
        "planCostShares": {"$ref":"/planCostShares"},
        "linkedPlanServices": {"$ref":"/linkedPlanServices"},
        "_org": {"type":"string"},
        "objectId": {"type":"string"},
        "objectType": {"type":"string"},
        "planType": {"type":"string"},
        "creationDate": {"type":"string"},
    },
    "required":["objectId","objectType"],
}

module.exports = {
    planCostSharesSchema,
    linkedPlanServicesSchema,
    linkedServiceSchema,
    planserviceCostSharesSchema,
    JsonSchema
}