import { getRedisClient } from '../dbstore/redis';
import {promisify} from 'util';
import { success, error } from './response';
import services from '../services/services';

//Compare two ids
const compare = (id, id2) => {

    return id === id2;

}




//Get Node data from given id
const retrieveNodeObject = async (id,matchKey) => {
    let res = {};
    if(id.length !== 0 && matchKey.length !== 0){

        const client = getRedisClient();
        const getAsync = promisify(client.hgetall).bind(client);
        const data = await getAsync(id);
        
        if(id === matchKey){
            return data;
        }else{
            for(let key in data){
                if(key.includes("Key") || key.includes("Array")){
                    res = retrieveNodeObject(data[key],matchKey);
                    if(res.length !== 0)
                        return res;
                }
            }
        }
    }

    return res;

}


//Store nodes and their data
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



//Recursive function for patch
const patchAll = async(body,superkey,id) => {

    let search_key = '';
    let res = {};

    //Retrive match key from the body
    for(let key in body){
        //Handlevalues of type Array
        if(Array.isArray(body[key])){
            await Promise.all(body[key].map( async (contents) => {
                const edge = await patchAll(contents,key,id);
                if(edge){
                    return res;
                }else
                    console.log("no Edge"); 
            }));

            continue;

        //Handle value of type object  
        }else if(typeof body[key] === 'object'){
            res = await patchAll(body[key],key,id);
            if(res.error){
                return res;
            }
            continue;
        }

        if(key == 'objectId' || key == 'objectType'){
            if(superkey.length !== 0)
                search_key = body['objectId'] +"_"+ body['objectType'] + "-" + superkey; 
            else
                search_key = body['objectId'] +"_"+ body['objectType']
        }
    }

    //Get object from redis
    if(search_key.length !== 0){
        
        const client = await getRedisClient();
        let getAsync = promisify(client.get).bind(client);
        let root = await getAsync(id);

        let data = await retrieveNodeObject(root,search_key);
        console.log("key",data);
        if(res.length === 0)
            return error("No data found for patch request",401);

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
                data[key] = body[key];
                flag = true;
            }

        }

        console.log(data);

        if(!flag)
            res = success("No data modified",304);
        else{
            let parameters = [];
            for(let key in data){

                parameters.push(key);
                parameters.push(data[key]);

            }

            console.log("Parameters",parameters);

            await client.hmset(search_key,parameters, (err,res)=> {

            })
            res = success("Data modified",200);
        }
        
    }

    return res;

}


//Delete etag
const deletePlanETAG = async(id) => {

    if(id){
        const client = await getRedisClient();
        
        let res = await client.get(id);
        
        if(res.length!== 0){
            //GET Corresponding etag
            let getAsync = promisify(client.get).bind(client);
            const etagid = await getAsync(id+"_ETAG");

            console.log(etagid);

            if(etagid){

                //delete etag reference
                client.del(id+"_ETAG");
                console.log("etag del success");
                // getAsync = promisify(client.hgetall).bind(client);
                // res = await getAsync(etagid);
                
                console.log("Etagid",res);
                // const parameters = [];
                // for(let values in res){
                //     //delete corresponding values of etag
                //     parameters.push(values);
                //     parameters.push(res[values]);
                // }
                // client.del(etagid,parameters);
                client.del(etagid);
            }

            return success("Values deleted",200);

        }

        return error("Error",401);

    }

    return error("Id must be provided",401);

};


module.exports = {
    compare,
    retrieveNodeObject,
    setParameters,
    patchAll,
    deletePlanETAG
}