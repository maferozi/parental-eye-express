'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('Users', 'verifyToken', {
      type: Sequelize.STRING,
      allowNull: true, // Token is null until the user requests verification
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn('Users', 'verifyToken');
  }
};
