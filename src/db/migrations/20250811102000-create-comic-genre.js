"use strict";
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("comic_genre", {
      comicId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: "comics",
          key: "id",
        },
        onDelete: "CASCADE",
        onUpdate: "CASCADE",
      },
      genreId: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: "genres",
          key: "id",
        },
        onDelete: "CASCADE",
        onUpdate: "CASCADE",
      },
      createdAt: {
        allowNull: false,
        type: Sequelize.DATE,
      },
      updatedAt: {
        allowNull: false,
        type: Sequelize.DATE,
      },
      deletedAt: {
        type: Sequelize.DATE,
        allowNull: true,
      },
    });
    await queryInterface.addConstraint("comic_genre", {
      fields: ["comicId", "genreId"],
      type: "unique",
      name: "unique_comic_genre",
    });
  },
  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable("comic_genre");
  },
};
