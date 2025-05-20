'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class DeviceRequest extends Model {
    static associate(models) {
      // Each request belongs to a user (the requester)
      DeviceRequest.belongsTo(models.User, {
        foreignKey: 'userId',
        as: 'user',
      });
    }
  }

  DeviceRequest.init({
    userId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    status: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 1, // 1 = pending, 2 = approved, 3 = rejected
    },
    deviceCount: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 1,
    },
    requestedAt: {
      type: DataTypes.DATE,
      allowNull: false,
    }
  }, {
    sequelize,
    modelName: 'DeviceRequest',
    tableName: 'DeviceRequests',
    timestamps: true,       // will manage createdAt/updatedAt
    createdAt: 'requestedAt',
    updatedAt: 'updatedAt'
  });

  return DeviceRequest;
};
