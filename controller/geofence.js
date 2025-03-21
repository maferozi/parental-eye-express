const { Sequelize, INTEGER, Op } = require("sequelize");
const { Geofence, GeofenceDevice, Device, User } = require("../models");

// ✅ Get all geofences (Only those with linked devices)
const getAllGeofences = async (req, res) => {
  try {
    let { pageNo = 1, limit = 5, search = "" } = req.query;

    // Convert to integers
    pageNo = parseInt(pageNo, 10);
    limit = parseInt(limit, 10);

    const offset = (pageNo - 1) * limit;

    const whereClause = search
      ? {
          name: { [Op.iLike]: `%${search}%` }, // Case-insensitive search
          created_by:req.user.id,
        }
      : {created_by:req.user.id};

    const { rows: geofences, count } = await Geofence.findAndCountAll({
      where: whereClause,
      include: [
        {
          model: Device,
          as: "devices",
          through: { attributes: [] }, // Exclude join table attributes
        },
        {
          model: User,
          as: "creator",
          attributes: ["id", "firstName", "email"],
        },
      ],
      limit,
      offset,
      order: [["created_at", "DESC"]],
    });

    res.status(200).json({
      message: "Geofence data fetched successfully",
      data: geofences,
      pageNo,
      limit,
      count: count,
    });
  } catch (error) {
    console.error("Error fetching geofences:", error);
    res.status(500).json({ error: "Failed to retrieve geofences" });
  }
};


const createGeofence = async (req, res) => {
  try {
    const { name, type, coordinates, center, radius, status } = req.body;

    if (!name || !type) {
      return res.status(400).json({ error: "Name and type are required." });
    }

    const created_by = req.user.id;
    let areaGeom = null;
    let pathGeom = null;
    let centerGeom = null;

    // ✅ **Handle Route (Polyline)**
    if (type === "route") {
      if (!Array.isArray(coordinates) || coordinates.length < 2) {
        return res.status(400).json({ error: "Route requires at least two coordinates." });
      }

      pathGeom = Sequelize.fn(
        "ST_GeomFromGeoJSON",
        JSON.stringify({
          type: "LineString",
          coordinates: coordinates.map(coord => [coord[0], coord[1]]) // Keep in [lng, lat] format
        })
      );
    }

    // ✅ **Handle Area (Polygon)**
    else if (type === "area") {
      if (!Array.isArray(coordinates) || coordinates.length < 1 || coordinates[0].length < 3) {
        return res.status(400).json({ error: "Polygon requires at least three coordinates." });
      }

      let polygonCoordinates = coordinates[0].map(coord => [coord[0], coord[1]]);

      // ✅ Ensure Polygon is Closed
      if (
        polygonCoordinates[0][0] !== polygonCoordinates[polygonCoordinates.length - 1][0] ||
        polygonCoordinates[0][1] !== polygonCoordinates[polygonCoordinates.length - 1][1]
      ) {
        polygonCoordinates.push(polygonCoordinates[0]); // Close the polygon
      }

      areaGeom = Sequelize.fn(
        "ST_GeomFromGeoJSON",
        JSON.stringify({
          type: "Polygon",
          coordinates: [polygonCoordinates]
        })
      );
    }

    // ✅ **Handle Circle (Point with Radius)**
    else if (type === "circle") {
      if (!center || !Array.isArray(center) || center.length !== 2 || !radius) {
        return res.status(400).json({ error: "Circle geofence requires center (lng, lat) and radius." });
      }

      centerGeom = Sequelize.fn(
        "ST_GeomFromGeoJSON",
        JSON.stringify({
          type: "Point",
          coordinates: [center[0], center[1]] // Keep [lng, lat]
        })
      );
    }

    // ✅ **Create the Geofence in Database**
    const newGeofence = await Geofence.create({
      name,
      type,
      area: areaGeom,
      path: pathGeom,
      center: centerGeom,
      radius: type === "circle" ? radius : null,
      status,
      created_by,
    });

    res.status(201).json({ message: "Geofence created successfully", geofence: newGeofence });
  } catch (error) {
    console.error("Error creating geofence:", error);
    res.status(500).json({ error: "Failed to create geofence" });
  }
};


const deleteGeofence = async (req, res) => {
  try {
    const { id } = req.params; // Corrected req.param to req.params

    if (!id) {
      return res.status(400).json({ message: "Geofence ID is required" });
    }

    // Find the geofence by ID
    const geofence = await Geofence.findByPk(id);

    if (!geofence) {
      return res.status(404).json({ message: "Geofence not found" });
    }

    // Delete the geofence
    await geofence.destroy();

    res.status(200).json({ message: "Geofence deleted successfully" });
  } catch (error) {
    console.error("Error deleting geofence:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};



const assignGeofenceToDevice = async (req, res) => {
  try {
    const { geofenceId, deviceId } = req.body;

    // Check if the provided geofence exists
    const geofence = await Geofence.findByPk(geofenceId);
    if (!geofence) {
      return res.status(404).json({ message: "Geofence not found" });
    }

    // Check if the provided device exists
    const device = await Device.findByPk(deviceId);
    if (!device) {
      return res.status(404).json({ message: "Device not found" });
    }

    // Check if the device is already assigned to the geofence
    const existingAssignment = await GeofenceDevice.findOne({
      where: { geofence_id: geofenceId, device_id: deviceId },
    });

    if (existingAssignment) {
      return res.status(400).json({ message: "Device already assigned to this geofence" });
    }

    // Assign the geofence to the device
    await GeofenceDevice.create({
      geofence_id: geofenceId,
      device_id: deviceId,
    });

    return res.status(201).json({ message: "Geofence assigned to device successfully" });
  } catch (error) {
    console.error("Error assigning geofence to device:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};


const getGeofenceDevices = async (req, res) => {
  try {
    const geofenceDevices = await Geofence.findAll({
      where: {created_by: req.user.id},
      include: [
        {
          model: Device,
          as: "devices",
          through: { attributes: [] }, // Exclude join table attributes
          required: true,
        }
      ],
      order: [["created_at", "DESC"]],
    });

    res.status(200).json({
      message: "Geofence devices fetched successfully",
      data: geofenceDevices,
    });
  } catch (error) {
    console.error("Error fetching geofence devices:", error);
    res.status(500).json({ error: "Failed to retrieve geofence devices" });
  }
};

const unassignGeofenceDevice = async (req, res) => {
  try {
    const { geofenceId, deviceId } = req.body;

    if (!geofenceId || !deviceId) {
      return res.status(400).json({ error: "Geofence ID and Device ID are required." });
    }

    // Find and delete the record from GeofenceDevice table
    const deletedRecord = await GeofenceDevice.destroy({
      where: { geofence_id: geofenceId, device_id: deviceId }
    });

    if (!deletedRecord) {
      return res.status(404).json({ error: "Device is not assigned to the selected geofence." });
    }

    return res.status(200).json({
      message: "Device unassigned from geofence successfully.",
    });
  } catch (error) {
    console.error("Error unassigning device from geofence:", error);
    return res.status(500).json({ error: "Failed to unassign device from geofence." });
  }
};


module.exports = { getAllGeofences, createGeofence, deleteGeofence, assignGeofenceToDevice, getGeofenceDevices, unassignGeofenceDevice };
