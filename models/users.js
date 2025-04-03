'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class User extends Model {
    static associate(models) {
      // Admin-Child Relationship (An admin can add multiple children)
      User.hasMany(models.User, {
        foreignKey: 'adminId',
        as: 'adminCreatedChildren',
      });

      User.belongsTo(models.User, {
        foreignKey: 'adminId',
        as: 'createdByAdmin',
      });

      // Parent-Child Relationship (A parent can have multiple children)
      User.hasMany(models.User, {
        foreignKey: 'parentId',
        as: 'children',
      });

      User.belongsTo(models.User, {
        foreignKey: 'parentId',
        as: 'parent',
      });

      // Driver-Child Relationship (A driver can be assigned multiple children)
      User.hasMany(models.User, {
        foreignKey: 'driverId',
        as: 'assignedChildren',
      });

      User.belongsTo(models.User, {
        foreignKey: 'driverId',
        as: 'driver',
      });

      // Each user can have one device (if needed)
      User.hasOne(models.Device, {
        foreignKey: 'userId',
        as: 'device',
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE',
      });

      User.hasMany(models.Geofence, {
        foreignKey: "created_by",
        as: "geofences",
      });

      User.hasMany(models.Notification, {
        foreignKey: "user_id",
        as: "notifications",
        onDelete: "CASCADE",
        onUpdate: "CASCADE",
      });
    }
  }

  User.init({
    firstName: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    lastName: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    email: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
    },
    password: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    role: {
      type: DataTypes.INTEGER,
      allowNull: false,
      // Roles:
      // 1 = Super Admin, 2 = Admin, 3 = Guardian, 4 = Child, 5 = Driver
      defaultValue: 3,
    },
    status: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 2,
    },
    phoneNumber: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    // Password reset token
    forgetToken: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    // Admin who created the user (for child users)
    adminId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: 'Users',
        key: 'id',
      },
    },
    // Parent ID (only applies to children)
    parentId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: 'Users',
        key: 'id',
      },
    },
    // Assigned driver ID (only applies to children)
    driverId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: 'Users',
        key: 'id',
      },
    },
    isVerifyEmail: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    }, 
    verifyToken: {
      type: DataTypes.STRING,
      allowNull: true,
    },       
  }, {
    sequelize,
    modelName: 'User',
    tableName: 'Users',
    timestamps: true,
  });

  return User;
};
