const { EventEmitter } = require("events");
const { Notification, User } = require("../models");

const notificationEventEmitter = new EventEmitter(); // Event emitter for notifications

/**
 * Send a notification (DB + WebSocket)
 * @param {Object} params - Notification data
 * @param {Number} params.userId - User ID to notify
 * @param {String} params.type - Notification type (e.g., "danger_alert")
 * @param {Object} params.data - Additional details
 */
const sendNotification = async ({ userId, type, data }) => {
  try {
    // Check if the user exists
    const user = await User.findByPk(userId);
    if (!user) {
      console.log(`⚠️ User ${userId} not found. Skipping notification.`);
      return;
    }

    // Store in database
    const notification = await Notification.create({
      user_id: userId,
      type,
      data,
    });

    console.log(`✅ Notification saved for User ${userId}:`, { type, data });

    // Emit notification event (this will be picked up in socketConfig.js)
    notificationEventEmitter.emit("newNotification", { userId, notification });
  } catch (error) {
    console.error("❌ Error sending notification:", error);
  }
};

module.exports = { sendNotification, notificationEventEmitter };
