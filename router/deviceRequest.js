const deviceRequestRouter = require('express').Router();
const { getAllRequests, deleteRequest, createRequest, updateRequestStatus } = require('../controller/requestDevice');
const { authenticate } = require('../middlewares/authenticate');


deviceRequestRouter.get("/", authenticate, getAllRequests);
deviceRequestRouter.post("/", authenticate, createRequest);
deviceRequestRouter.patch("/", authenticate, updateRequestStatus);
deviceRequestRouter.delete("/:id", authenticate, deleteRequest);


module.exports = deviceRequestRouter;