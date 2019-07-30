import { validateJson } from '../utils/validation';
import { success, error } from '../utils/response';
import { getRedisClient } from '../dbstore/redis';
import resources from '../utils/resource';
import {promisify} from 'util';
import {secret_key,client_id, refresh_secret_key} from '../utils/keys';

import {Client} from '@elastic/elasticsearch'

import jwt from 'jsonwebtoken';

import uuid from 'uuid/v4';


const elasticClient = new Client({node: 'http://localhost:9200'});

//root of the document. Hard coded, in case ;)
let root = "plan__12xvxc345ssdsds-508";

//register client id
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

//Authorize token and return redirect url with refresh token
const authorize = async (body) => {
    if(body){
        const client_id = body["client_id"];
        let token = await jwt.sign({client_id},secret_key,{expiresIn:'300000'}); //5 mins expiry

        const refresh_token = await jwt.sign({client_id},refresh_secret_key);
        const redirect_url = body.redirect_uri + "?" + body.response_type + "=" + token + "&state="+body.state;
        return success({redirect_url,refresh_token},302);
    }

    return error("Not authorized",403);

}

//verify token with signature
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

//Upon token expiry, generate access token and new refresh token
const generateToken = async (refresh_token,client_id) => {
    if(refresh_token){

        try{
            await jwt.verify(refresh_token,refresh_secret_key);
        }catch(err){
            return error(err,401);
        }

        let access_token = await jwt.sign({client_id},secret_key,{expiresIn:'300000'});

        const new_refresh_token = await jwt.sign({client_id},refresh_secret_key);

        return success({access_token,new_refresh_token},302);
    }

    return error("No Token",403);
}

const getAll = async() => {

};

//Service to get data by id
const getById = async (id) => {

    const client = await getRedisClient();

    if(client){


        let getAsync = promisify(client.hgetall).bind(client);

        const res = await getAsync(id);

        if(res){
            return success(res, 200);
        }

        return error("No corresponding values found", 204);

    }

    return error("Client not working", 401);

};

//ETAG - IF NONE Match Found
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
    if(json_id !== 'undefined'){
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
    return error("No content",204);

}


//ETAG _ IF Match found
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


//Create method (POST) plan
const createPlan = async (body) => {

    const jsonBody = body;

    //validate user body according to schema
    const response = validateJson(jsonBody);
    
    if(response.error){
        return error(response.message, 401);
    }

    const client = await getRedisClient();
    
    if(client){
        
        if(typeof(jsonBody) == "object"){

            //object id is mandatory
            const valid = await resources.checkObject(jsonBody);
            if(valid.error)
                return error(valid.body,valid.status);

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

            const updatedBody = {};
            for(let i=0;i<parameters.length;i+=2){
                updatedBody[parameters[i]] = parameters[i+1]; 
            }

            const index = "Plan-"+super_key;
            await elasticClient.index({
                index: index.toLowerCase(),
                id:super_key,
                body:updatedBody,
            });

            //set parent id
            client.hmset(super_key,parameters, (err, res) => {
                if(err){
                    console.log("Super Key",err);
                }
            });

            const unique_key = uuid();

            client.set(unique_key,super_key);

            root = super_key;

            return success("Your unique key : "+ unique_key, 201);
        }
    }

    return error("Server error. Please try again after some time", 401)

};

