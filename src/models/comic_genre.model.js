"use strict";

const { Model } = require("sequelize");

module.exports = (sequelize, DataTypes) => {
  class ComicGenre extends Model {}
  ComicGenre.init(
    {
      comicId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
          model: "comics",
          key: "id",
        },
      },
      genreId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
          model: "genres",
          key: "id",
        },
      },
      id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
      comicId: { type: DataTypes.INTEGER, allowNull: false },
      genreId: { type: DataTypes.INTEGER, allowNull: false },
      createdAt: DataTypes.DATE,
      updatedAt: DataTypes.DATE,
      deletedAt: DataTypes.DATE,
    },
    {
      sequelize,
      modelName: "ComicGenre",
      tableName: "comic_genre",
      timestamps: true,
      paranoid: true,
    }
  );
  return ComicGenre;
};
