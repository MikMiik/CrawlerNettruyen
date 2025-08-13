require("module-alias/register");
require("dotenv").config();
const puppeteer = require("puppeteer-extra");
const getRandomUserAgent = require("./utils/getRandomUserAgent");
const StealthPlugin = require("puppeteer-extra-plugin-stealth");
puppeteer.use(StealthPlugin());

// Đọc số trang hiện tại từ file nếu có

(async () => {
  const browser = await puppeteer.launch({
    headless: false,
    defaultViewport: false,
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
  try {
    // Navigate the page to a URL.
    await page.goto(
      `https://nettruyenvia.com/truyen-tranh/toan-cau-bang-phong-ta-che-tao-phong-an-toan-tai-tan-the`,
      {
        waitUntil: "load",
        timeout: 15000,
      }
    );
    await page.waitForSelector(".detail-info", { timeout: 5000 });

    const otherName = await page.$$eval(
      ".detail-info .othername .other-name",
      (els) => (els.length ? els[0].innerText.trim() : null)
    );

    const authorName = await page.$eval(
      ".detail-info .author .col-xs-8",
      (el) => el.innerText.trim()
    );

    const status = await page.$eval(".detail-info .status .col-xs-8", (el) =>
      el.innerText.trim()
    );

    const genre = await page.$eval(".detail-info .kind .col-xs-8", (el) =>
      el.innerText
        .trim()
        .split("-")
        .map((s) => s.trim())
    );

    await page.waitForSelector(".detail-content", { timeout: 5000 });

    const content = await page.$eval(
      ".detail-content div[style*='font-weight: bold']",
      (el) => el.nextElementSibling.innerText.trim()
    );

    console.log({ otherName, authorName, status, genre, content });
  } catch (error) {
    console.error("Lỗi khi lấy details:", error);
  }
  await browser.close();
})();
