"use strict";

const { Model } = require("sequelize");

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
      name: { type: DataTypes.STRING, allowNull: false, unique: true },
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
