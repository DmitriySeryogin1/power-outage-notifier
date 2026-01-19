import puppeteer from "puppeteer-extra";
import {PowerOutagePerHouseData} from "./interfaces";

export default async function getJsonDataFromTextMessage(): Promise<PowerOutagePerHouseData> {
    const URL = 'https://www.dtek-kem.com.ua/ua/shutdowns';

    const browser = await puppeteer.launch({
        headless: true,
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-gpu',
            '--single-process',
            '--no-zygote',
        ],
    });

    const page = await browser.newPage();

    console.log('Loading json data...');
    const res = await page.goto(URL);

    const requestHeaders = res!.request().headers();
    const csrfToken: string = await page.$eval('meta[name=csrf-token]', el => el.content);

    if (!csrfToken) {
        throw new Error('Could not find csrf token');
    }

    const json: PowerOutagePerHouseData = await page.evaluate(
        async (csrfToken, cookie) => {
            const body = new URLSearchParams();
            body.append('method', 'getHomeNum');
            body.append('data[0][name]', 'street');
            body.append('data[0][value]', 'вул. Клавдіївська');
            body.append('data[1][name]', 'updateFact');
            body.append('data[1][value]', new Date().toLocaleDateString('uk-UA'));

            document.cookie = 'Domain=dtek-kem.com.ua;\n' + cookie;

            const response = await fetch('https://www.dtek-kem.com.ua/ua/ajax', {
                method: 'POST',
                headers: {
                    'accept': 'application/json, text/javascript, */*; q=0.01',
                    'content-type': 'application/x-www-form-urlencoded; charset=UTF-8',
                    'x-requested-with': 'XMLHttpRequest',
                    'x-csrf-token': csrfToken,
                },
                body: body.toString(),
            });

            const data = await response.json();
            return data;
        },
        csrfToken,
        requestHeaders.cookie || ''
    );

    await browser.close();

    if (!json) {
        throw new Error('JSON is not received');
    }

    return json;
}

