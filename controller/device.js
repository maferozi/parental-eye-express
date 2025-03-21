const { Op } = require("sequelize");
const { Device, User,  Location } = require("../models");
const { clientMap, unsubscribeDevice, subscribeDevice } = require("../config/connectMqtt");

const createDevice = async (req, res, next) => {
  try {
    const { name, password } = req.body;

    if (!name || !password ) {
      return next({ status: 400, message: "Device name and password are required" });
    }
    if(req.user.role != 1){
        return next({ status: 403, message: "You are not allowed to create a device" });
    }

    const newDevice = await Device.create({ deviceName: name, password });

    res.status(201).json({ message: "Device created successfully", device: newDevice });
  } catch (error) {
    next(error);
  }
};

const getAllDevices = async (req, res, next) => {
  try {
    const {
      search = '', 
      sortField = 'updatedAt',
      sortOrder = 'DESC',
      pageNo = 1,
      limit = 10
    } = req.query;

    const offset = (pageNo - 1) * limit;

    const searchFilter = {
      [Op.or]: [{ deviceName: { [Op.iLike]: `%${search}%` } }],
      ...(req.user.role !== 1 ? { [Op.and]: [{ parentId: req.user.id }] } : {}),
    };
    
    const { count, rows } = await Device.findAndCountAll({
      where: searchFilter,
      order: [[sortField, sortOrder]],
      limit: parseInt(limit, 10),
      offset: parseInt(offset, 10),
    });

    res.status(200).json({
      message: 'Fetched devices successfully.',
      data: rows,
      count,
      pageNo: parseInt(pageNo, 10),
      totalPages: Math.ceil(count / limit),
      limit: parseInt(limit, 10),
    });
  } catch (error) {
    console.error('Error fetching devices:', error);
    next(error);
  }
};

// ✅ Get a single device by ID
const getDeviceById = async (req, res, next) => {
  try {
    const { id } = req.params;

    const device = await Device.findByPk(id);

    if (!device) {
      return next({ status: 404, message: "Device not found" });
    }

    res.status(200).json(device);
  } catch (error) {
    next(error);
  }
};

// ✅ Update a device
const updateDevice = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { deviceName, password, userId, parentId } = req.body;

    const device = await Device.findByPk(id);
    if (!device) {
      return next({ status: 404, message: "Device not found" });
    }

    await device.update({ deviceName, password, userId, parentId });

    res.status(200).json({ message: "Device updated successfully", device });
  } catch (error) {
    next(error);
  }
};

// ✅ Delete a device
const deleteDevice = async (req, res, next) => {
  try {
    const { id } = req.params;

    const device = await Device.findByPk(id);
    if (!device) {
      return next({ status: 404, message: "Device not found" });
    }

    await device.destroy();

    res.status(200).json({ message: "Device deleted successfully" });
  } catch (error) {
    next(error);
  }
};

const assignDeviceToParent = async (req, res) => {
  try {
    const { parentId, deviceId } = req.body;

    if (!parentId || !deviceId) {
      return res.status(400).json({ message: "Parent ID and Device ID are required." });
    }

    const parent = await User.findByPk(parentId);
    console.log(parent);
    if (!parent || parent.role !== 2) { // Ensure the user is a parent
      return res.status(404).json({ message: "Parent not found or invalid role." });
    }

    const device = await Device.findByPk(deviceId);
    if (!device) {
      return res.status(404).json({ message: "Device not found." });
    }

    // Assign device to parent
    device.parentId = parentId;
    await device.save();

    return res.status(200).json({ message: "Device assigned successfully.", device });
  } catch (error) {
    console.error("Error assigning device:", error);
    return res.status(500).json({ message: "Internal server error." });
  }
};

const assignDeviceToChild = async (req, res) => {
  try {
    const { childId, deviceId } = req.body;

    if (!childId || !deviceId) {
      return res.status(400).json({ message: "Child ID and Device ID are required." });
    }

    const child = await User.findByPk(childId);
    if (!child || child.role !== 4) { // Ensure the user is a child
      return res.status(404).json({ message: "Child not found or invalid role." });
    }

    const device = await Device.findByPk(deviceId);
    if (!device) {
      return res.status(404).json({ message: "Device not found." });
    }
    child.status = 1;
    await child.save();
    // Assign device to child
    device.userId = childId;
    await device.save();

    // Unsubscribe from MQTT if it was previously subscribed
    if (!clientMap.has(device.deviceName)) {
      subscribeDevice(device.deviceName);
      console.log(`✅ Started listening for ${device.deviceName}`);
    } else {
      console.log(`⚠️ Device ${device.deviceName} was not actively subscribed.`);
    }

    return res.status(200).json({ message: "Device assigned successfully.", device });
  } catch (error) {
    console.error("❌ Error assigning device:", error);
    return res.status(500).json({ message: "Internal server error." });
  }
};

