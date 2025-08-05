module.exports = (sequelize, DataTypes) => {
    const Comic = sequelize.define(
        "Comic",
        {
            name: {
                type: DataTypes.STRING(255),
            },
            slug: {
                type: DataTypes.STRING(255),
                unique: true,
            },
            thumbnail: {
                type: DataTypes.STRING(255),
            },
            originalUrl: {
                type: DataTypes.STRING(255),
            },
            crawlStatus: {
                type: DataTypes.STRING(255),
            },
            createdAt: {
                type: DataTypes.DATE,
            },
            updatedAt: {
                type: DataTypes.DATE,
            },
        },
        {
            tableName: "comics",
            timestamps: true,
        }
    );

    Comic.associate = (db) => {
        Comic.belongsToMany(db.Genre, {
            as: "comics",
            through: "genre_comic",
        });
    };

    return Comic;
};
