import { validateJson } from '../utils/validation';
import { success, error } from '../utils/response';
import { getRedisClient } from '../dbstore/redis';
import {pormisify, promisify} from 'util';

const getAll = async() => {

};

const getById = async(id) => {

    const client = await getRedisClient();

    if(client){

        const getAsync = promisify(client.hgetall).bind(client);

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
        return getById(id);
    }

    //3. b. For subsequent request, store etag with id's value
    res = await getById(id);

    console.log(res);

    if(res.status === 200){
        const parameters = [];
        const body = res.body;
        for (let values in body){
            parameters.push(values);
            parameters.push(body[values]);
        }

        console.log("etag params",parameters);
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
            for(let value in jsonBody){

                //Handle value of type array
                if(Array.isArray(jsonBody[value])){
                    jsonBody[value].forEach( async (contents) => {
                        await setParameters(super_key,contents);
                    });
                    continue;

                  //Handle value of type object  
                } else if(typeof(jsonBody[value]) === 'object'){
                    await setParameters(super_key,jsonBody[value]);
                    continue;
                }

                //parent data contents
                parameters.push(value);
                parameters.push(jsonBody[value]);
            }

            //set parent id
            client.hmset(super_key,parameters, (err, res) => {
                if(err){
                    console.log("Super Key",err);
                }
            });
        }

        return success("Working well!", 201);
    }

    return error("Redis client not working", 401)

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

const setParameters = async (superkey, data) => {
    if(typeof data === 'object'){
        let subkey = "";
        if(superkey)
            subkey = superkey +"_"+ data['objectId'] +"_"+ data['objectType'];
        else
            subkey = data['objectId'] +"_"+ data['objectType'];
        
        const parameters = [];
        for(let value in data){

            //For nested objects
            if(typeof(data[value]) == 'object'){
                await setParameters(subkey,data[value]);
                continue;
            }

            parameters.push(value);
            parameters.push(data[value]);
        }

        const client = await getRedisClient();
        console.log("Parameters",parameters);
        await client.hmset(subkey,parameters, (err,res) => {
            if(err){
                console.log("Child Key ",err);
            }
        });

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