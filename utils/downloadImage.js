const axios = require("axios");
const fs = require("fs");
const path = require("path");

async function downloadImage(url, filePath, referer) {
  try {
    // Tạo folder nếu chưa tồn tại
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    const response = await axios({
      url,
      method: "GET",
      responseType: "stream",
      headers: {
        Referer: referer,
      },
      validateStatus: (status) => status >= 200 && status < 300, // chỉ nhận ảnh thành công
    });

    response.data.pipe(fs.createWriteStream(filePath));
    return new Promise((resolve, reject) => {
      response.data.on("end", () => resolve(filePath));
      response.data.on("error", (err) => reject(err));
    });
  } catch (err) {
    console.error(`Error downloading ${url}: ${err.message}`);
    // Nếu lỗi 404 hoặc không tải được ảnh thì bỏ qua, không throw
    return null;
  }
}
module.exports = downloadImage;
