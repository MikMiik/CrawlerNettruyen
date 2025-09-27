const { Cluster } = require("puppeteer-cluster");
const { Chapter, Page } = require("./src/models");

const fs = require("fs");
const getRandomUserAgent = require("./utils/getRandomUserAgent");
const detailPagesFile = "./detail_pages.txt";

const puppeteerExtra = require("puppeteer-extra");
const StealthPlugin = require("puppeteer-extra-plugin-stealth");
const downloadImage = require("./utils/downloadImage");
const path = require("path");
puppeteerExtra.use(StealthPlugin());

const scrollToBottom = async (page, step = 200, delay = 30) => {
  return await page.evaluate(
    async (step, delay) => {
      const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
      while (window.innerHeight + window.scrollY < document.body.scrollHeight) {
        window.scrollBy(0, step);
        await sleep(delay);
      }
      // Đảm bảo cuộn đúng đáy trang
      window.scrollTo(0, document.body.scrollHeight);
      return true;
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
    timeout: 60000, // 1 phút cho mỗi task
  });
  // Bắt lỗi trong cluster và thoát tiến trình để pm2 restart lại toàn bộ file
  cluster.on("taskerror", (err, data) => {
    console.log(`Error crawling: ${err.message}`);
    process.exit(1);
  });

  await cluster.task(async ({ page, data: { id, url, comicId, chapter } }) => {
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
          timeout: 120000,
        });
      } catch (gotoErr) {
        lastError = gotoErr;
        console.error("Lỗi truy cập", gotoErr.message);
      }

      try {
        let scrolled = false;
        try {
          scrolled = await scrollToBottom(page);
        } catch (err) {
          if (String(err).includes("detached Frame")) {
            console.error("Frame bị detach, bỏ qua url này.");
            await saveErrorPage();
            return;
          }
          throw err;
        }
        if (!scrolled) {
          throw new Error("Chưa cuộn hết trang, dừng crawl!");
        }
        await page.waitForNetworkIdle({ idleTime: 2000, timeout: 120000 });
        await page.waitForSelector(".reading-detail.box_doc", {
          timeout: 120000,
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

        // Download tất cả ảnh với retry, ghi lỗi nếu không thành công
        const imageUrls = [];
        const errorImagesFile = "./error_images.txt";
        await Promise.all(
          pages.map(async (pageData) => {
            const fileName = pageData.imageUrl.split("/").pop();
            const filePath = `${chapterDir}/${fileName}`;
            let success = false;
            let lastError = null;
            for (let attempt = 1; attempt <= 3; attempt++) {
              try {
                await downloadImage(
                  pageData.imageUrl,
                  filePath,
                  "https://nettruyenvia.com/"
                );
                success = true;
                break;
              } catch (err) {
                lastError = err;
                console.warn(
                  `Lỗi download ảnh lần ${attempt}: ${pageData.imageUrl} - ${err.message}`
                );
              }
            }
            if (!success) {
              // Ghi vào file lỗi
              let arr = [];
              if (fs.existsSync(errorImagesFile)) {
                try {
                  arr = JSON.parse(fs.readFileSync(errorImagesFile, "utf8"));
                } catch {}
              }
              arr.push({
                imageUrl: pageData.imageUrl,
                filePath,
                comicId,
                chapter,
                error: lastError ? lastError.message : "Unknown error",
              });
              fs.writeFileSync(errorImagesFile, JSON.stringify(arr, null, 2));
              console.warn(
                `Ghi lỗi download ảnh vào error_images.txt: ${pageData.imageUrl}`
              );
              return; // Không thêm vào imageUrls nếu lỗi
            }
            const dir = path.dirname(filePath);
            if (!fs.existsSync(dir)) {
              fs.mkdirSync(dir, { recursive: true });
            }
            const parsed = path.parse(filePath);
            const newfilePath = path.join(parsed.dir, parsed.name + ".webp");
            imageUrls.push(newfilePath);
          })
        );

        const sortedUrls = imageUrls.sort((a, b) => {
          const numA = parseInt(a.match(/(\d+)\.webp$/)[1], 10);
          const numB = parseInt(b.match(/(\d+)\.webp$/)[1], 10);
          return numA - numB;
        });

        await Page.upsert({
          imageUrl: sortedUrls,
          chapter,
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
      chapter: urlId.chapterIndex,
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
      attributes: ["id", "url", "comicId", "chapterIndex"],
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
