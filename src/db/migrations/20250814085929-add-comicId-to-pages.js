"use strict";
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn("pages", "comicId", {
      type: Sequelize.INTEGER,
      allowNull: false,
      after: "chapterId",
    });
  },
  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn("pages", "comicId");
  },
};
