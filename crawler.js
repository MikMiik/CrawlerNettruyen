require("module-alias/register");
require("dotenv").config();
const puppeteer = require("puppeteer-extra");
const downloadImage = require("./utils/downloadImage");
const getRandomUserAgent = require("./utils/getRandomUserAgent");
const { Comic } = require("./src/models");
const pLimit = require("p-limit").default;
const StealthPlugin = require("puppeteer-extra-plugin-stealth");
puppeteer.use(StealthPlugin());
const fs = require("fs");

// Đọc số trang hiện tại từ file nếu có
let currentPage = 1;
const pageFile = "./current_page.txt";
if (fs.existsSync(pageFile)) {
  const saved = parseInt(fs.readFileSync(pageFile, "utf8"));
  if (!isNaN(saved) && saved > 0) currentPage = saved;
}

(async () => {
  const browser = await puppeteer.launch({
    headless: true,
    executablePath: process.env.CHROME_PATH || "/usr/bin/google-chrome-stable",
    defaultViewport: false,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-accelerated-2d-canvas",
      "--disable-gpu",
      "--window-size=1920,1080",
      "--disable-blink-features=AutomationControlled",
      "--disable-infobars",
      "--disable-web-security",
      "--disable-features=IsolateOrigins,site-per-process",
      "--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36",
    ],
  });
  const page = await browser.newPage();
  await page.setUserAgent(getRandomUserAgent());

  const limit = pLimit(5);
  // Navigate the page to a URL.
  await page.goto(`https://nettruyenvia.com/tim-truyen?page=${currentPage}`, {
    waitUntil: "load",
    timeout: 30000,
  });

  let isBtnDisabled = false;
  while (!isBtnDisabled) {
    console.log(`Đang crawl page: ${currentPage}`);
    let comics = [];
    let pageSuccess = false;
    try {
      // Lấy thông tin comics
      comics = await page.$$eval(".items .item", (elements) =>
        elements.map((el) => ({
          name: el.querySelector(".jtip")?.innerText,
          originalUrl: el.querySelector(".image > a")?.href,
          slug: el.querySelector(".image > a")?.href.split("/").pop(),
          thumbnail: el
            .querySelector(".image > a > img")
            ?.getAttribute("data-original"),
        }))
      );
      // Lấy ảnh
      await Promise.all(
        comics.map(async (comic) =>
          limit(async () => {
            if (comic.thumbnail) {
              const thumbPath = `/uploads/thumbnails/${comic.thumbnail
                .split("/")
                .at(-1)}`;
              await downloadImage(
                comic.thumbnail,
                `.${thumbPath}`,
                "https://nettruyenvia.com/"
              );
              comic.thumbnail = thumbPath;
              return comic;
            }
          })
        )
      );
      await Comic.bulkCreate(comics, {
        updateOnDuplicate: ["originalUrl", "slug", "thumbnail"],
      });
      pageSuccess = true;
    } catch (error) {
      console.error("Lỗi khi lấy comics:", error);
      pageSuccess = false;
    }
    await page.locator("ul.pagination li.page-item:last-child");

    const is_disabled =
      (await page.$("ul.pagination li.page-item:last-child.disabled")) !== null;

    isBtnDisabled = is_disabled;

    if (!is_disabled && pageSuccess) {
      currentPage++;
      fs.writeFileSync(pageFile, String(currentPage));
      await Promise.all([
        page.click("li.page-item:last-child a[aria-label='Next »']"),
        page.waitForNavigation({ waitUntil: "networkidle2", timeout: 30000 }),
      ]);
    }
  }

  // Xóa file lưu trang khi crawl xong
  if (fs.existsSync(pageFile)) fs.unlinkSync(pageFile);
  await browser.close();
})();

// Bắt lỗi timeout và tự động chạy lại từ trang đã lưu
process.on("unhandledRejection", (err) => {
  if (String(err).includes("TimeoutError")) {
    console.error("Timeout! Đang chạy lại từ trang đã lưu...");
    process.exit(1);
  }
});
