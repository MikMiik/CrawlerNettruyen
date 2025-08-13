const { Cluster } = require("puppeteer-cluster");
const { Genre, Comic, Author, ComicGenre } = require("./src/models");
const { default: slugify } = require("slugify");

const fs = require("fs");
const getRandomUserAgent = require("./utils/getRandomUserAgent");
const detailUrlsFile = "./detail_urls.txt";

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
    console.log(`Error crawling ${data}: ${err.message}`);
    process.exit(1);
  });

  await cluster.task(async ({ page, data: { id, url } }) => {
    console.log(`Crawling URL: ${url} with ID: ${id}`);
    await page.setUserAgent(getRandomUserAgent());
    const sequelize = require("./src/models").sequelize;
    const transaction = await sequelize.transaction();
    try {
      // Navigate the page to a URL.
      try {
        await page.goto(url, {
          waitUntil: "load",
          timeout: 15000,
        });
      } catch (gotoErr) {
        await transaction.rollback();
        console.error(`Error navigating to ${url}:`, gotoErr);
        // Thoát tiến trình ngay khi gặp lỗi navigation (timeout, bị chặn, ...)
        process.exit(1);
      }
      await page.waitForSelector(".detail-info", { timeout: 7000 });

      // otherName
      const otherName = await page.$$eval(
        ".detail-info .othername .other-name",
        (els) => (els.length ? els[0].innerText.trim() : null)
      );

      // status
      await page.waitForSelector(".detail-info .status .col-xs-8", {
        timeout: 7000,
      });
      const status = await page.$eval(".detail-info .status .col-xs-8", (el) =>
        el.innerText.trim()
      );

      //content
      await page.waitForSelector(
        ".detail-content div[style*='font-weight: bold']",
        { timeout: 7000 }
      );
      const content = await page.$eval(
        ".detail-content div[style*='font-weight: bold']",
        (el) => el.nextElementSibling.innerText.trim()
      );

      await Comic.update(
        { otherName, status, content },
        { where: { originalUrl: url }, transaction }
      );

      // authorName
      await page.waitForSelector(".detail-info .author .col-xs-8", {
        timeout: 7000,
      });
      const authorName = await page.$eval(
        ".detail-info .author .col-xs-8",
        (el) => el.innerText.trim()
      );
      if (!["Đang cập nhật", "Đang Cập Nhật", "Unknown"].includes(authorName)) {
        const [author] = await Author.upsert(
          {
            name: authorName,
            username: slugify(authorName, { lower: true, strict: true }),
          },
          { where: { name: authorName }, transaction }
        );
        await Comic.update(
          { authorId: author.id },
          { where: { originalUrl: url }, transaction }
        );
      }
      // genre
      await page.waitForSelector(".detail-info .kind .col-xs-8", {
        timeout: 7000,
      });
      const genres = await page.$eval(".detail-info .kind .col-xs-8", (el) =>
        el.innerText
          .trim()
          .split("-")
          .map((s) => s.trim())
      );

      for (const genreName of genres) {
        const [genre] = await Genre.findOrCreate({
          where: { name: genreName },
          transaction,
        });
        await ComicGenre.findOrCreate({
          where: { comicId: id, genreId: genre.id },
          transaction,
        });
      }

      await page.waitForSelector(".detail-content", { timeout: 7000 });

      await transaction.commit();
      console.log(`Crawled successfully: ${url}`);

      // Xóa url/id thành công khỏi file detail_urls.txt
      if (fs.existsSync(detailUrlsFile)) {
        let arr = JSON.parse(fs.readFileSync(detailUrlsFile, "utf8"));
        arr = arr.filter(
          (item) => !(item.id === id && item.originalUrl === url)
        );
        fs.writeFileSync(detailUrlsFile, JSON.stringify(arr, null, 2));
      }
    } catch (error) {
      await transaction.rollback();
      console.error("Lỗi khi lấy details:", error);
      // Thoát tiến trình nếu có lỗi bất kỳ trong task
      process.exit(1);
    }
  });

  urlsIds.forEach((urlId) =>
    cluster.queue({ id: urlId.id, url: urlId.originalUrl })
  );

  await cluster.idle();
  await cluster.close();
};

(async () => {
  let urlsIds = [];
  if (fs.existsSync(detailUrlsFile)) {
    // Đọc từ file nếu đã tồn tại
    try {
      urlsIds = JSON.parse(fs.readFileSync(detailUrlsFile, "utf8"));
    } catch (e) {
      console.error("Lỗi đọc file detail_urls.txt:", e);
      process.exit(1);
    }
  } else {
    // Lấy từ DB, ghi ra file
    urlsIds = await Comic.findAll({
      attributes: ["id", "originalUrl"],
      raw: true,
    });
    fs.writeFileSync(detailUrlsFile, JSON.stringify(urlsIds, null, 2));
  }
  await startCrawling(urlsIds);
})();

// Bắt lỗi promise chưa xử lý ngoài cluster
process.on("unhandledRejection", (err) => {
  console.error("Unhandled rejection:", err);
  process.exit(1);
});
process.on("unhandledRejection", (err) => {
  if (String(err).includes("TimeoutError")) {
    console.error("Timeout! Đang chạy lại từ url đã lưu...");
    process.exit(1);
  }
});

// Bắt lỗi timeout ngoài cluster (rất hiếm khi xảy ra)
process.on("unhandledRejection", (err) => {
  if (String(err).includes("TimeoutError")) {
    console.error("Timeout! Đang chạy lại từ url đã lưu...");
    process.exit(1);
  }
});
