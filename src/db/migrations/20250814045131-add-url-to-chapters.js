"use strict";
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn("chapters", "url", {
      type: Sequelize.STRING(255),
      allowNull: true,
      after: "releaseDate",
    });
  },
  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn("chapters", "url");
  },
};
