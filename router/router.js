import express from 'express';

import restController from '../controllers/controller';

const router = express.Router();

//Get all plans
// router.get('/plan', restController.getAllController)
//get plan by id
router.get('/plan', restController.getByIdController)

//post plan
router.post('/plan', restController.postController )

//make changes to the plan
router.put('/plan', restController.putController)

//delete plan by id
router.delete('/plan/:id', restController.deleteController)

module.exports = router;