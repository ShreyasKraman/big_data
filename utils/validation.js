import {error, success} from './response';
const Validator = require('jsonschema').Validator;

import { planCostSharesSchema, 
         planserviceCostSharesSchema, 
         linkedPlanServicesSchema, 
         linkedServiceSchema, 
         JsonSchema 
       } from './schema';

let v = new Validator();

v.addSchema(planCostSharesSchema,'/planCostShares');
v.addSchema(planserviceCostSharesSchema,'/planserviceCostShares');
v.addSchema(linkedPlanServicesSchema,'/linkedPlanServices');
v.addSchema(linkedServiceSchema,'/linkedService');

export const validateJson = (body) => {

    let errors = v.validate(body,JsonSchema).errors;

    if(errors.length > 0){

        let message = "";
        for(let value in errors){
            message += errors[value] + ", ";
        }

        message = message.substring(0,message.length-2);

        return error(message);
    }

    return success("");

};
