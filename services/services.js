import { validateJson } from '../utils/validation';
import { success, error } from '../utils/response';
import { getRedisClient } from '../dbstore/redis';
import resources from '../utils/resource';
import {promisify} from 'util';
import {secret_key,client_id} from '../utils/keys';

import jwt from 'jsonwebtoken';

import uuid from 'uuid/v4';
import { create } from 'domain';


const register = async(client_type,redirect_url) => {
    let res = {};
    if(secret_key.length!== 0 && client_id.length!==0){
        
        if(client_type === 'confidential')
            res = {
                client_id,
                secret_key,
                redirect_url
            }
        else
            res = {client_id,redirect_url};

        return success(res,200);
        
    }
    return error("Failed to register",403);
}

const authorize = async (body) => {
    if(body){
        const client_id = body["client_id"];
        let token = await jwt.sign({client_id},secret_key);
        const redirect_url = body.redirect_uri + "?" + body.response_type + "=" + token + "&state="+body.state;
        return success({redirect_url},302);
    }

    return error("Not authorized",403);

}

const verifyToken = async (token) => {
    if(token){
        try{
            await jwt.verify(token,secret_key);
        }catch(err){
            return error(err,401);
        }
        
        return success("Verified",200);
    }

    return error("No Token",403);
}

const getAll = async() => {

};

const getById = async (id) => {

    const client = await getRedisClient();

    if(client){


        let getAsync = promisify(client.hgetall).bind(client);

        const res = await getAsync(id);

        if(res){
            return success(res, 200);
        }

        return success("No corresponding values found", 204);

    }

    return error("Client not working", 401);

};

const ifNoneMatch = async (etag,id) => {

    const client = await getRedisClient()

    let getAsync = promisify(client.get).bind(client);

    //1. Check if Etag is associated with id sent
    const etagId = await getAsync(id+"_ETAG");
    let res = await resources.compare(etag,etagId);

    //2. If yes send 304, asking user to accpet request from caching
    if(res){
        return success("ETag working well. Please use IF-MATCH",304);
    }

    //3. If etag is not associated, then associate the etag with this value.

    const json_id = await getAsync(id.trim()); // get the root id of JSON request stored
    let result = {};
    if(json_id){
        res = await getById(json_id); // get the children of root id
        if(res.success){
            
            //build json response
            result = await buildResponse(res.body);

            console.log("in here");

            //3. a. For first request
            if(etag === '*'){

                if(result)
                    return success(result,200);
                
                return error("No data found",204);
            }

            //3. b. For subsequent request, store etag with id's value

            //set etag
            await client.set(id+"_ETAG",etag);
            
            //set values to etag
            await client.set(etag,JSON.stringify(result));

            return success(result,200);

        }
    }

    //return error or no values found for the id
    return error("No values found",204);

}

const ifMatch = async (etag) => {

    if(etag){
        const client = await getRedisClient();

        const getAsync = promisify(client.get).bind(client);

        const res = JSON.parse(await getAsync(etag));

        if(res){

            return success(res,200);
        }
        
    }

    return error("Link expired",412);

}

const createPlan = async (body) => {

    const jsonBody = body;

    const response = validateJson(jsonBody);
    
    if(response.error){
        return error(response.message, 401);
    }

    const client = await getRedisClient();
    
    if(client){
        
        if(typeof(jsonBody) == "object"){

            let super_key = jsonBody["objectType"] + "__" + jsonBody['objectId'];
            let parameters = [];
            let arrayParameters = [];
            let keyCount = 0;
            
            for(let key in jsonBody){

                //Handle value of type array
                if(Array.isArray(jsonBody[key])){
                    await Promise.all(jsonBody[key].map( async (contents) => {
                        const edge = await resources.setParameters("",key,contents);
                        if(edge){
                            // parameters.push("Array"+keyCount++);
                            // parameters.push(edge);
                            arrayParameters.push(edge);
                            return parameters;
                        }else
                            console.log("no Edge"); 
                    }));

                    if(arrayParameters.length != 0){
                        const uuid_key = uuid();
                        const newKey = uuid_key + "-" + key; 
                        const result = await client.rpush(newKey, ...arrayParameters);

                        parameters.push(key);
                        parameters.push(newKey);
                        console.log("Array push",result);
                    }

                    continue;

                //Handle value of type object  
                } else if(typeof(jsonBody[key]) === 'object'){

                    //storing edge reference
                    const edge = await resources.setParameters("",key,jsonBody[key]);
                    parameters.push(key);
                    parameters.push(edge);
                    continue;
                }

                //parent data contents
                parameters.push(key);
                parameters.push(jsonBody[key]);
            }

            //set parent id
            client.hmset(super_key,parameters, (err, res) => {
                if(err){
                    console.log("Super Key",err);
                }
            });

            const unique_key = uuid();

            client.set(unique_key,super_key);

            return success("Your unique key : "+ unique_key, 201);
        }
    }

    return error("Server error. Please try again after some time", 401)

};

