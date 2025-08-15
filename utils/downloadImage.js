const axios = require("axios");
const fs = require("fs");
const path = require("path");
const sharp = require("sharp");

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

    if (!/^image\//.test(response.headers["content-type"] || "")) {
      console.warn(`Invalid image type for ${url}`);
      return null;
    }

    const webpPath = filePath.replace(/\.[^/.]+$/, ".webp");

    await new Promise((resolve, reject) => {
      response.data
        .pipe(
          sharp()
            .resize({ width: 2000, withoutEnlargement: true })
            .webp({ quality: 75 })
        )
        .pipe(fs.createWriteStream(webpPath))
        .on("finish", resolve)
        .on("error", reject);
    });

    return webpPath;
  } catch (err) {
    console.error(`Error downloading ${url}: ${err.message}`);
    // Nếu lỗi 404 hoặc không tải được ảnh thì bỏ qua, không throw
    return null;
  }
}
module.exports = downloadImage;
