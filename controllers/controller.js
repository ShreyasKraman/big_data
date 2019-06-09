import services from '../services/services';

const getAllController = async (req,res) => {

};

const getByIdController = async (req,res) => {

    const id = req.query.id;

    if(id){

        let result = "";

        const etag = req.get('IF-NONE-MATCH');

        if(req.get('IF-MATCH')){

            result = await services.ifMatch(etag);

        }

        if(req.get('IF-NONE-MATCH')){

            result = await services.ifNoneMatch(etag,id);
    
        }

        // const result = await services.getById(id);

        if(result.error){
           res.status(result.status);
        }

        if(result.success){
            res.status(result.status);
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

const deleteController = async (req,res) => {

};

export default {
    getAllController,
    getByIdController,
    postController,
    putController,
    deleteController,
};
