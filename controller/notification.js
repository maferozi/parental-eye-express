// controllers/notificationController.js
const { Notification, User } = require("../models");

/**
 * Get unread notifications for a given user with pagination.
 * Expects query parameters: userId, page, limit.
 */
const getUnreadNotificationsPaginated = async (req, res) => {
  try {
    const userId = req.user.id;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;

    if (!userId) {
      return res.status(400).json({ error: "User ID is required." });
    }

    // Always sort by id or created_at DESC
    const { count, rows } = await Notification.findAndCountAll({
      where: {
        user_id: userId,
        is_read: false
      },
      order: [['created_at', 'DESC'], ['id', 'DESC']], // for tie-breaking
      limit,
      offset
    });

    return res.status(200).json({
      message: "Unread notifications fetched successfully",
      data: rows,
      page,
      limit,
      totalCount: count,
    });
  } catch (error) {
    console.error("Error fetching notifications:", error);
    return res.status(500).json({ error: "Internal Server Error" });
  }
};

module.exports = { getUnreadNotificationsPaginated };
