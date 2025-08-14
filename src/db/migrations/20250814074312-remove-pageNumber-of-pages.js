"use strict";
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.removeColumn("pages", "pageNumber");
  },
  async down(queryInterface, Sequelize) {
    await queryInterface.addColumn("pages", "pageNumber", {
      type: Sequelize.INTEGER,
      allowNull: true,
      after: "releaseDate",
    });
  },
};
