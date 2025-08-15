require("module-alias/register");
require("dotenv").config();
const puppeteer = require("puppeteer-extra");
const getRandomUserAgent = require("./utils/getRandomUserAgent");
const StealthPlugin = require("puppeteer-extra-plugin-stealth");
const { Genre } = require("./src/models");
puppeteer.use(StealthPlugin());

// Đọc số trang hiện tại từ file nếu có

(async () => {
  const browser = await puppeteer.launch({
    headless: true,
    defaultViewport: false,
    userDataDir: "/home/blog-user/puppeteer-cache",
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-accelerated-2d-canvas",
      "--disable-gpu",
      "--disable-blink-features=AutomationControlled",
      "--disable-infobars",
      "--disable-web-security",
      "--disable-features=IsolateOrigins,site-per-process",
    ],
  });
  const page = await browser.newPage();
  await page.setUserAgent(getRandomUserAgent());

  // Navigate the page to a URL.
  try {
    await page.goto(`https://nettruyenvia.com/tim-truyen`, {
      waitUntil: "load",
      timeout: 15000,
    });
    const slugify = require("slugify");
    const genresRaw = await page.$$eval(
      ".box.darkBox.genres ul.nav li > a",
      (elements) =>
        elements.map((el) => ({
          name: el.innerText.trim(),
          url: el.href,
        }))
    );
    const genres = genresRaw.map((g) => ({
      ...g,
      slug: slugify(g.name, { lower: true, strict: true }),
    }));
    await Genre.bulkCreate(genres, { updateOnDuplicate: ["url", "slug"] });
  } catch (error) {
    console.error("Lỗi khi lấy genre:", error);
  }
  await browser.close();
})();
