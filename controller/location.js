const { Op } = require("sequelize");
const { User, Device, Location } = require("../models");

const getUsersWithLocationHistory = async (req, res) => {
  try {
    // Find all device IDs that exist in the Location table
    const devicesWithLocation = await Location.findAll({
      attributes: ["device_id"],
      group: ["device_id"],
    });
    
    const deviceIds = devicesWithLocation.map((loc) => loc.device_id);

    if (deviceIds.length === 0) {
      return res.status(404).json({ message: "No users with location history found." });
    }

    // Find all users who have these devices
    const devices = await Device.findAll({
      where: { id: deviceIds, parentId: req.user.id },
      attributes: ["id", "deviceName", "status", "userId"],
      include: [
        {
          model: User,
          as: "user",
          attributes: ["id", "firstName", "phoneNumber"],
        },
      ],
    });

    return res.status(200).json({ devices });
  } catch (error) {
    console.error("Error fetching users with location history:", error);
    return res.status(500).json({ message: "Internal server error." });
  }
};

const getLocationByUserId = async (req, res) => {
  try {
    const { userId, startDate, endDate } = req.body;

    const device = await Device.findOne({ where: { userId } });
    if (!device) return res.status(404).json({ message: "Device not found for this user" });

    const start = new Date(startDate);
    const end = new Date(endDate);

    // Adjust end time to include full day (23:59:59)
    start.setHours(0, 0, 0, 1);
    end.setHours(23, 59, 59, 999);

    const location = await Location.findAll({
      where: {
        device_id: device.id,
        received_at: { [Op.between]: [start, end] },
      },
      order: [["received_at", "DESC"]],
    });

    if (!location.length) return res.status(404).json({ message: "No location data available" });

    return res.status(200).json({ deviceId: device.id, location });
  } catch (error) {
    console.error("Error fetching location:", error);
    return res.status(500).json({ message: "Internal Server Error" });
  }
};

module.exports = { getLocationByUserId, getUsersWithLocationHistory };
