const { Server } = require("socket.io");
const { deviceEventEmitter } = require("./connectMqtt");
const { Device } = require("../models");
const { sendNotification, notificationEventEmitter } = require("../helper/notificationHelper");

let io;
const connectedUsers = new Map(); // Map of userId -> socketId

const initializeSocket = (server) => {
  io = new Server(server, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"],
    },
  });

  io.on("connection", (socket) => {
    console.log(`🟢 New client connected: ${socket.id}`);

    // Listen for client registration (pass the userId)
    socket.on("registerUser", (userId) => {
      connectedUsers.set(userId, socket.id);
      console.log(`✅ User ${userId} registered with socket ${socket.id}`);
    });

    socket.on("disconnect", () => {
      for (const [userId, sockId] of connectedUsers) {
        if (sockId === socket.id) {
          connectedUsers.delete(userId);
          console.log(`🔴 User ${userId} disconnected.`);
          break;
        }
      }
    });
  });

  // Helper function to send events to a specific user
  const sendToUser = (userId, eventName, data) => {
    const socketId = connectedUsers.get(userId);
    if (socketId) {
      io.to(socketId).emit(eventName, data);
      console.log(`📢 Sent ${eventName} to user ${userId}:`, data);
    } else {
      console.log(`⚠️ User ${userId} is not connected. Skipping notification.`);
    }
  };

  // Listen for device events and send notifications to specific users
  deviceEventEmitter.on("deviceStatusChange", ({ userId, deviceId, status }) => {
    sendToUser(userId, "deviceStatusUpdate", { deviceId, status });
  });

  deviceEventEmitter.on("deviceChange", ({ userId, action, deviceId }) => {
    sendToUser(userId, "deviceChange", { action, deviceId });
  });

  deviceEventEmitter.on("dangerAlert", async ({ deviceId, userId, long, lat,locChildId }) => {
    console.log(`🚨 Danger alert received from Device ${deviceId} User ${userId}`);
    try {
      const device = await Device.findByPk(deviceId);
      // Check if device exists and is associated with a user
      if (device && device.userId) {
        await sendNotification({
          userId: userId,
          type: "Danger Alert",
          data: { 
            childId:locChildId,
            deviceId,
            location:{latitude: lat, longitude: long},
           },
        });
      }
    } catch (error) {
      console.error("Error in dangerAlert handling:", error);
    }
  });

  // Listen for new notification events and send to the corresponding user
  notificationEventEmitter.on("newNotification", ({ userId, notification }) => {
    sendToUser(userId, "newNotification", notification);
  });
};

module.exports = { initializeSocket, io };
