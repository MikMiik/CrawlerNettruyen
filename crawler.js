require("module-alias/register");
require("dotenv").config();
const puppeteer = require("puppeteer");
const downloadImage = require("./utils/downloadImage");
const { Comic } = require("./src/models");

(async () => {
  const browser = await puppeteer.launch({
    headless: false,
    defaultViewport: false,
  });
  const page = await browser.newPage();

  // Navigate the page to a URL.
  await page.goto("https://nettruyenvia.com/tim-truyen", {
    waitUntil: "load",
  });

  let isBtnDisabled = false;

  while (!isBtnDisabled) {
    let comics = [];
    try {
      // Lấy thông tin comics
      comics = await page.$$eval(".items .item", (elements) =>
        elements.map((el) => ({
          name: el.querySelector(".jtip")?.innerText,
          originalUrl: el.querySelector(".image > a")?.href,
          slug: el.querySelector(".image > a")?.href.split("/").pop(),
          thumbnail: el
            .querySelector(".image > a > img")
            ?.getAttribute("data-original"),
        }))
      );
      // Lấy ảnh
      await Promise.all(
        comics.map(async (comic) => {
          if (comic.thumbnail) {
            const thumbPath = `/uploads/thumbnails/${comic.thumbnail
              .split("/")
              .at(-1)}`;
            await downloadImage(
              comic.thumbnail,
              `.${thumbPath}`,
              "https://nettruyenvia.com/"
            );
            comic.thumbnail = thumbPath;
          }
        })
      );
      await Comic.bulkCreate(comics, {
        updateOnDuplicate: ["originalUrl", "slug", "thumbnail"],
      });
    } catch (error) {
      console.error("Lỗi khi lấy comics:", error);
    }
    await page.locator("li.page-item:last-child");

    const is_disabled =
      (await page.locator("li.page-item:last-child.disabled")) !== null;

    isBtnDisabled = is_disabled;
    if (!is_disabled) {
      await Promise.all([
        page.click("li.page-item:last-child a[aria-label='Next »']"),
        page.waitForNavigation({ waitUntil: "networkidle2" }),
      ]);
    }
  }

  await browser.close();
})();
