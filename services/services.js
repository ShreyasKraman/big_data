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

        let getAsync = promisify(client.get).bind(client);

        const json_id = await getAsync(id.trim());

        console.log(id,json_id);

        if(json_id){

            getAsync = promisify(client.hgetall).bind(client);

            const res = await getAsync(json_id);

            if(res){
                return success(res, 200);
            }
        }

        return success("No corresponding values found", 204);

    }

    return error("Client not working", 401);

};

const ifNoneMatch = async (etag,id) => {

    const client = await getRedisClient()

    const getAsync = promisify(client.get).bind(client);

    //1. Check if Etag is associated with id sent
    const etagId = await getAsync(id+"_ETAG");
    let res = await compare(etag,etagId);

    //2. If yes send 304, asking user to accpet request from caching
    if(res){
        return success("ETag working well. Please use IF-MATCH",304);
    }

    //3. If etag is not associated, then associate the etag with this value.
    
    //3. a. For first request
    if(etag === '*'){
        res = getById(id);
        if(res.success){
            return await buildResponse(res.body);
        }
        return error("No data found",204);
    }

    //3. b. For subsequent request, store etag with id's value
    res = await getById(id);

    // console.log(res);

    if(res.status === 200){
        const parameters = [];
        const body = res.body;
        for (let values in body){
            parameters.push(values);
            parameters.push(body[values]);
        }

        // console.log("etag params",parameters);
        //set etag
        await client.set(id+"_ETAG",etag);
        //set values to etag
        await client.hmset(etag,parameters, (err,res) => {
            if(err){
                console.log("ETAG ERROR",err);
            }
        });

        return success(body,200);
    }

    //return error or no values found for the id
    return res;

}

const ifMatch = async (etag) => {

    if(etag){
        const client = await getRedisClient();

        const getAsync = promisify(client.hgetall).bind(client);

        const res = await getAsync(etag);

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
                        const edge = await setParameters(super_key,key,contents);
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

    for(key in jsonBody){

        if(key.includes("Key")){
            
        }

        if(key.includes("Array")){

        }

        res[key] = jsonBody[key];
    }

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
                const edge = await setParameters(subkey,key1,data[key1]);
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
    deletePlan,
    ifNoneMatch,
    ifMatch
}