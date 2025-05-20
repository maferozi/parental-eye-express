const { Server } = require("socket.io");
const mqtt = require("mqtt");
const { Op } = require("sequelize");
require("dotenv").config();

const { Device, User } = require("../models");
const { saveDeviceLocation } = require("../helper/locationStore");
const { saveGeofenceLocation } = require("../helper/geofenceLocationStore");

const { HIVEMQ_CONNECTION_STRING } = process.env;

const deviceEventEmitter = new (require("events").EventEmitter)(); // For real-time updates
const clientMap = new Map(); // Active MQTT clients: deviceName -> { client, deviceId, associatedUserIds }
const deviceTimeouts = new Map(); // Inactivity timeouts
const deviceStatusCache = new Map(); // Last known status cache

/**
 * Utility: Get all associated user IDs for a device.
 * Returns an array of unique user IDs: child's own id, parent's (guardian), driver's, and admin's.
 */
const getAssociatedUserIds = async (device) => {
  const userIds = new Set();
  if (device.userId) {
    // The device owner (child)
    userIds.add(device.userId);
    // Load the child record
    const child = await User.findByPk(device.userId);
    if (child) {
      if (child.parentId) userIds.add(child.parentId);
      if (child.driverId) userIds.add(child.driverId);
      if (child.adminId) userIds.add(child.adminId);
    }
  }
  return Array.from(userIds);
};

const subscribeDevice = async (device) => {
  try {
    if (clientMap.has(device.deviceName)) {
      console.log(`⚠️ MQTT Client already exists for ${device.deviceName}`);
      return;
    }

    // Ensure we have a complete device record
    if (!device.password) {
      device = await Device.findOne({ where: { deviceName: device } });
      if (!device) {
        console.error(`❌ Device ${device.deviceName} not found in DB`);
        return;
      }
    }

    const options = {
      username: device.deviceName,
      password: device.password,
      protocol: "wss",
      reconnectPeriod: 5000,
      clientId: `mqtt_${Math.random().toString(16).slice(3)}`,
    };

    const client = mqtt.connect(HIVEMQ_CONNECTION_STRING, options);

    // Calculate associated user IDs once and store along with the client
    const associatedUserIds = await getAssociatedUserIds(device);
    clientMap.set(device.deviceName, { client, deviceId: device.id, associatedUserIds, locChildId:device.userId });

    // Emit deviceChange event for each associated user if this is the first time
    if (!deviceStatusCache.has(device.id)) {
      associatedUserIds.forEach((userId) => {
        deviceEventEmitter.emit("deviceChange", { userId, action: "added", deviceId: device.id });
      });
    }

    client.on("connect", () => {
      console.log(`✅ Connected to MQTT as ${device.deviceName}`);
      const topics = [
        `tracking/location/${device.deviceName}`,
        `tracking/danger/${device.deviceName}`,
      ];
      client.subscribe(topics, (err) => {
        if (err) console.error(`❌ Subscription Error for ${device.deviceName}:`, err);
        else console.log(`📡 Subscribed to:`, topics);
      });
    });

    client.on("message", async (topic, message) => {
      try {
        const data = JSON.parse(message.toString());
        const { deviceId, associatedUserIds, locChildId } = clientMap.get(device.deviceName) || {};
        if (!deviceId) {
          console.error(`❌ Device ID not found for ${device.deviceName}`);
          return;
        }

        if (topic.includes("location")) {
          // Save geofence location (or regular device location as needed)
          await saveGeofenceLocation(associatedUserIds,deviceId, data.latitude, data.longitude, locChildId);

          // If device status is not active, update it and notify all associated users
          if (deviceStatusCache.get(deviceId) !== 1) {
            await Device.update({ status: 1 }, { where: { id: deviceId } });
            deviceStatusCache.set(deviceId, 1);
            console.log(`✅ Device ${device.deviceName} is ACTIVE`);
            associatedUserIds.forEach((userId) => {
              deviceEventEmitter.emit("deviceStatusChange", { userId, deviceId, status: 1 });
            });
          }

          // Reset any existing inactivity timeout
          if (deviceTimeouts.has(deviceId)) {
            clearTimeout(deviceTimeouts.get(deviceId));
          }
          // Set new timeout: if no updates in 30s, mark device as inactive and notify users
          const timeout = setTimeout(async () => {
            if (deviceStatusCache.get(deviceId) !== 2) {
              await Device.update({ status: 2 }, { where: { id: deviceId } });
              deviceStatusCache.set(deviceId, 2);
              console.log(`⏳ Device ${device.deviceName} is now INACTIVE (No updates in 30s)`);
              associatedUserIds.forEach((userId) => {
                deviceEventEmitter.emit("deviceStatusChange", { userId, deviceId, status: 2 });
              });
            }
          }, 30000);
          deviceTimeouts.set(deviceId, timeout);
          } else if (topic.includes("danger")) {
          await saveDeviceLocation(deviceId, data.latitude, data.longitude, 2);
          console.log(`🚨 Danger alert received from ${device.deviceName}`);
          associatedUserIds.forEach((userId) => {
            console.log(userId);
            deviceEventEmitter.emit("dangerAlert", { userId, deviceId, lat:data.latitude, long:data.longitude, status: 2,locChildId });
          });
        }
      } catch (error) {
        console.error(`❌ Error processing message for ${device.deviceName}:`, error);
      }
    });

    client.on("error", (err) => {
      console.error(`❌ MQTT Error for ${device.deviceName}:`, err);
    });
  } catch (error) {
    console.error(`❌ Error in subscribeDevice for ${device.deviceName}:`, error);
  }
};

const unsubscribeDevice = async (deviceName) => {
  try {
    if (clientMap.has(deviceName)) {
      const { client, deviceId, associatedUserIds } = clientMap.get(deviceName);
      client.end();
      clientMap.delete(deviceName);
      deviceStatusCache.delete(deviceId);

      // Emit deviceChange removal event for each associated user
      associatedUserIds.forEach((userId) => {
        deviceEventEmitter.emit("deviceChange", { userId, action: "removed", deviceId });
      });

      console.log(`🛑 Disconnected MQTT client for ${deviceName}`);
    } else {
      console.log(`⚠️ Device ${deviceName} was not actively subscribed.`);
    }
  } catch (error) {
    console.error(`❌ Error unsubscribing device ${deviceName}:`, error);
  }
};

const connectMqtt = async () => {
  try {
    // Reset all devices to inactive if they are currently active
    await Device.update({ status: 2 }, { where: { status: 1 } });
    console.log("🔄 Reset all active devices to INACTIVE at startup");

    const devices = await Device.findAll({
      where: {
        parentId: { [Op.ne]: null },
        userId: { [Op.ne]: null },
      },
    });

    if (!devices.length) {
      console.log("❌ No active devices found.");
      return;
    }

    // Subscribe only to devices that are not already subscribed
    devices.forEach((device) => {
      if (!clientMap.has(device.deviceName)) {
        subscribeDevice(device);
      }
    });
  } catch (error) {
    console.error("❌ Error connecting to MQTT:", error);
  }
};

module.exports = { connectMqtt, subscribeDevice, unsubscribeDevice, clientMap, deviceEventEmitter };
