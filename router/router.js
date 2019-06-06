const express = require('express');

const { restController } = require('./Controllers/Controller');

const router = express.Router();

//Get all plans
router.get('/plan', restController.getAllController)
//get plan by id
router.get('/plan/:Id', restController.getByIdController)

//post plan
router.post('/plan', restController.postController )

//make changes to the plan
router.put('/plan', restController.putController)

//delete plan by id
router.delete('/delete/:id', restController.deleteController)

module.exports = router;