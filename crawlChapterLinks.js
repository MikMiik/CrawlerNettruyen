const { Cluster } = require("puppeteer-cluster");
const { Chapter, Comic } = require("./src/models");
const { default: slugify } = require("slugify");

const fs = require("fs");
const getRandomUserAgent = require("./utils/getRandomUserAgent");
const detailChaptersFile = "./detail_chapters.txt";

const puppeteerExtra = require("puppeteer-extra");
const StealthPlugin = require("puppeteer-extra-plugin-stealth");
puppeteerExtra.use(StealthPlugin());

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

  await cluster.task(async ({ page, data: { id, url } }) => {
    console.log(`Crawling URL: ${url} with ID: ${id}`);
    await page.setUserAgent(getRandomUserAgent());
    try {
      // Navigate the page to a URL.
      try {
        await page.goto(url, {
          waitUntil: "load",
          timeout: 5000,
        });
      } catch (gotoErr) {
        console.error(`Error navigating to ${url}:`, gotoErr);
        process.exit(1);
      }

      await page.waitForSelector("#chapter_list", { timeout: 5000 });
      while (true) {
        // Kiểm tra nút "Xem thêm" còn tồn tại không
        const viewMore = await page.$(".view-more");
        if (!viewMore) {
          console.log("✅ Không còn nút 'Xem thêm', đã load hết chapters.");
          break;
        }

        // Đếm số lượng chapter hiện tại
        const beforeCount = await page.$$eval(
          "#chapter_list .chapter",
          (els) => els.length
        );
        console.log(
          `📌 Số chapter hiện tại: ${beforeCount} → Click 'Xem thêm'...`
        );

        // Click nút
        await page.evaluate((el) => el.click(), viewMore);

        // Chờ số chapter tăng
        const increased = await page
          .waitForFunction(
            (count) =>
              document.querySelectorAll("#chapter_list .chapter").length >
              count,
            { timeout: 3000 },
            beforeCount
          )
          .catch(() => false);

        if (!increased) {
          console.log("⚠️ Không load thêm chapter mới, dừng vòng lặp.");
          break;
        }
      }

      const chapterLinks = await page.$$eval(
        "#chapter_list .chapter > a",
        (links) =>
          links.map((link) => ({
            title: link.innerText.trim(),
            slug: link.innerText.trim(),
            url: link.href,
            chapterIndex: link.innerText.match(/[\d.]+/)[0],
            releaseDate: new Date().toISOString(),
          }))
      );

      const chapterLinksWithId = chapterLinks.map((item) => ({
        ...item,
        comicId: id,
        slug: slugify(item.title, { lower: true }),
        url: item.url.startsWith("http")
          ? item.url
          : `https://nettruyenvia.com${item.url}`,
      }));

      await Chapter.bulkCreate(chapterLinksWithId, {
        updateOnDuplicate: ["title", "slug", "url", "chapterIndex"],
      });

      console.log(`Crawled successfully: ${url}`);

      if (fs.existsSync(detailChaptersFile)) {
        let arr = JSON.parse(fs.readFileSync(detailChaptersFile, "utf8"));
        arr = arr.filter(
          (item) => !(item.id === id && item.originalUrl === url)
        );
        fs.writeFileSync(detailChaptersFile, JSON.stringify(arr, null, 2));
      }
    } catch (error) {
      console.error("Lỗi khi lấy chapters:", error);
      process.exit(1);
    }
  });

  urlsIds.forEach((urlId) =>
    cluster.queue({
      id: urlId.id,
      url: urlId.originalUrl,
    })
  );

  await cluster.idle();
  await cluster.close();
};

(async () => {
  let urlsIds = [];
  if (fs.existsSync(detailChaptersFile)) {
    // Đọc từ file nếu đã tồn tại
    try {
      urlsIds = JSON.parse(fs.readFileSync(detailChaptersFile, "utf8"));
    } catch (e) {
      console.error("Lỗi đọc file detail_chapters.txt:", e);
      process.exit(1);
    }
  } else {
    // Lấy từ DB, ghi ra file
    urlsIds = await Comic.findAll({
      attributes: ["id", "originalUrl"],
      raw: true,
    });
    fs.writeFileSync(detailChaptersFile, JSON.stringify(urlsIds, null, 2));
  }
  await startCrawling(urlsIds);
})();

process.on("unhandledRejection", (err) => {
  if (String(err).includes("TimeoutError")) {
    console.error("Timeout! Đang chạy lại từ url đã lưu...");
    process.exit(1);
  }
});
