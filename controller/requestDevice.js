const { User, DeviceRequest } = require("../models");

const { Op } = require("sequelize");

const getAllRequests = async (req, res, next) => {
  try {
    const {
      search = '',
      sortField = 'updatedAt',
      sortOrder = 'DESC',
      pageNo = 1,
      limit = 10,
    } = req.query;

    const offset = (pageNo - 1) * limit;
    const userId = req.user.id;
    if(req.user.role != 1 || req.user.role != 2){
        new Error("Unauthorized to fetch recordes");
    }

    const whereCondition = {};
    if (req.user.role === 2) {
      whereCondition.userId = userId;
    }

    if (search) {
      whereCondition[Op.or] = [
        { '$user.firstName$': { [Op.iLike]: `%${search}%` } },
        { '$user.lastName$': { [Op.iLike]: `%${search}%` } },
        { '$user.email$': { [Op.iLike]: `%${search}%` } },
      ];
    }

    const { count, rows } = await DeviceRequest.findAndCountAll({
      where: whereCondition,
      include: [
        {
          model: User,
          as: "user",
          attributes: ['id', 'firstName', 'lastName', 'email'],
        },
      ],
      order: [
        ['status', 'ASC'],
        [sortField, sortOrder],
      ],
      limit: parseInt(limit, 10),
      offset: parseInt(offset, 10),
    });

    res.status(200).json({
      message: "Data fetched successfully",
      data: rows,
      count,
      pageNo: parseInt(pageNo, 10),
      totalPages: Math.ceil(count / limit),
      limit: parseInt(limit, 10),
    });
  } catch (error) {
    console.error("Error fetching all device requests:", error);
    next(error);
  }
};



const createRequest = async (req, res, next) => {
  const { noOfDevices } = req.body;
const userId = req.user.id;
  try {

    if (!userId || !noOfDevices) {
      return res.status(400).json({ message: "userId and noOfDevices are required" });
    }

    const request = await DeviceRequest.create({
      userId,
      deviceCount:noOfDevices,
      status: 1 // pending
    });

    res.status(201).json({data:request, message:"Request create successfully"});
  } catch (error) {
    console.error("Error creating device request:", error);
    next(error);
  }
};

const deleteRequest = async (req, res, next) => {
  const { id } = req.params;

  try {
    if(req.user.role != 2){
        new Error('Unauthorized for this requests');
    }
    const request = await DeviceRequest.findByPk(id);
    if(request.userId != req.user.id){
        new Error('Unauthorized to delete this requests');
    }
    if (!request) {
      new Error("Request not found");
    }

    await request.destroy();
    res.status(200).json({ message: "Request deleted successfully" });
  } catch (error) {
    console.error("Error deleting device request:", error);
    next(error);
  }
};


const updateRequestStatus = async (req, res, next) => {
  const { status, id } = req.body;

  try {

    if(req.user.role != 1){
        new Error('Unauthorized for this requests');
    }

    // Validate status
    if (![1, 2, 3].includes(status)) {
      return res.status(400).json({ message: "Invalid status value. Must be 1 (pending), 2 (approved), or 3 (rejected)" });
    }

    // Find the request
    const request = await DeviceRequest.findByPk(id);

    if (!request) {
      return res.status(404).json({ message: "Device request not found" });
    }

    // Update status
    request.status = status;

    await request.save();

    res.status(200).json({ message: "Request status updated successfully", request });
  } catch (error) {
    console.error("Error updating device request status:", error);
    next(error)
  }
};


module.exports = {
  getAllRequests,
  createRequest,
  deleteRequest,
  updateRequestStatus
};
