const { Chapter } = require("./src/models"); // Sequelize model

async function saveAllToDb() {
  try {
    urlsIds = await Chapter.findAll({
      attributes: ["id", "url", "comicId", "chapterIndex"],
      where: {
        comicId: [
          86, 53, 81, 51, 20, 40, 43, 34, 53, 23, 29, 16, 29, 46, 13, 16, 38, 3,
          45, 41,
        ],
      },
      raw: true,
    });
    console.log(urlsIds);
  } catch (err) {
    console.error("❌ Error:", err);
  }
}

saveAllToDb();
