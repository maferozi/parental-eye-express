const { Op } = require("sequelize");
const { User, Device, Location } = require("../models");

const getUsersWithLocationHistory = async (req, res, next) => {
  try {
    const role = req.user.role;
    const me = req.user.id;

    // 1️⃣ Build user‐filter based on role
    let userWhere = {};
    if (role === 2)       userWhere.adminId   = me;
    else if (role === 3)  userWhere.parentId  = me;
    else if (role === 4)  userWhere.id        = me;      // child sees only self
    else if (role === 5)  userWhere.driverId  = me;
    else return res.status(403).json({ message: 'Unauthorized' });

    // 2️⃣ Fetch only those users
    const users = await User.findAll({
      where: userWhere,
      attributes: ['id', 'firstName', 'lastName', 'email'],
    });
    if (!users.length) {
      return res.status(404).json({ message: 'No users found for your role.' });
    }

    const userIds = users.map(u => u.id);

    // 3️⃣ Fetch their devices—but only those that have at least one Location
    const devices = await Device.findAll({
      where: {
        userId: { [Op.in]: userIds }
      },
      attributes: ['id', 'deviceName', 'status', 'userId'],
      include: [
        // bring in the user info
        {
          model: User,
          as: 'user',
          attributes: ['id', 'firstName', 'lastName', 'email']
        },
        // require at least one matching Location row
        {
          model: Location,
          as: 'locations',
          attributes: [],       // we don’t need the full location payload here
          required: true        // INNER JOIN → filters out devices w/ zero locations
        }
      ],
      // group by Device.id to avoid duplicates if a device has many locations
      group: ['Device.id', 'user.id'],
    });

    if (!devices.length) {
      return res.status(404).json({ message: 'No devices with location history.' });
    }

    return res.status(200).json({ users, devices });
  } catch (error) {
    console.error('Error in getUsersWithLocationHistory:', error);
    next(error);
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
