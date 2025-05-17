const { EventEmitter } = require("events");
const { Notification, User } = require("../models");
const { geofenceCooldownCache } = require("./cache");

const notificationEventEmitter = new EventEmitter();

// In-memory cache to debounce geofence alerts per user


/**
 * Send a notification (DB + WebSocket)
 * @param {Object} params - Notification data
 * @param {Number} params.userId - User ID to notify
 * @param {String} params.type - Notification type (e.g., "danger_alert")
 * @param {Object} params.data - Additional details
 */
const sendNotification = async ({ userId, type, data }) => {
  try {
    // Geofence cooldown logic
    if (
      type === "Geofence Alert" &&
      geofenceCooldownCache.has(userId) &&
      geofenceCooldownCache.get(userId) === data.deviceId
    ) {
      console.log(`⏳ Skipping duplicate geofence alert for user ${userId}`);
      return; // ✅ Still resolve to continue main flow
    }

    // Set cooldown
    if (type === "Geofence Alert") {
      geofenceCooldownCache.set(userId, data.deviceId);

      setTimeout(() => {
        geofenceCooldownCache.delete(userId);
        console.log(`⏱️ Cooldown expired for user ${userId}`);
      }, 5 * 60 * 1000);
    }

    // Proceed with notification storage
    const user = await User.findByPk(userId);
    if (!user) {
      console.log(`⚠️ User ${userId} not found. Skipping notification.`);
      return;
    }

    const notification = await Notification.create({
      user_id: userId,
      type,
      data,
    });

    console.log(`✅ Notification saved for User ${userId}:`, { type, data });
    notificationEventEmitter.emit("newNotification", { userId, notification });

  } catch (error) {
    console.error("❌ Error sending notification:", error);
  }
};


module.exports = { sendNotification, notificationEventEmitter };
