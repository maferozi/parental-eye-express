const EventEmitter = require("events");
require("dotenv").config();
const mqtt = require("mqtt");
const { Device } = require("../models");
const { Op } = require("sequelize");
const { saveDeviceLocation } = require("../helper/locationStore");
const { saveGeofenceLocation } = require("../helper/geofenceLocationStore");

const { HIVEMQ_CONNECTION_STRING } = process.env;

const deviceEventEmitter = new EventEmitter(); // Event emitter for real-time updates
const clientMap = new Map(); // Stores active MQTT clients
const deviceTimeouts = new Map(); // Stores inactivity timeouts
const deviceStatusCache = new Map(); // Caches last known status to prevent duplicate events

const subscribeDevice = async (device) => {
  if (clientMap.has(device.deviceName)) {
    console.log(`⚠️ MQTT Client already exists for ${device.deviceName}`);
    return;
  }

  if (!device.password) {
    device = await Device.findOne({ where: { deviceName: device } });
  }

  const options = {
    username: device.deviceName,
    password: device.password,
    protocol: "wss",
    reconnectPeriod: 5000,
    clientId: `mqtt_${Math.random().toString(16).slice(3)}`,
  };

  const client = mqtt.connect(HIVEMQ_CONNECTION_STRING, options);
  clientMap.set(device.deviceName, { client, deviceId: device.id });

  // Emit deviceChange event only if the device was not already present
  if (!deviceStatusCache.has(device.id)) {
    deviceEventEmitter.emit("deviceChange", { action: "added", deviceId: device.id });
  }

  client.on("connect", () => {
    console.log(`✅ Connected to MQTT as ${device.deviceName}`);

    const topics = [`tracking/location/${device.deviceName}`, `tracking/danger/${device.deviceName}`];

    client.subscribe(topics, (err) => {
      if (err) console.error(`❌ Subscription Error:`, err);
      else console.log(`📡 Subscribed to:`, topics);
    });
  });

  client.on("message", async (topic, message) => {
    try {
      const data = JSON.parse(message.toString());
      const { deviceId } = clientMap.get(device.deviceName);

      if (!deviceId) {
        console.error(`❌ Device ID not found for ${device.deviceName}`);
        return;
      }

      if (topic.includes("location")) {
        await saveGeofenceLocation(deviceId, data.latitude, data.longitude);

        // Only update if status has changed
        if (deviceStatusCache.get(deviceId) !== 1) {
          await Device.update({ status: 1 }, { where: { id: deviceId } });
          deviceStatusCache.set(deviceId, 1);
          console.log(`✅ Device ${device.deviceName} is ACTIVE`);
          deviceEventEmitter.emit("deviceStatusChange", { deviceId, status: 1 });
        }

        // Clear any existing timeout
        if (deviceTimeouts.has(deviceId)) {
          clearTimeout(deviceTimeouts.get(deviceId));
        }

        // Set new timeout for INACTIVE status
        const timeout = setTimeout(async () => {
          if (deviceStatusCache.get(deviceId) !== 2) {
            await Device.update({ status: 2 }, { where: { id: deviceId } });
            deviceStatusCache.set(deviceId, 2);
            console.log(`⏳ Device ${device.deviceName} is now INACTIVE (No updates in 30s)`);
            deviceEventEmitter.emit("deviceStatusChange", { deviceId, status: 2 });
          }
        }, 30000);

        deviceTimeouts.set(deviceId, timeout);
      } else if (topic.includes("danger")) {
        await saveDeviceLocation(deviceId, data.latitude, data.longitude, 2);
        console.log(`🚨 Danger alert received from ${device.deviceName}`);
        deviceEventEmitter.emit("dangerAlert", { deviceId, status: 2 });
      }
    } catch (error) {
      console.error(`❌ Error processing message:`, error);
    }
  });

  client.on("error", (err) => console.error(`❌ MQTT Error:`, err));
};

const unsubscribeDevice = (deviceName) => {
  if (clientMap.has(deviceName)) {
    const { client, deviceId } = clientMap.get(deviceName);
    client.end();
    clientMap.delete(deviceName);
    deviceStatusCache.delete(deviceId); // Clear status cache

    // Emit deviceChange event only if the device was previously tracked
    deviceEventEmitter.emit("deviceChange", { action: "removed", deviceId });

    console.log(`🛑 Disconnected MQTT client for ${deviceName}`);
  } else {
    console.log(`⚠️ Device ${deviceName} was not actively subscribed.`);
  }
};

const connectMqtt = async () => {
  try {
    // Reset all devices to inactive **only if they are currently active**
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

    // Subscribe only to devices that are NOT in clientMap
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
