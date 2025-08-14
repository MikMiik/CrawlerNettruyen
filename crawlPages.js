const { Cluster } = require("puppeteer-cluster");
const { Chapter, Page } = require("./src/models");

const fs = require("fs");
const getRandomUserAgent = require("./utils/getRandomUserAgent");
const detailPagesFile = "./detail_pages.txt";

const puppeteerExtra = require("puppeteer-extra");
const StealthPlugin = require("puppeteer-extra-plugin-stealth");
const downloadImage = require("./utils/downloadImage");
puppeteerExtra.use(StealthPlugin());

const scrollToBottom = async (page, step = 400, delay = 10) => {
  await page.evaluate(
    async (step, delay) => {
      const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

      let totalHeight = 0;
      let distance = step;

      while (totalHeight < document.body.scrollHeight) {
        window.scrollBy(0, distance);
        totalHeight += distance;
        await sleep(delay);
      }
    },
    step,
    delay
  );
};

const startCrawling = async (urlsIds) => {
  const cluster = await Cluster.launch({
    concurrency: Cluster.CONCURRENCY_PAGE,
    maxConcurrency: 5,
    puppeteer: puppeteerExtra,
    puppeteerOptions: {
      headless: true,
      defaultViewport: false,
    },
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
  // Bắt lỗi trong cluster và thoát tiến trình để pm2 restart lại toàn bộ file
  cluster.on("taskerror", (err, data) => {
    console.log(`Error crawling: ${err.message}`);
    process.exit(1);
  });

  await cluster.task(async ({ page, data: { id, url, comicId } }) => {
    console.log(`Crawling URL: ${url} with ID: ${id}`);
    await page.setUserAgent(getRandomUserAgent());
    try {
      // Navigate the page to a URL.
      try {
        await page.goto(url, {
          waitUntil: "load",
          timeout: 15000,
        });
      } catch (gotoErr) {
        console.error(`Error navigating to ${url}:`, gotoErr);
        process.exit(1);
      }
      await scrollToBottom(page);
      await page.waitForNetworkIdle({ idleTime: 2000, timeout: 30000 });
      await page.waitForSelector(".reading-detail.box_doc", { timeout: 7000 });

      const pages = await page.$$eval(
        ".reading-detail.box_doc .page-chapter img",
        (elements) =>
          elements.map((el) => ({
            imageUrl: el.getAttribute("data-src"),
          }))
      );
      // Đảm bảo các trường imageUrl và chapterId được cập nhật đúng
      const updatedPages = await Promise.all(
        pages.map(async (pageData) => {
          const thumbPath = `/uploads/pages/${
            pageData.imageUrl.split("/nettruyen/")[1]
          }`;
          const dir = `.${thumbPath}`.split("/").slice(0, -1).join("/");
          if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
          }
          await downloadImage(
            pageData.imageUrl,
            `.${thumbPath}`,
            "https://nettruyenvia.com/"
          );
          return {
            ...pageData,
            imageUrl: thumbPath,
            chapterId: id,
            comicId,
          };
        })
      );

      await Page.bulkCreate(updatedPages, {
        updateOnDuplicate: ["imageUrl", "chapterId", "comicId"],
      });

      console.log(`Crawled successfully: ${url}`);

      if (fs.existsSync(detailPagesFile)) {
        let arr = JSON.parse(fs.readFileSync(detailPagesFile, "utf8"));
        arr = arr.filter((item) => !(item.id === id && item.url === url));
        fs.writeFileSync(detailPagesFile, JSON.stringify(arr, null, 2));
      }
    } catch (error) {
      console.error("Lỗi khi lấy chapters:", error);
      process.exit(1);
    }
  });

  urlsIds.forEach((urlId) =>
    cluster.queue({
      id: urlId.id,
      url: urlId.url,
      comicId: urlId.comicId,
    })
  );

  await cluster.idle();
  await cluster.close();
};

(async () => {
  let urlsIds = [];
  if (fs.existsSync(detailPagesFile)) {
    // Đọc từ file nếu đã tồn tại
    try {
      urlsIds = JSON.parse(fs.readFileSync(detailPagesFile, "utf8"));
    } catch (e) {
      console.error("Lỗi đọc file detail_chapters.txt:", e);
      process.exit(1);
    }
  } else {
    // Lấy từ DB, ghi ra file
    urlsIds = await Chapter.findAll({
      attributes: ["id", "url", "comicId"],
      raw: true,
    });
    fs.writeFileSync(detailPagesFile, JSON.stringify(urlsIds, null, 2));
  }
  await startCrawling(urlsIds);
})();

process.on("unhandledRejection", (err) => {
  if (String(err).includes("TimeoutError")) {
    console.error("Timeout! Đang chạy lại từ url đã lưu...");
    process.exit(1);
  }
});
