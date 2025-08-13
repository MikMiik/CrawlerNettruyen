const { Cluster } = require("puppeteer-cluster");
const { Genre, Comic, Author, ComicGenre } = require("./src/models");
const { default: slugify } = require("slugify");

const fs = require("fs");
const errorFile = "./error_urls.txt";

const startCrawling = async (urlsIds, retryCount = 0) => {
  const cluster = await Cluster.launch({
    concurrency: Cluster.CONCURRENCY_CONTEXT,
    maxConcurrency: 5,
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
    let retry = 0;
    let success = false;
    while (retry < 3 && !success) {
      const sequelize = require("./src/models").sequelize;
      const transaction = await sequelize.transaction();
      try {
        try {
          await page.goto(url, {
            waitUntil: "load",
            timeout: 15000,
          });
        } catch (gotoErr) {
          await transaction.rollback();
          retry++;
          if (retry >= 3) {
            const errorLine = `${id}|${url}\n`;
            fs.appendFileSync(errorFile, errorLine);
          }
          continue;
        }
        await page.waitForSelector(".detail-info", { timeout: 7000 });

        // otherName
        const otherName = await page.$$eval(
          ".detail-info .othername .other-name",
          (els) => (els.length ? els[0].innerText.trim() : null)
        );

        // status
        const status = await page.$eval(
          ".detail-info .status .col-xs-8",
          (el) => el.innerText.trim()
        );

        //content
        const content = await page.$eval(
          ".detail-content div[style*='font-weight: bold']",
          (el) => el.nextElementSibling.innerText.trim()
        );

        await Comic.update(
          { otherName, status, content },
          { where: { originalUrl: url }, transaction }
        );

        // authorName
        const authorName = await page.$eval(
          ".detail-info .author .col-xs-8",
          (el) => el.innerText.trim()
        );
        if (
          !["Đang cập nhật", "Đang Cập Nhật", "Unknown"].includes(authorName)
        ) {
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
        let retry = 0;
        let success = false;
        while (retry < 3 && !success) {
          const sequelize = require("./src/models").sequelize;
          const transaction = await sequelize.transaction();
          try {
            try {
              await page.goto(url, {
                waitUntil: "load",
                timeout: 25000,
              });
            } catch (gotoErr) {
              await transaction.rollback();
              if (
                gotoErr.name === "TargetCloseError" ||
                String(gotoErr).includes("Target closed")
              ) {
                try {
                  await page.close();
                } catch {}
                await new Promise((r) => setTimeout(r, 2000));
              }
              retry++;
              if (retry >= 3) {
                const errorLine = `${id}|${url}\n`;
                fs.appendFileSync(errorFile, errorLine);
              }
              continue;
            }
            await page.waitForSelector(".detail-info", { timeout: 7000 });

            // otherName
            const otherName = await page.$$eval(
              ".detail-info .othername .other-name",
              (els) => (els.length ? els[0].innerText.trim() : null)
            );

            // status
            const status = await page.$eval(
              ".detail-info .status .col-xs-8",
              (el) => el.innerText.trim()
            );

            //content
            const content = await page.$eval(
              ".detail-content div[style*='font-weight: bold']",
              (el) => el.nextElementSibling.innerText.trim()
            );

            await Comic.update(
              { otherName, status, content },
              { where: { originalUrl: url }, transaction }
            );

            // authorName
            const authorName = await page.$eval(
              ".detail-info .author .col-xs-8",
              (el) => el.innerText.trim()
            );
            if (
              !["Đang cập nhật", "Đang Cập Nhật", "Unknown"].includes(
                authorName
              )
            ) {
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
            const genres = await page.$eval(
              ".detail-info .kind .col-xs-8",
              (el) =>
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
            success = true;
          } catch (error) {
            if (typeof transaction.rollback === "function")
              await transaction.rollback();
            if (
              error.name === "TargetCloseError" ||
              String(error).includes("Target closed")
            ) {
              try {
                await page.close();
              } catch {}
              await new Promise((r) => setTimeout(r, 2000));
            }
            console.error("Lỗi khi lấy details:", error);
            retry++;
            if (retry >= 3) {
              const errorLine = `${id}|${url}\n`;
              fs.appendFileSync(errorFile, errorLine);
            }
          }
        }
      } catch (error) {
        if (typeof transaction.rollback === "function")
          await transaction.rollback();
        if (
          error.name === "TargetCloseError" ||
          String(error).includes("Target closed")
        ) {
          try {
            await page.close();
          } catch {}
          await new Promise((r) => setTimeout(r, 2000));
        }
        console.error("Lỗi khi lấy details:", error);
        retry++;
        if (retry >= 3) {
          const errorLine = `${id}|${url}\n`;
          fs.appendFileSync(errorFile, errorLine);
        }
      }
    }
  });

  urlsIds.forEach((urlId) =>
    cluster.queue({ id: urlId.id, url: urlId.originalUrl })
  );

  await cluster.idle();
  await cluster.close();
};

(async () => {
  // Xóa file lỗi cũ nếu có
  if (fs.existsSync(errorFile)) fs.unlinkSync(errorFile);
  const urlsIds = await Comic.findAll({
    attributes: ["id", "originalUrl"],
  });
  await startCrawling(urlsIds);
})();
