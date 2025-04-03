"use strict";
const { Model } = require("sequelize");

module.exports = (sequelize, DataTypes) => {
  class Geofence extends Model {
    static associate(models) {
      // Many-to-Many Relationship with Devices
      Geofence.belongsToMany(models.Device, {
        through: models.GeofenceDevice, // Join table
        foreignKey: "geofence_id",
        as: "devices", // Alias for associated devices
      });

      // Belongs to User (Created By)
      Geofence.belongsTo(models.User, {
        foreignKey: "created_by",
        as: "creator",
      });

      Geofence.hasMany(models.GeofenceDevice, {
        foreignKey: "geofence_id",
        as: "geofenceDevices",
        onDelete: "CASCADE",
      });
    }
  }

  Geofence.init(
    {
      name: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      type: {
        type: DataTypes.ENUM("area", "route", "circle"),
        allowNull: false,
        defaultValue: "area",
      },
      area: {
        type: DataTypes.GEOMETRY("POLYGON", 4326),
        allowNull: true,
      },
      path: {
        type: DataTypes.GEOMETRY("LINESTRING", 4326),
        allowNull: true,
      },
      center: {
        type: DataTypes.GEOMETRY("POINT", 4326),
        allowNull: true,
      },
      radius: {
        type: DataTypes.FLOAT,
        allowNull: true,
      },
      status: {
        type: DataTypes.ENUM("active", "inactive"),
        allowNull: false,
        defaultValue: "active",
      },
      created_by: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
          model: "Users",
          key: "id",
        },
      },
    },
    {
      sequelize,
      modelName: "Geofence",
      tableName: "Geofences",
      timestamps: true,
      createdAt: "created_at",
      updatedAt: false, // Disable updatedAt
    }
  );

  return Geofence;
};