const updatePlan = async(id,jsonBody) => {

    if(id){
        if(jsonBody){

            const client = await getRedisClient();
        
                if(typeof(jsonBody) == "object"){

                    //object id is mandatory
                    const valid = await resources.checkObject(jsonBody);
                    if(valid.error)
                        return error(valid.body,valid.status);
        
                    let super_key = jsonBody["objectType"] + "__" + jsonBody['objectId'];

                    const superResponse = await getById(super_key);

                    if(superResponse.success && superResponse.status === 204){
                        return error("unvailable",302);
                    }
    
                    if(superResponse.error){
                        return error("Server timeout. Try after some time",401);
                    }
    
                    const mainBody = superResponse.body;

                    let isModified = false;
                    let isModified1 = false;

                    for(let key in jsonBody){

                        //Handle value of type array
                        if(Array.isArray(jsonBody[key])){

                            await Promise.all(jsonBody[key].map( async (contents) => {

                                const key_to_search = contents["objectType"] + "__" + contents['objectId'] + "-" + key;

                                console.log("Key to search",key_to_search);

                                let response = await getById(key_to_search);

                                if(response.status === 204){
                                    const edge = await resources.setParameters("",key,contents);

                                    const list_key = mainBody[key];
                                    //push node to list
                                    const result = await client.rpush(list_key, edge);
                                    console.log("Node push",result);

                                    isModified1 = true;
                                    
                                }else if(response.status === 200){

                                    const result = await resources.updateContents(key,response.body,contents);
                                    if(result.success){
                                        isModified1 = true;
                                    }else{
                                        return result;
                                    }
                                }

                            }));
        
                            continue;
        
                        //Handle value of type object  
                        } else if(typeof(jsonBody[key]) === 'object'){
                            
                            const search_key = jsonBody[key]["objectType"] + "__" + jsonBody[key]['objectId'] + "-" + key;

                            const response = await getById(search_key);

                            if(response.success){
                                const body = response.body;
                                for(let keys in jsonBody[key]){
                                    if(jsonBody[key][keys] !== body[keys]){
                                        body[keys] = jsonBody[key][keys];
                                    }
                                }

                                const index = "Plan-"+search_key;
                                await elasticClient.index({
                                    index:index.toLowerCase(),
                                    id:search_key,
                                    body:body,
                                });

                                client.hmset(search_key,body, (err,res)=>{
                                    if(err)
                                        error("Failed to update",401);
                                });

                                isModified1 = true;

                                continue;
                            }else{
                                let edge = await resources.setParameters("", key, jsonBody[key]);
                                mainBody[key] = edge;
                                isModified = true;
                            }   
                        }
                        
                        if(mainBody[key] !== jsonBody[key]){
                            mainBody[key] = jsonBody[key];
                            isModified1 = true;
                        }

                    }

                    if(isModified){
                        
                        const index = super_key;
                        await elasticClient.index({
                            index:index.toLowerCase(),
                            id:super_key,
                            body:mainBody,
                        });

                        client.hmset(super_key,mainBody, (err,res)=>{
                            if(err)
                                error("Error while modifying",401);
                        });
                    }

                    if(isModified || isModified1){
                        await resources.deletePlanETAG(id);
                        return success("Value updated Successfully",200);
                    }

            }
          
            return success("No changes",204);

        }else{
            return error("Body is required");
        }
    }else
        return error("Id is required");
    
};

const patchPlan = async(id,jsonBody) => {

    if(jsonBody && id){

        const client = getRedisClient();

        const getAsync = promisify(client.get).bind(client);

        const super_key = await getAsync(id);

        if(super_key){

            const response = await getById(super_key);

            const mainBody = response.body;

            let isModified = false;
            let isModified1 = false;

            for(let key in jsonBody){

                //Handle value of type array
                if(Array.isArray(jsonBody[key])){

                    await Promise.all(jsonBody[key].map( async (contents) => {

                        const key_to_search = contents["objectType"] + "__" + contents['objectId'] + "-" + key;

                        console.log("Key to search",key_to_search);

                        let response = await getById(key_to_search);

                        if(response.status === 204){
                            const edge = await resources.setParameters("",key,contents);

                            const list_key = mainBody[key];
                            //push node to list
                            const result = await client.rpush(list_key, edge);
                            console.log("Node push",result);

                            isModified1 = true;
                            
                        }else if(response.status === 200){

                            const result = await resources.updateContents(key,response.body,contents);
                            if(result.success){
                                isModified1 = true;
                            }else{
                                return result;
                            }
                        }

                    }));

                    continue;

                //Handle value of type object  
                } else if(typeof(jsonBody[key]) === 'object'){
                    
                    const search_key = jsonBody[key]["objectType"] + "__" + jsonBody[key]['objectId'] + "-" + key;

                    const response = await getById(search_key);

                    if(response.success){
                        const body = response.body;
                        for(let keys in jsonBody[key]){

                            if(jsonBody[key][keys] !== body[keys]){
                                body[keys] = jsonBody[key][keys];
                            }
                        }

                        const updatedBody = {};
                        for(let i=0;i<body.length;i+=2){
                            updatedBody[body[i]] = body[i+1]; 
                        }
                        const index = "Plan-"+search_key;
                        await elasticClient.index({
                            index:index.toLowerCase(),
                            id:search_key,
                            body:updatedBody,
                        });

                        client.hmset(search_key,body, (err,res)=>{
                            if(err)
                                error("Failed to update",401);
                        });

                        isModified1 = true;

                        continue;
                    }else{
                        let edge = await resources.setParameters("", key, jsonBody[key]);
                        mainBody[key] = edge;
                        isModified = true;
                    }
                    
                }
                
                if(mainBody[key] !== jsonBody[key]){
                    mainBody[key] = jsonBody[key];
                    isModified = true;
                }

            }

            if(isModified){
                const updatedBody = {};
                for(let i=0;i<mainBody.length;i+=2){
                    updatedBody[body[i]] = mainBody[i+1]; 
                }
                const index = "Plan-"+super_key;
                await elasticClient.index({
                    index:index.toLowerCase(),
                    id:super_key,
                    body:updatedBody,
                });

                client.hmset(super_key,mainBody, (err,res)=>{
                    if(err)
                        error("Error while modifying",401);
                });
            }

            if(isModified || isModified1){
                await resources.deletePlanETAG(id);
                return success("Value updated Successfully",200);
            }


        }
    }

    return error("No body",401);

};

