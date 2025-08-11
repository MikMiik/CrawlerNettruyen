"use strict";

const { Model } = require("sequelize");

module.exports = (sequelize, DataTypes) => {
  class Comic extends Model {
    static associate(models) {
      Comic.belongsToMany(models.Genre, {
        through: models.ComicGenre,
        foreignKey: "comicId",
        otherKey: "genreId",
      });
    }
  }
  Comic.init(
    {
      name: { type: DataTypes.STRING, allowNull: false, unique: true },
      slug: { type: DataTypes.STRING, allowNull: false, unique: true },
      thumbnail: { type: DataTypes.STRING },
      originalUrl: { type: DataTypes.STRING, allowNull: false, unique: true },
      crawlStatus: { type: DataTypes.STRING },
      createdAt: DataTypes.DATE,
      updatedAt: DataTypes.DATE,
      deletedAt: DataTypes.DATE,
    },
    {
      sequelize,
      modelName: "Comic",
      tableName: "comics",
      timestamps: true,
      paranoid: true,
    }
  );
  return Comic;
};
