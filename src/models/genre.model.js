"use strict";

const { Model } = require("sequelize");
const { default: slugify } = require("slugify");

module.exports = (sequelize, DataTypes) => {
  class Genre extends Model {
    static associate(models) {
      Genre.belongsToMany(models.Comic, {
        through: models.ComicGenre,
        foreignKey: "genreId",
        otherKey: "comicId",
      });
    }
  }
  Genre.init(
    {
      id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
      name: { type: DataTypes.STRING, allowNull: false, unique: true },
      url: { type: DataTypes.STRING, allowNull: true },
      slug: { type: DataTypes.STRING, allowNull: true, unique: true },
      isActive: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      },
      createdAt: DataTypes.DATE,
      updatedAt: DataTypes.DATE,
      deletedAt: DataTypes.DATE,
    },
    {
      sequelize,
      modelName: "Genre",
      tableName: "genres",
      timestamps: true,
      paranoid: true,
    }
  );

  return Genre;
};