const deletePlan = async(id) => {
    if (id){
        if(!root){
            return error("No data exists",401);
        }

        if(id === root){
            await resources.deleteObject(id);

            return success("Object deleted",200);
        }

        const client = await getRedisClient();

        const response = await getById(root);

        if(response.error)
            return error("No values in redis",401);
        
        const jsonBody = response.body;

        for(let key in jsonBody){
            const split = jsonBody[key].split('-');
            //add key values to res if no object or array found
            if(split[split.length - 1] !== key){
                continue;
            }
    
            try{
                
                //child node
                const response = await getById(jsonBody[key]);

                if(id === jsonBody[key]){

                    //delete contents of child node
                    await resources.deleteObject(id);
                    
                    return success("Values deleted",200);

                }
    
            }catch(e){
                if(e.code === 'WRONGTYPE'){
                    const getAsync = promisify(client.lrange).bind(client);
    
                    const items = await getAsync(jsonBody[key],0,-1);
    
                    let res = await Promise.all(items.map( async (element) => {
                        
                        const node = element;
                        console.log(id,node);
                        if(id === node){
                            console.log("Match found");
                            //delete contents of child node
                            await resources.deleteObject(id);

                            await client.LREM(jsonBody[key], 0, id, (err,res)=>{
                                if(err)
                                    console.log("Array Key delete error",err);
                            });

                            return Promise.resolve(success("Values deleted",200));

                        }else{
                            const getAsync = promisify(client.hgetall).bind(client);
                            const response = await getAsync(node);

                            if(response){
                                const body = response;
                                for(let elementKey in body){
                                    const split = body[elementKey].split('-');
                                    //add key values to res if no object or array found
                                    if(split[split.length - 1] !== elementKey){
                                        continue;
                                    }

                                    if(id === body[elementKey]){
                                        await resources.deleteObject(body[elementKey]);

                                        client.HDEL(id,elementKey,(err,res)=>{
                                            if(err)
                                                console.log("Error while deleting");
                                        });

                                        return Promise.resolve( success("Values deleted",200));
                                    }

                                }
                            }
                        }

                        return Promise.resolve(Success("No value deleted"),200);

                    }));

                    if(res.error || res.success)
                        return res;

                    continue;
    
                }else{
                    return error("Error while parsing",401);
                }
            }
        }
        
        return success("No value Deleted",200);

    }

    return error("Id must be provided",401);
}


//Build JSON response
const buildResponse = async(jsonBody) => {

    const res = {};
    const jsonArray = [];
    let arrayKey = '';

    const client = getRedisClient();

    console.log("JsonBody",jsonBody);

    if(!jsonBody)
        return "";
    //if body is empty skip that element
    if(jsonBody === 'undefined' || Object.entries(jsonBody).length === 0)
        return "";

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
    verifyToken,
    generateToken,
}