const { Cluster } = require("puppeteer-cluster");
const { Genre, Comic, Author, ComicGenre } = require("./src/models");
const { default: slugify } = require("slugify");

const fs = require("fs");
const getRandomUserAgent = require("./utils/getRandomUserAgent");
const errorFile = "./error_urls.txt";

const puppeteerExtra = require("puppeteer-extra");
const StealthPlugin = require("puppeteer-extra-plugin-stealth");
puppeteerExtra.use(StealthPlugin());

const startCrawling = async (urlsIds, retryCount = 0) => {
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
  cluster.on("taskerror", (err, data) => {
    console.log(`Error crawling ${data}: ${err.message}`);
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
        return;
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
    } catch (error) {
      await transaction.rollback();
      console.error("Lỗi khi lấy details:", error);
    }
  });

  urlsIds.forEach((urlId) =>
    cluster.queue({ id: urlId.id, url: urlId.originalUrl })
  );

  await cluster.idle();
  await cluster.close();
};

(async () => {
  const urlsIds = await Comic.findAll({
    attributes: ["id", "originalUrl"],
  });

  await startCrawling(urlsIds);
})();
