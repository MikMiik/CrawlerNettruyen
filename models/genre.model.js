module.exports = (sequelize, DataTypes) => {
    const Genre = sequelize.define(
        "Genre",
        {
            name: {
                type: DataTypes.STRING(100),
                allowNull: false,
            },
            createdAt: {
                type: DataTypes.DATE,
                allowNull: true,
            },
            updatedAt: {
                type: DataTypes.DATE,
                allowNull: true,
            },
        },
        {
            tableName: "genres",
            timestamps: true,
        }
    );

    Genre.associate = (db) => {
        Genre.belongsToMany(db.Comic, {
            as: "genres",
            through: "genre_comic",
        });
    };

    return Genre;
};
