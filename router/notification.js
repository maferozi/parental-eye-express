const { getUnreadNotificationsPaginated } = require('../controller/notification');
const { authenticate } = require('../middlewares/authenticate');

const notificationRouter = require('express').Router();

notificationRouter.get("/unread", authenticate,getUnreadNotificationsPaginated);

module.exports = notificationRouter;