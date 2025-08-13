"use strict";
const { Model } = require("sequelize");
module.exports = (sequelize, DataTypes) => {
  class Chapter extends Model {
    static associate(models) {
      Chapter.belongsTo(models.Comic, { foreignKey: "comicId" });
      Chapter.hasMany(models.Page, { foreignKey: "chapterId" });
    }
  }
  Chapter.init(
    {
      id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
      comicId: { type: DataTypes.INTEGER, allowNull: false },
      name: { type: DataTypes.STRING, allowNull: false },
      url: { type: DataTypes.STRING, allowNull: true },
      slug: { type: DataTypes.STRING, allowNull: true },
      createdAt: DataTypes.DATE,
      updatedAt: DataTypes.DATE,
      deletedAt: DataTypes.DATE,
    },
    {
      sequelize,
      modelName: "Chapter",
      tableName: "chapters",
      timestamps: true,
      paranoid: true,
    }
  );
  return Chapter;
};
