"use strict";
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn("genres", "url", {
      type: Sequelize.STRING(100),
      allowNull: true,
      after: "name", // Chèn sau trường name
    });
    await queryInterface.addColumn("genres", "slug", {
      type: Sequelize.STRING(255),
      allowNull: true,
      after: "url", // Chèn sau trường url
    });
    await queryInterface.addIndex("genres", ["slug"], { unique: true });
  },
  async down(queryInterface, Sequelize) {
    await queryInterface.removeIndex("genres", ["slug"]);
    await queryInterface.removeColumn("genres", "slug");
    await queryInterface.removeColumn("genres", "url");
  },
};
