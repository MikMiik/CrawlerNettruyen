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
    maxConcurrency: 2,
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
      // Retry page.goto tối đa 2 lần nếu bị timeout
      let gotoSuccess = false;
      let lastError = null;
      for (let attempt = 1; attempt <= 2; attempt++) {
        try {
          await page.goto(url, {
            waitUntil: "load",
            timeout: 40000,
          });
          gotoSuccess = true;
          break;
        } catch (gotoErr) {
          lastError = gotoErr;
          console.error(
            `Lần thử ${attempt} - Error navigating to ${url}:`,
            gotoErr.message
          );
          if (attempt < 2 && String(gotoErr).includes("TimeoutError")) {
            console.log("Thử lại...");
            await new Promise((r) => setTimeout(r, 2000));
          }
        }
      }
      if (!gotoSuccess) {
        console.error(`Không thể truy cập ${url} sau 2 lần thử. Bỏ qua.`);
        return;
      }
      await scrollToBottom(page);
      await page.waitForNetworkIdle({ idleTime: 2000, timeout: 15000 });
      await page.waitForSelector(".reading-detail.box_doc", { timeout: 5000 });

      const pages = await page.$$eval(
        ".reading-detail.box_doc .page-chapter img",
        (elements) =>
          elements.map((el) => ({
            imageUrl: el.getAttribute("data-src"),
          }))
      );

      // Tạo thư mục chứa ảnh cho chapter
      const baseFolder = url.split("/truyen-tranh/")[1];

      const chapterDir = `./uploads/pages/${baseFolder}`;
      if (!fs.existsSync(chapterDir)) {
        fs.mkdirSync(chapterDir, { recursive: true });
      }

      // Download tất cả ảnh với tên file theo thứ tự 0.jpg, 1.jpg, 2.jpg...
      const imageUrls = [];
      await Promise.all(
        pages.map(async (pageData) => {
          const fileName = pageData.imageUrl.split("/").pop();
          const filePath = `${chapterDir}/${fileName}`;

          const newfilePath = await downloadImage(
            pageData.imageUrl,
            filePath,
            "https://nettruyenvia.com/"
          );
          imageUrls.push(newfilePath);
        })
      );

      // Lưu một record duy nhất cho chapter với imageUrl là mảng JSON
      await Page.upsert({
        imageUrl: imageUrls,
        chapterId: id,
        comicId,
      });

      console.log(`Crawled successfully: ${url}`);

      if (fs.existsSync(detailPagesFile)) {
        let arr = JSON.parse(fs.readFileSync(detailPagesFile, "utf8"));
        arr = arr.filter((item) => !(item.id === id && item.url === url));
        fs.writeFileSync(detailPagesFile, JSON.stringify(arr, null, 2));
      }
    } catch (error) {
      console.error("Lỗi khi lấy pages:", error);
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
      console.error("Lỗi đọc file pages.txt:", e);
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
