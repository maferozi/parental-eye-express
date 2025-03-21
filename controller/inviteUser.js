'use strict';

const { Op } = require("sequelize");
const { User } = require("../models");
const { generateHash } = require("../helper/hash");

// Add or Update a User
const addOrUpdateUser = async (req, res) => {
  try {
    const {
      id,
      type,
      firstName,
      lastName,
      email,
      phoneNumber,
      password,
      parentId,
      driverId,
    } = req.body;

    const role = Number(type);

    // Ensure that only valid roles are assigned
    if (![3, 4, 5].includes(role)) {
      return res.status(400).json({ error: "Invalid user role." });
    }

    // Check if the email already exists (excluding the current user in case of update)
    const existingUser = await User.findOne({
      where: { email },
    });

    if (existingUser && existingUser.id !== id) {
      return res.status(400).json({ error: "Email is already in use." });
    }

    const pass = await generateHash(password);

    const ids = req.body.id ? Number(req.body.id) || null : null;

    // Upsert: Create or Update User
    const [user, created] = await User.upsert(
      {
        id: ids ,
        role,
        firstName,
        lastName,
        email,
        phoneNumber,
        password : pass, // Ensure password is hashed before storing in production
        adminId:  req.user.id, // Only applies to Child role
        parentId: role === 4 ? parentId || null : null, // Only applies to Child role
        driverId: role === 4 ? driverId || null : null, // Only applies to Child role
      },
      { returning: true }
    );

    res.status(created ? 201 : 200).json({
      message: created ? "User added successfully." : "User updated successfully.",
      data: user,
    });
  } catch (error) {
    console.error("Error adding or updating user:", error);
    res.status(500).json({ error: "Failed to add or update user." });
  }
};

// Remove a User by ID
const removeUser = async (req, res) => {
  try {
    const { id } = req.params;

    const user = await User.findByPk(id);
    if (!user) {
      return res.status(404).json({ error: 'User not found.' });
    }

    await user.destroy();

    res.status(200).json({ message: 'User removed successfully.' });
  } catch (error) {
    console.error('Error removing user:', error);
    res.status(500).json({ error: 'Failed to remove user.' });
  }
};

// Get all users with filtering, sorting, and pagination
const getAllUsers = async (req, res) => {
  try {
    const {
      search = '', 
      sortField = 'updatedAt',
      sortOrder = 'DESC',
      pageNo = 1,
      limit = 10,
      role,
    } = req.query;

    const offset = (pageNo - 1) * limit;

    const searchFilter = {
      [Op.and]: [
        { adminId: req.user.id }, // Fetch only users created by the logged-in admin
        {
          [Op.or]: [
            { firstName: { [Op.iLike]: `%${search}%` } },
            { lastName: { [Op.iLike]: `%${search}%` } },
            { email: { [Op.iLike]: `%${search}%` } },
          ],
        },
        ...(role ? [{ role }] : []), // Apply role filter only if provided
      ],
    };

    const { count, rows } = await User.findAndCountAll({
      where: searchFilter,
      order: [[sortField, sortOrder]],
      limit: parseInt(limit, 10),
      offset: parseInt(offset, 10),
    });

    res.status(200).json({
      message: 'Fetched users successfully.',
      data: rows,
      count,
      pageNo: parseInt(pageNo, 10),
      totalPages: Math.ceil(count / limit),
      limit: parseInt(limit, 10),
    });
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ error: 'Failed to fetch users.' });
  }
};

const getAllParents = async (req, res) => {
  try {
    const { search = "", sortField = "updatedAt", sortOrder = "DESC" } = req.query;

    const searchFilter = {
      [Op.and]: [
        { adminId: req.user.id }, // Only fetch parents assigned to the logged-in admin
        { role: 3 }, // Filter by role (3 = parent)
        {
          [Op.or]: [
            { firstName: { [Op.iLike]: `%${search}%` } },
            { lastName: { [Op.iLike]: `%${search}%` } },
            { email: { [Op.iLike]: `%${search}%` } },
          ],
        },
      ],
    };

    const parents = await User.findAll({
      where: searchFilter,
      order: [[sortField, sortOrder]],
    });

    res.status(200).json({
      message: "Fetched parents successfully.",
      data: parents,
      count: parents.length,
    });
  } catch (error) {
    console.error("Error fetching parents:", error);
    res.status(500).json({ error: "Failed to fetch parents." });
  }
};


const getAllDrivers = async (req, res) => {
  try {
    const { search = "", sortField = "updatedAt", sortOrder = "DESC" } = req.query;

    const searchFilter = {
      [Op.and]: [
        { adminId: req.user.id }, // Only fetch parents assigned to the logged-in admin
        { role: 5 }, // Filter by role (5 = Driver)
        {
          [Op.or]: [
            { firstName: { [Op.iLike]: `%${search}%` } },
            { lastName: { [Op.iLike]: `%${search}%` } },
            { email: { [Op.iLike]: `%${search}%` } },
          ],
        },
      ],
    };

    const parents = await User.findAll({
      where: searchFilter,
      order: [[sortField, sortOrder]],
    });

    res.status(200).json({
      message: "Fetched parents successfully.",
      data: parents,
      count: parents.length,
    });
  } catch (error) {
    console.error("Error fetching parents:", error);
    res.status(500).json({ error: "Failed to fetch parents." });
  }
};



// Get a User by ID
const getUserById = async (req, res) => {
  try {
    const { id } = req.params;

    const user = await User.findByPk(id);

    if (!user) {
      return res.status(404).json({ message: 'User not found.' });
    }

    res.status(200).json({
      message: 'Fetched user successfully.',
      data: user,
    });
  } catch (error) {
    console.error('Error fetching user:', error);
    res.status(500).json({ error: 'Failed to fetch user.' });
  }
};

module.exports = {
  addOrUpdateUser,
  removeUser,
  getAllUsers,
  getUserById,
  getAllDrivers,
  getAllParents,
};
