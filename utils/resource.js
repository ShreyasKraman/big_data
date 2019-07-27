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
            subkey = superkey +"__"+ data["objectType"] + "__" + data['objectId'] + "-" + key;
        else
            subkey = data["objectType"] + "__" + data['objectId'] + "-" + key;
        
        const parameters = [];
        let keyCount = 0;
        for(let key1 in data){

            //For nested objects
            if(typeof(data[key1]) == 'object'){

                //storing edge reference
                keyCount++;
                const edge = await setParameters("",key1,data[key1]);
                parameters.push(key1);
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

const updateContents = async(keys,contents, newContents) =>{

    let res = {};
    const edgeList = [];
    let isModified = false;
    const client = getRedisClient();
    for(let key in newContents){

        if(typeof newContents[key] === 'object'){

            const search_key = newContents[key]["objectType"] + "__" + newContents[key]['objectId'] + "-" + key;

            console.log("Inside body",search_key);
            

            if(contents[key] === search_key){

                const getAsync = promisify(client.hgetall).bind(client);

                const response = getAsync(search_key);

                if(response){
                    const result = await compareAndUpdate(response,newContents[key]);

                    if(result.isModified){
                        const body = result.body;
                        client.hmset(search_key,body, (err,res)=>{
                            if(err)
                                error("Unable to update",401);
                        });

                    }
                    continue;
                }
            }else{
                const edge = await setParameters("",key,newContents[key]);
                contents[key] = edge;
                isModified = true;
                continue;
            }

        }

        if(newContents[key] !== contents[key]){
            contents[key] = newContents[key];
            isModified = true;
        }
    }

    if(isModified){
        const super_key = contents["objectType"] + "__" + contents['objectId'] + "-" + keys;
        client.hmset(super_key,contents, (err,res) => {
            if(err)
                return error("Error while modifying",401);
        });

        return success("Value modified",200);
    }

    return success("No value modified",200);
}

const compareAndUpdate = async(items1,items2) => {
    let isModified = false;
    for(let keys in items2){

        if(typeof items2[keys] === 'object' ){
            
        }

        if(items2[keys] !== items1[keys]){
            items1[keys] = items2[keys];
            isModified = true;
        }

    }
     
    return {
        body:items1,
        isModified
    }
}

const patchAll = async(body,superkey,id) => {

    let res = {};

    //Retrive match key from the body
    for(let key in body){
        //Handlevalues of type Array
        if(Array.isArray(body[key])){
            await Promise.all(body[key].map( async (contents) => {



                const result = await patchAll(contents,key,id);

                if(result.statusCode === 201){
                    let arrayKey = result.body;
                    console.log(arrayKey);
                }
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

        //parent data contents
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

        let newData = false;
        if(data.length === 0){
            newData = true;
        }

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
            if(newData)
                res = success(search_key,201);
            else
                res = success("Data Modified",200);
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
    updateContents,
    patchAll,
    deletePlanETAG
}