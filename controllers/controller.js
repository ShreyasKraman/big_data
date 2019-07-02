import services from '../services/services';
import { verify } from 'crypto';

const registerController = async (req, res) => {
    const client_type = req.query.client_type;
    const redirect_url = req.query.redirect_url;
    
    if(!client_type || !redirect_url)
        return res.status(403).send({error:"Client type and redirect url are required"});

    const result = await services.register(client_type,redirect_url);

    return res.status(result.status).send(result.body);
    
};

const authorizeController = async (req,res) => {

    const response_type = req.query.response_type;
    const client_id = req.query.client_id;
    const redirect_uri = req.query.redirect_url;
    const scope = req.query.scope;
    const state = req.query.state;

    const body = {
        response_type,
        client_id,
        redirect_uri,
        scope,
        state
    }

    let result = await services.authorize(body);
    return res.status(result.status).send(result.body);

};

const tokenController = async (req,res) => {

};

const getAllController = async (req,res) => {

};

const getByIdController = async (req,res) => {

    //Check for token
    const bearerHeader = req.headers['Authorization'];
    console.log(bearerHeader);

    if(typeof bearerHeader === 'undefined')
        res.status(403).send({error:true,message:'Unauthorized'});
    
    const bearer = bearerHeader.split(' ');
    const token = bearer[1];
    req.token = token;


    //Verify token
    let tokenResult = await services.verifyToken(req.token);

    if(tokenResult.error)
        res.status(tokenResult.status).send(tokenResult.body);

    const id = req.query.id;

    if(id){

        let result = "";

        let etag = "";

        if(req.get('IF-MATCH')){

            etag = req.get('IF-MATCH');
            result = await services.ifMatch(etag);

        }

        if(req.get('IF-NONE-MATCH')){

            etag = req.get('IF-NONE-MATCH');

            result = await services.ifNoneMatch(etag,id);
    
        }

        // const result = await services.getById(id);

        if(result.error){
           res.status(result.status);
        }

        if(result.success){
            res.status(result.status);
        }

        if(!result){
            res.status(401).send({error:true,body:'IF-MATCH, IF-NONE-MATCH header mandatory'});
        }

        return res.send(result);
    }

    return res.status(401).send({error:true,message:"Id is required to get values"});

};

const postController = async (req,res) => {

    const jsonBody = req.body;
    const result = await services.createPlan(jsonBody);

    if(result.error){
        res.status(result.status);
    }

    if(result.success){
        res.status(result.status);
    }   

    return res.send(result);
};

const putController = async (req,res) => {
    const jsonBody = req.body;
    const id = req.query.id;

    const result = await services.updatePlan(id,jsonBody);

    if(result.error){
        res.status(result.status);
    }

    if(result.success){
        res.status(result.status);
    }   

    return res.send(result);

};

const patchController = async (req,res) => {
    const jsonBody = req.body;
    const id = req.query.id;

    const result = await services.patchPlan(id,jsonBody);

    if(result.error){
        res.status(result.status);
    }

    if(result.success){
        res.status(result.status);
    }   

    return res.send(result);

};

const deleteController = async (req,res) => {
    const id = req.query.id;

    const result = await services.deletePlan(id);

    if(result.error)
        res.status(result.status);

    if(result.success)
        res.status(result.status);

    res.send(result);
};

module.exports = {
    registerController,
    tokenController,
    authorizeController,
    getAllController,
    getByIdController,
    postController,
    putController,
    patchController,
    deleteController,
};
