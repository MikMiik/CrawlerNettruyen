"use strict";
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn("comics", "otherName", {
      type: Sequelize.TEXT,
      allowNull: true,
      after: "name",
    });
    await queryInterface.addColumn("comics", "viewCount", {
      type: Sequelize.INTEGER,
      allowNull: false,
      defaultValue: 0,
      after: "ratingCount",
    });
  },
  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn("comics", "otherName");
    await queryInterface.removeColumn("comics", "viewCount");
  },
};
