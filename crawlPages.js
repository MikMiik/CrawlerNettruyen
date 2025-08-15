const { Cluster } = require("puppeteer-cluster");
const { Chapter, Page } = require("./src/models");

const fs = require("fs");
const getRandomUserAgent = require("./utils/getRandomUserAgent");
const detailPagesFile = "./detail_pages.txt";

const puppeteerExtra = require("puppeteer-extra");
const StealthPlugin = require("puppeteer-extra-plugin-stealth");
const downloadImage = require("./utils/downloadImage");
puppeteerExtra.use(StealthPlugin());

const scrollToBottom = async (page, step = 200, delay = 20) => {
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
    // Hàm ghi lỗi vào error_pages.txt, không trùng lặp
    const saveErrorPage = async () => {
      const errorFile = "./error_pages.txt";
      let arr = [];
      if (fs.existsSync(errorFile)) {
        try {
          arr = JSON.parse(fs.readFileSync(errorFile, "utf8"));
        } catch {}
      }
      if (!arr.some((e) => e.id === id && e.url === url)) {
        arr.push({ id, url, comicId });
        fs.writeFileSync(errorFile, JSON.stringify(arr, null, 2));
        console.warn(`Đã ghi lỗi vào error_pages.txt: ${url}`);
      }
      // Xóa khỏi detail_pages.txt nếu có
      const detailFile = "./detail_pages.txt";
      if (fs.existsSync(detailFile)) {
        try {
          let detailArr = JSON.parse(fs.readFileSync(detailFile, "utf8"));
          const newArr = detailArr.filter(
            (item) => !(item.id === id && item.url === url)
          );
          if (newArr.length !== detailArr.length) {
            fs.writeFileSync(detailFile, JSON.stringify(newArr, null, 2));
            console.warn(`Đã xóa khỏi detail_pages.txt: ${url}`);
          }
        } catch {}
      }
    };
    try {
      try {
        await page.goto(url, {
          waitUntil: "load",
          timeout: 15000,
        });
      } catch (gotoErr) {
        lastError = gotoErr;
        console.error("Lỗi truy cập", gotoErr.message);
      }

      try {
        await scrollToBottom(page);
        await page.waitForNetworkIdle({ idleTime: 2000, timeout: 15000 });
        await page.waitForSelector(".reading-detail.box_doc", {
          timeout: 5000,
        });

        const pages = await page.$$eval(
          ".reading-detail.box_doc .page-chapter img",
          (elements) =>
            elements.map((el) => ({
              imageUrl: el.getAttribute("data-src"),
            }))
        );

        if (!pages || !Array.isArray(pages) || pages.length === 0) {
          throw new Error(
            "Không lấy được danh sách ảnh hoặc không có ảnh nào."
          );
        }

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
      } catch (err) {
        console.error(`Lỗi khi crawl/lưu ảnh/ghi DB:`, err);
        await saveErrorPage();
        return;
      }
    } catch (error) {
      console.error("Lỗi không xác định khi crawl:", error);
      await saveErrorPage();
      return;
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
  await startCrawling([
    {
      id: 805,
      url: "https://nettruyenvia.com/truyen-tranh/su-tro-lai-cua-phap-su-vi-dai-sau-4000-nam/chapter-217",
      comicId: 5,
    },
    {
      id: 806,
      url: "https://nettruyenvia.com/truyen-tranh/su-tro-lai-cua-phap-su-vi-dai-sau-4000-nam/chapter-216",
      comicId: 5,
    },
    {
      id: 807,
      url: "https://nettruyenvia.com/truyen-tranh/su-tro-lai-cua-phap-su-vi-dai-sau-4000-nam/chapter-215",
      comicId: 5,
    },
    {
      id: 808,
      url: "https://nettruyenvia.com/truyen-tranh/su-tro-lai-cua-phap-su-vi-dai-sau-4000-nam/chapter-214",
      comicId: 5,
    },
  ]);
})();

process.on("unhandledRejection", (err) => {
  if (String(err).includes("TimeoutError")) {
    console.error("Timeout! Đang chạy lại từ url đã lưu...");
    process.exit(1);
  }
});
