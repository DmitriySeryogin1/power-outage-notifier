import puppeteer from "puppeteer-extra";
import {Browser, Page} from "puppeteer";

export default async function getShutdownsPageRawHtml(): Promise<string> {
    const URL = 'https://www.dtek-kem.com.ua/ua/shutdowns';

    const browser: Browser = await puppeteer.launch();

    try {
        const page: Page = await browser.newPage();

        console.log('Loading page...');
        await page.goto(URL);

        return await page.content();
    } finally {
        await browser.close();
    }
}