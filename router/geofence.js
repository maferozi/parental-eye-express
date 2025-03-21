const express = require("express");
const { getAllGeofences, createGeofence, deleteGeofence, assignGeofenceToDevice, getGeofenceDevices, unassignGeofenceDevice } = require("../controller/geofence");
const { authenticate } = require("../middlewares/authenticate");
const geofenceRouter = express.Router();


// Get all geofences
geofenceRouter.get("/", authenticate, getAllGeofences);
geofenceRouter.get("/get-assigned-devices", authenticate, getGeofenceDevices);


// Create a geofence
geofenceRouter.post("/", authenticate, createGeofence);
geofenceRouter.post("/assign", authenticate, assignGeofenceToDevice);
geofenceRouter.post("/unassign", authenticate, unassignGeofenceDevice);

geofenceRouter.delete("/:id", authenticate, deleteGeofence);



module.exports = geofenceRouter;
