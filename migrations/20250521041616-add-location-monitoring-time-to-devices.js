'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('Devices', 'location_start_time', {
      type: Sequelize.TIME,
      allowNull: false,
      defaultValue: '07:00:00', // 7:00 AM
    });

    await queryInterface.addColumn('Devices', 'location_end_time', {
      type: Sequelize.TIME,
      allowNull: false,
      defaultValue: '15:00:00', // 3:00 PM
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn('Devices', 'location_start_time');
    await queryInterface.removeColumn('Devices', 'location_end_time');
  }
};
