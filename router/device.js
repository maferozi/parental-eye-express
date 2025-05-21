const deviceRouter = require('express').Router();
const { createDevice, getAllDevices, getDeviceById, updateDevice, deleteDevice, assignDeviceToParent, assignDeviceToChild, getUnassignedChildren, unassignDeviceFromParent, unassignDeviceFromChild, getActiveDevices, setLocationMonitoringTime, getLocationMonitoringTime } = require('../controller/device');
const { authenticate } = require('../middlewares/authenticate');

deviceRouter.post("/", authenticate,createDevice);
deviceRouter.get("/", authenticate, getAllDevices);
deviceRouter.get("/unassigned-child", authenticate, getUnassignedChildren);
deviceRouter.get("/active-devices", authenticate, getActiveDevices);
deviceRouter.delete("/:id", authenticate, deleteDevice);
deviceRouter.post("/update-status", authenticate, assignDeviceToParent);
deviceRouter.post("/assign-child", authenticate, assignDeviceToChild);
deviceRouter.put("/set-time", authenticate, setLocationMonitoringTime);
deviceRouter.put("/unassign-parent/:id", authenticate, unassignDeviceFromParent);
deviceRouter.put("/unassign-child/:id", authenticate, unassignDeviceFromChild);
deviceRouter.get("/get-time", authenticate, getLocationMonitoringTime);
deviceRouter.put("/:id", authenticate, updateDevice);
deviceRouter.get("/:id", authenticate, getDeviceById);


module.exports = deviceRouter;