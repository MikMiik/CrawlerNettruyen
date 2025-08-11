const { Cluster } = require("puppeteer-cluster");

(async () => {
  const cluster = await Cluster.launch({
    concurrency: Cluster.CONCURRENCY_CONTEXT,
    maxConcurrency: 100,
    puppeteerOptions: {
      headless: false,
      defaultViewport: false,
    },
  });
  cluster.on("taskerror", (err, data) => {
    console.log(`Error crawling ${data}: ${err.message}`);
  });

  await cluster.task(async ({ page, data: url }) => {});

  cluster.queue("http://www.google.com/");
  cluster.queue("http://www.wikipedia.org/");
  // many more pages

  await cluster.idle();
  await cluster.close();
})();
