import express from 'express';

import restController from '../controllers/controller';

const router = express.Router();

//Get all plans
// router.get('/plan', restController.getAllController)

//Register
router.get('/register', restController.registerController)

//Authorize
router.get('/auth', restController.authorizeController)

//Token
router.get('/token',restController.tokenController)

//get plan by id
router.get('/plan',  restController.getByIdController)

//post plan
router.post('/plan', restController.postController )

//make changes to the plan
router.put('/plan', restController.putController)

//make changes to the plan
router.patch('/plan', restController.patchController)

//delete plan by id
router.delete('/plan', restController.deleteController)

module.exports = router;