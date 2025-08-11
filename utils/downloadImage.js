const axios = require("axios");
const fs = require("fs");

async function downloadImage(url, filePath, referer) {
  try {
    const response = await axios({
      url,
      method: "GET",
      responseType: "stream",
      headers: {
        Referer: referer,
      },
    });

    response.data.pipe(fs.createWriteStream(filePath));
    return new Promise((resolve, reject) => {
      response.data.on("end", () => resolve(filePath));
      response.data.on("error", (err) => reject(err));
    });
  } catch (err) {
    console.error(`Error downloading ${url}: ${err.message}`);
    throw err;
  }
}
module.exports = downloadImage;
