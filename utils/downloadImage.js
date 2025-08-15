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
      responseType: "arraybuffer",
      headers: {
        Referer: referer,
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36",
      },
      validateStatus: (status) => status >= 200 && status < 300, // chỉ nhận ảnh thành công
    });

    const buffer = Buffer.from(response.data);
    const contentType = response.headers["content-type"] || "";
    if (buffer.length === 0) {
      console.log(`Ảnh ${url} không có dữ liệu, có thể bỏ qua.`);
      return null;
    }
    if (!contentType.startsWith("image/")) {
      console.error(
        `Error downloading ${url}: Content-Type is not image (${contentType})`
      );
      return null;
    }

    const parsed = path.parse(filePath);
    const webpPath = path.join(parsed.dir, parsed.name + ".webp");

    let optimizedBuffer;
    try {
      optimizedBuffer = await sharp(buffer)
        .resize({ width: 2000, withoutEnlargement: true }) // Không phóng to ảnh nhỏ
        .webp({ quality: 75 })
        .toBuffer();
    } catch (sharpErr) {
      console.error(
        `Error processing image with sharp for ${url}: ${sharpErr.message}`
      );
      return null;
    }

    // Lưu file
    fs.writeFileSync(webpPath, optimizedBuffer);
    console.log(`Đã tải và lưu ảnh thành công: ${webpPath}`);

    return webpPath;
  } catch (err) {
    console.error(`Error downloading ${url}: ${err.message}`);
    // Nếu lỗi 404 hoặc không tải được ảnh thì bỏ qua, không throw
    return null;
  }
}
module.exports = downloadImage;
