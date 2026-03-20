const puppeteer = require('puppeteer');
(async () => {
    try {
        const browser = await puppeteer.launch();
        const page = await browser.newPage();
        await page.setViewport({ width: 1280, height: 960 });
        await page.goto('http://localhost:3000/login.html');

        await page.type('#email', 'admin@aikitchen.com');
        await page.type('#password', 'admin');
        await page.click('button[type="submit"]');

        await page.waitForNavigation();
        await page.waitForSelector('.recipe-card');

        await page.screenshot({ path: 'C:/Users/acer/.gemini/antigravity/brain/387206ec-9065-4d18-bfb9-cae1a9d8d61f/trending_grid_fixed.png' });
        await browser.close();
        console.log('Screenshot saved to trending_grid_fixed.png');
    } catch (e) {
        console.error('Puppeteer failed', e);
    }
})();