const updatePlan = async(id,jsonBody) => {

    if(id){
        if(jsonBody){

            // await createPlan(body);

            const response = validateJson(jsonBody);
    
            if(response.error){
                return error(response.message, 401);
            }

            const client = await getRedisClient();

            if(client){
        
                if(typeof(jsonBody) == "object"){
        
                    let super_key = jsonBody["objectType"] + "__" + jsonBody['objectId'];
                    let parameters = [];

                    for(let key in jsonBody){

                        //Handle value of type array
                        if(Array.isArray(jsonBody[key])){

                            await Promise.all(jsonBody[key].map( async (contents) => {

                                const key_to_search = contents["objectType"] + "__" + contents['objectId'] + "-" + key;

                                console.log("Key to search",key_to_search);

                                let response = await getById(key_to_search);

                                if(response.status === 204){
                                    const edge = await resources.setParameters("",key,contents);
                                    if(edge){
                                        parameters.push("Array"+keyCount++);
                                        parameters.push(edge);
                                        return parameters;
                                    }else
                                        console.log("no Edge"); 

                                    //push the new element to array;
                                    let result = getById(super_key);

                                    if(result.status === 200){
                                        const body = result.body;
                                        const list_key = body[key];

                                        //push node to list
                                        result = await client.rpush(list_key, edge);

                                        console.log("Node push",result);
                                    }else{
                                        console.log("Node push failed");
                                    }
                                    
                                }else if(response.status === 200){

                                    const result = await resources.updateContents(response.body,contents);
                                    if(result.status === 201){

                                    }
                                }

                            }));
        
                            continue;
        
                        //Handle value of type object  
                        } else if(typeof(jsonBody[key]) === 'object'){
        
                            // //storing edge reference
                            // const edge = await resources.setParameters("",key,jsonBody[key]);
                            // parameters.push("Key"+keyCount++);
                            // parameters.push(edge);
                            // continue;
                        }
        
                        //parent data contents
                        // parameters.push(key);
                        // parameters.push(jsonBody[key]);
                    }
                }
            }


            // await resources.deletePlanETAG(id);            

            return("Value updated successfully");

        }else{
            return error("Body is required");
        }
    }
    return error("Id is required");

};

const patchPlan = async(id,body) => {

    if(body && id){
        const res = await resources.patchAll(body, '',id);
        if(res.success){
            await resources.deletePlanETAG(id);
        }
        return res;

    }

    return error("No body",401);

};

const deletePlan = async(id) => {
    if (id){
        const client = await getRedisClient();

        const res = await getById(id);
        if(res.success){
            const parameters = [];
            console.log("Delete id",res);
            for(let values in res.body){
                //delete corresponding values of etag
                parameters.push(values);
                parameters.push(res.body[values]);
            }
            
            console.log(parameters);
            client.HDEL(id,parameters);

            await resources.deletePlanETAG(id);

            return success("Values Deleted",200);

        }

        return error("Error",404);

    }

    return error("Id must be provided",401);
}


//Build JSON response
const buildResponse = async(jsonBody) => {

    const res = {};
    const jsonArray = [];
    let arrayKey = '';

    const client = getRedisClient();

    for(let key in jsonBody){

        const split = jsonBody[key].split('-');
        //add key values to res if no object or array found
        if(split[split.length - 1] !== key){
            res[key] = jsonBody[key];
            continue;
        }

        try{
            const response = await getById(jsonBody[key]);

            if(response.success){
                const body = response.body;

                //key of response
                const splitArray = jsonBody[key].split('-');
                const len = splitArray.length;

                //body of response
                const result = await buildResponse(body);

                //for json object
                    
                res[key] = result;

                continue;
            }

        }catch(e){
            if(e.code === 'WRONGTYPE'){
                arrayKey = key;
                const getAsync = promisify(client.lrange).bind(client);

                const items = await getAsync(jsonBody[key],0,-1);

                await Promise.all(items.map( async (element) => {
                    const response = await getById(element);
                    // console.log("Id response",response);
                    if(response.success){
                        const body = response.body;
                        //body of response
                        const result = await buildResponse(body);
                        jsonArray.push(result);
                    }
                }));

            }else{
                return error("Error while parsing",401);
            }
        }

    }
    if(jsonArray.length > 0)
        res[arrayKey] = jsonArray;

    return res;
}

module.exports = {
    getAll,
    getById,
    createPlan,
    updatePlan,
    patchPlan,
    deletePlan,
    ifMatch,
    ifNoneMatch,
    register,
    authorize,
    verifyToken
}