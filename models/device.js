'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class Device extends Model {
    static associate(models) {
      // A Device belongs to a User (instead of InvitedUser)
      Device.belongsTo(models.User, {
        foreignKey: "userId",
        as: "user",
        onDelete: "CASCADE",
        onUpdate: "CASCADE",
      });

      // A Device belongs to a Parent User (Admin)
      Device.belongsTo(models.User, {
        foreignKey: 'parentId',
        as: 'parent',
        onDelete: 'SET NULL',
        onUpdate: 'CASCADE',
      });
      Device.belongsToMany(models.Geofence, {
        through: models.GeofenceDevice, // Join table
        foreignKey: "device_id",
        as: "geofences", // Alias for associated geofences
      });

        Device.hasMany(models.Location, {
    foreignKey: 'device_id',
    as: 'locations',
    onDelete: 'CASCADE',
    onUpdate: 'CASCADE'
  });
    }
  }

  Device.init(
    {
      deviceName: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      password: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      userId: {
        type: DataTypes.INTEGER,
        allowNull: true,
        unique: true,
        references: {
          model: 'Users',
          key: 'id',
        },
      },
      parentId: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: {
          model: 'Users',
          key: 'id',
        },
      },
      status: {
        type: DataTypes.INTEGER,
        defaultValue: 2,
      },
      
    },
    {
      sequelize,
      modelName: 'Device',
      tableName: 'Devices',
      timestamps: true,
    }
  );

  return Device;
};
