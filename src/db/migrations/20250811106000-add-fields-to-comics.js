"use strict";
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn("comics", "authorId", {
      type: Sequelize.INTEGER,
      allowNull: true,
      references: {
        model: "authors",
        key: "id",
      },
      onUpdate: "CASCADE",
      onDelete: "SET NULL",
      after: "slug",
    });
    await queryInterface.addColumn("comics", "status", {
      type: Sequelize.STRING,
      allowNull: true,
      after: "originalUrl",
    });
    await queryInterface.addColumn("comics", "ratingCount", {
      type: Sequelize.INTEGER,
      allowNull: false,
      defaultValue: 0,
      after: "status",
    });
    await queryInterface.addColumn("comics", "followingCount", {
      type: Sequelize.INTEGER,
      allowNull: false,
      defaultValue: 0,
      after: "ratingCount",
    });
    await queryInterface.addColumn("comics", "content", {
      type: Sequelize.TEXT,
      allowNull: true,
      after: "authorId",
    });
  },
  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn("comics", "authorId");
    await queryInterface.removeColumn("comics", "status");
    await queryInterface.removeColumn("comics", "ratingCount");
    await queryInterface.removeColumn("comics", "followingCount");
    await queryInterface.removeColumn("comics", "content");
  },
};
