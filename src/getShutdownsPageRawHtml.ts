import puppeteer from "puppeteer-extra";
import {Browser, Page} from "puppeteer";

export default async function getShutdownsPageRawHtml(): Promise<string> {
    const URL = 'https://www.dtek-kem.com.ua/ua/shutdowns';

    const browser: Browser = await puppeteer.launch({
        headless: true,
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-gpu',
            '--single-process',
            '--no-zygote',
        ],
        timeout: 0
    });

    try {
        const page: Page = await browser.newPage();

        console.log('Loading page...');
        await page.goto(URL, {
            waitUntil: 'networkidle2',
            timeout: 60000
        });

        return await page.content();
    } catch (error) {
        throw error;
    } finally {
        await browser.close();
    }
}