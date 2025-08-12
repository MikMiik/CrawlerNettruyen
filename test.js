const puppeteer = require("puppeteer-extra");

const StealthPlugin = require("puppeteer-extra-plugin-stealth");
puppeteer.use(StealthPlugin());

// puppeteer usage as normal
puppeteer
  .launch({
    headless: false,
    defaultViewport: false,
    executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
    userDataDir: "C:/Users/minh0/AppData/Local/Google/Chrome/User Data",
  })
  .then(async (browser) => {
    console.log("Running tests..");
    const page = await browser.newPage();
    await page.goto("https://bot.sannysoft.com");
    await browser.close();
    console.log(`All done, check the screenshot. ✨`);
  });
