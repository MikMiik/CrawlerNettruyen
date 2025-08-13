"use strict";
const { Model } = require("sequelize");
module.exports = (sequelize, DataTypes) => {
  class Page extends Model {
    static associate(models) {
      Page.belongsTo(models.Chapter, { foreignKey: "chapterId" });
    }
  }
  Page.init(
    {
      id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
      chapterId: { type: DataTypes.INTEGER, allowNull: false },
      url: { type: DataTypes.STRING, allowNull: false },
      createdAt: DataTypes.DATE,
      updatedAt: DataTypes.DATE,
      deletedAt: DataTypes.DATE,
    },
    {
      sequelize,
      modelName: "Page",
      tableName: "pages",
      timestamps: true,
      paranoid: true,
    }
  );
  return Page;
};
