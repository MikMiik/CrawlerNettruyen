const Nightmare = require("nightmare");
const nightmare = Nightmare({ show: false });
const { Comic } = require("./models");

const downloadImage = require("./utils/downloadImage");
const getRandomUserAgent = require("./utils/getRandomUserAgent");

let page = 3;

function start() {
    nightmare
        .useragent(getRandomUserAgent())
        .goto(`https://nettruyenvia.com/tim-truyen?page=${page}`)
        .wait(".items .item")
        .evaluate(() => {
            return [...document.querySelectorAll(".items .item")].map(
                (item) => {
                    const slugs = item
                        .querySelector(".image > a")
                        .href.split("/");
                    return {
                        name: item.querySelector("h3").innerText,
                        slug: slugs[slugs.length - 1],
                        thumbnail: item
                            .querySelector(".image > a img")
                            .getAttribute("data-original"),
                        originalUrl: item.querySelector(".image > a").href,
                    };
                }
            );
        })
        // .end()
        .then(async (comics) => {
            for (let comic of comics) {
                const thumbPath = `/uploads/thumbnails/${comic.thumbnail
                    .split("/")
                    .at(-1)}`;

                await downloadImage(
                    comic.thumbnail,
                    `.${thumbPath}`,
                    "https://nettruyenvia.com/"
                );

                const existComic = await Comic.findOne({
                    where: { slug: comic.slug },
                });
                const data = {
                    ...comic,
                    thumbnail: thumbPath,
                };
                if (existComic) {
                    await existComic.update(data);
                } else {
                    await Comic.create(data);
                }
            }
        })
        .catch((error) => {
            console.error("Search failed:", error);
        })
        .finally(() => {
            page++;
            start();
        });
}

start();
