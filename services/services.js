import { validateJson } from '../utils/validation';
import { success, error } from '../utils/response';
import { getRedisClient } from '../dbstore/redis';
import {promisify} from 'util';
import uuid from 'uuid/v4';


const getAll = async() => {

};

const getById = async(id) => {

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
    let res = await compare(etag,etagId);

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

            let super_key = jsonBody["objectId"] + "_" + jsonBody["objectType"];
            let parameters = [];
            let keyCount = 0;
            
            for(let key in jsonBody){

                //Handle value of type array
                if(Array.isArray(jsonBody[key])){
                    await Promise.all(jsonBody[key].map( async (contents) => {
                        const edge = await setParameters("",key,contents);
                        if(edge){
                            parameters.push("Array"+keyCount++);
                            parameters.push(edge);
                            return parameters;
                        }else
                            console.log("no Edge"); 
                    }));

                    continue;

                //Handle value of type object  
                } else if(typeof(jsonBody[key]) === 'object'){

                    //storing edge reference
                    const edge = await setParameters(super_key,key,jsonBody[key]);
                    parameters.push("Key"+keyCount++);
                    parameters.push(edge);
                    continue;
                }

                //parent data contents
                parameters.push(key);
                parameters.push(jsonBody[key]);
            }

            console.log(parameters);

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

const updatePlan = async(id,body) => {

    if(id){
        if(body){

            await setParameters("",body);

            await deletePlanETAG(id);            

            return("Value updated successfully");

        }else{
            return error("Body is required");
        }
    }
    return error("Id is required");

};

const patchPlan = async(id,body) => {

    if(body && id){
        console.log("Id",id);
        const res = await patchAll(body, '',id);
        if(res.success)
            await deletePlanETAG(id);

        return res;

    }

    return error("No body",401);

};

const patchAll = async(body,superkey,id) => {

    let search_key = '';
    let res = {};

    //Retrive match key from the body
    for(let key in body){

        if(typeof body[key] === 'object'){
            res = await patchAll(body[key],key,id);
            if(res.error){
                return res;
            }
            continue;
        }

        if(key == 'objectId' || key == 'objectType')
            search_key = body['objectId'] +"_"+ body['objectType'] + "-" + superkey; 
    }

    //Get object from redis
    if(search_key.length !== 0){
        
        const client = await getRedisClient();
        let getAsync = promisify(client.get).bind(client);
        let root = await getAsync(id);

        let res = await retrieveKey(root,search_key);

        if(res.length === 0)
            return error("No data found for patch request",401);

        getAsync = promisify(client.hgetall).bind(client);

        const data = await getAsync(res);

        if(data.length === 0)
            res = error("No data found for corresponding patch request",401);

        let flag = false;

        //modify data in object
        for(let key in body){

            if(!(key in data)){
                data[key] = body[key]
                flag = true;
            }

            if(body[key] !== data[key]){
                data[key] == body[key];
                flag = true;
            }

        }


        if(!flag)
            res = success("No data modified",304);
        else{
            let parameters = [];
            for(let key in data){

                if(key === 'objectId' || key === 'objectType')
                    continue;

                parameters.push(key);
                parameters.push(data[key]);

            }

            await client.hmset(search_key,parameters, (err,res)=> {

            })
            res = success("Data modified",200);

        }
        
    }

    return res;

}

const retrieveKey = async (id,matchKey) => {
    let res = '';
    if(id.length !== 0 && matchKey.length !== 0){
        const client = getRedisClient();
        const getAsync = promisify(client.hgetall).bind(client);
        const data = await getAsync(id);
        console.log(id,matchKey);
        for(let key in data){
            if(key.includes("Key") || key.includes("Array")){
                if(data[key] === matchKey){
                    return data[key];
                }
                else
                    res = retrieveKey(data[key],matchKey);
            }
        }
    }

    return res;

}



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

            await deletePlanETAG(id);

            return success("Values Deleted",200);

        }

        return error("Error",404);

    }

    return error("Id must be provided",401);
}

const buildResponse = async(jsonBody) => {

    const res = {};
    const jsonArray = [];
    let arrayKey = '';
    for(let key in jsonBody){

        if(key.includes('Key') || key.includes('Array')){
        
            const response = await getById(jsonBody[key]);
            if(response.success){
                const body = response.body;

                //key of response
                const splitArray = jsonBody[key].split('-');
                const len = splitArray.length;

                //body of response
                const result = await buildResponse(body);

                //for json object
                if(key.includes("Key")){
                    
                    res[splitArray[len - 1]] = result;
                }

                //for array of objects
                if(key.includes("Array")){
                    arrayKey = splitArray[ len - 1];
                    jsonArray.push(result);
                }
                continue;
            }
        }
        // console.log(key,jsonBody[key]);
        res[key] = jsonBody[key];
    }
    if(jsonArray.length > 0)
        res[arrayKey] = jsonArray;

    return res;
}

const setParameters = async (superkey, key, data) => {
    if(typeof data === 'object'){
        let subkey = "";
        if(superkey)
            subkey = superkey +"_"+ data['objectId'] +"_"+ data['objectType'] + "-" + key;
        else
            subkey = data['objectId'] +"_"+ data['objectType'] + "-" + key;
        
        const parameters = [];
        let keyCount = 0;
        for(let key1 in data){

            //For nested objects
            if(typeof(data[key1]) == 'object'){

                //storing edge reference
                keyCount++;
                const edge = await setParameters("",key1,data[key1]);
                parameters.push("Key"+keyCount);
                parameters.push(edge);
                continue;
            }

            parameters.push(key1);
            parameters.push(data[key1]);
        }

        const client = await getRedisClient();
        // console.log("Parameters",parameters);
        await client.hmset(subkey,parameters, (err,res) => {
            if(err){
                console.log("Child Key ",err);
            }
        });

        return subkey;

    }
}

const deletePlanETAG = async(id) => {

    if(id){
        const client = await getRedisClient();

        let res = await getById(id);

        if(res.success){

            //GET Corresponding etag
            let getAsync = promisify(client.get).bind(client);
            const etagid = await getAsync(id+"_ETAG");

            console.log(etagid);

            if(etagid){

                //delete etag reference
                client.del(id+"_ETAG");

                getAsync = promisify(client.hgetall).bind(client);
                res = await getAsync(etagid);
                
                console.log("Etagid",res);
                const parameters = [];
                for(let values in res){
                    //delete corresponding values of etag
                    parameters.push(values);
                    parameters.push(res[values]);
                }
                client.HDEL(etagid,parameters);
            }

            return success("Values deleted",200);

        }

        return error("Error",401);

    }

    return error("Id must be provided",401);

};

const compare = (id, etag) => {

    return id === etag;

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
}