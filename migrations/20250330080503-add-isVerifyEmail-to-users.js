'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('Users', 'isVerifyEmail', {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false, // Users will be unverified by default
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn('Users', 'isVerifyEmail');
  }
};
