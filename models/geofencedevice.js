"use strict";
const { Model } = require("sequelize");

module.exports = (sequelize, DataTypes) => {
  class GeofenceDevice extends Model {
    static associate(models) {
      // No direct association needed, as it acts as a join table
      GeofenceDevice.belongsTo(models.Geofence, {
        foreignKey: "geofence_id",
        as: "geofenceDevices",
        onDelete: "CASCADE",
      });
    }
  }

  GeofenceDevice.init(
    {
      geofence_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
          model: "Geofences",
          key: "id",
        },
        onDelete: "CASCADE",
        onUpdate: "CASCADE",
      },
      device_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
          model: "Devices",
          key: "id",
        },
        onDelete: "CASCADE",
        onUpdate: "CASCADE",
      },
    },
    {
      sequelize,
      modelName: "GeofenceDevice",
      tableName: "GeofenceDevices",
      timestamps: true,
      createdAt: "created_at",
      updatedAt: false,
    }
  );

  return GeofenceDevice;
};
