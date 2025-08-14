"use strict";
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Remove unique constraint from 'name' column if exists
    await queryInterface.changeColumn("pages", "imageUrl", {
      type: Sequelize.JSON,
      allowNull: false,
      unique: false,
    });
  },
  async down(queryInterface, Sequelize) {
    // Add unique constraint back to 'name' column
    await queryInterface.changeColumn("pages", "imageUrl", {
      type: Sequelize.STRING(255),
      allowNull: false,
      unique: false,
    });
  },
};