const getUnassignedChildren = async (req, res) => {
  try {
    const parentId = req.user.id;

    if (!parentId) {
      return res.status(400).json({ success: false, message: "Invalid parentId" });
    }

    // Find all children of the parent
    const children = await User.findAll({
      where: { adminId: parentId, role: 4 }, // Ensure role is child
    });

    // Fetch all devices assigned to the same parent
    const devices = await Device.findAll({
      where: { parentId },
      attributes: ["userId"], // Only fetch userId column
    });

    // Extract assigned userIds from devices
    const assignedUserIds = devices.map((device) => device.userId).filter(Boolean);

    // Filter out children who are already assigned a device
    const unassignedChildren = children.filter((child) => !assignedUserIds.includes(child.id));

    return res.status(200).json({ success: true, data: unassignedChildren });
  } catch (error) {
    console.error("Error fetching unassigned children:", error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};


const unassignDeviceFromParent = async (req, res) => {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({ message: "Device ID is required." });
    }

    const device = await Device.findByPk(id);
    if (!device) {
      return res.status(404).json({ message: "Device not found." });
    }
    if(device.userId != null){
      const user = await User.findByPk(device.userId);
      user.status = 2;
      await user.save();
    }

    // Remove device location history
    await Location.destroy({
      where: { device_id: device.id },
    });

    // Unsubscribe from MQTT if the device was actively subscribed
    if (clientMap.has(device.deviceName)) {
      unsubscribeDevice(device.deviceName);
      console.log(`🛑 Stopped listening for ${device.deviceName}`);
    } else {
      console.log(`⚠️ Device ${device.deviceName} was not actively subscribed.`);
    }

    // Unassign parent and child from the device
    device.parentId = null;
    device.userId = null;
    await device.save();

    return res.status(200).json({ message: "Device unassigned from parent successfully.", device });
  } catch (error) {
    console.error("Error unassigning device from parent:", error);
    return res.status(500).json({ message: "Internal server error." });
  }
};

const unassignDeviceFromChild = async (req, res) => {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({ message: "Device ID is required." });
    }

    const device = await Device.findByPk(id);
    if (!device) {
      return res.status(404).json({ message: "Device not found." });
    }

    // Remove device location history
    await Location.destroy({
      where: { device_id: device.id },
    });
    if(device.userId != null){
      const user = await User.findByPk(device.userId);
      user.status = 2;
      await user.save();
    }
    // Unassign the child by setting userId to null
    device.userId = null;
    await device.save();

    // Unsubscribe from MQTT if necessary
    if (clientMap.has(device.deviceName)) {
      unsubscribeDevice(device.deviceName);
      console.log(`🛑 Stopped listening for ${device.deviceName}`);
    } else {
      console.log(`⚠️ Device ${device.deviceName} was not actively subscribed.`);
    }

    return res.status(200).json({ message: "Device unassigned from child successfully.", device });
  } catch (error) {
    console.error("❌ Error unassigning device from child:", error);
    return res.status(500).json({ message: "Internal server error." });
  }
};

const getActiveDevices = async (req, res) => {
  try {
    const parentId = req.user.id; // Assuming parentId is retrieved from authentication

    if (!parentId) {
      return res.status(400).json({ message: "Parent ID is required." });
    }

    // Fetch active devices for the logged-in parent
    const activeDevices = await Device.findAll({
      where: {
        parentId,
        status: 1, // 1 = Active
      },
    });

    return res.status(200).json({
      message: "Active devices retrieved successfully.",
      devices: activeDevices,
    });
  } catch (error) {
    console.error("❌ Error fetching active devices:", error);
    return res.status(500).json({ message: "Internal server error." });
  }
};




module.exports = {
  createDevice,
  getAllDevices,
  getDeviceById,
  updateDevice,
  deleteDevice,
    assignDeviceToParent,
    assignDeviceToChild,
    getUnassignedChildren,
    unassignDeviceFromParent,
    unassignDeviceFromChild,
    getActiveDevices,

};
