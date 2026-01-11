import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import http from 'http';
import 'dotenv/config';
import {readFile, writeFile} from 'fs/promises';

puppeteer.use(StealthPlugin());

const URL = 'https://www.dtek-kem.com.ua/ua/shutdowns';
const GROUP = 'GPV6.2'; // your group here

const server = http.createServer((req, res) => {
    res.writeHead(200);
    res.end('Monitoring bot is alive');
});
server.listen(process.env.PORT || 3000);

async function getRawHtml() {
    const browser = await puppeteer.launch({
        headless: 'new',
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-gpu',
            '--single-process',
            '--no-zygote',
        ],
        ignoreHTTPSErrors: true,
    });

    try {
        const page = await browser.newPage();

        await page.setUserAgent(
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'
        );

        console.log('Loading page...');
        await page.goto(URL, {waitUntil: 'networkidle0', timeout: 60000});

        // Wait a bit extra for any late JS
        await new Promise(resolve => setTimeout(resolve, 2000));

        const html = await page.content();

        return html;
    } finally {
        await browser.close();
    }
}

async function parseScheduleFromHtml(html) {
    const startStr = 'DisconSchedule.fact = ';
    const start = html.indexOf(startStr);
    if (start === -1) {
        throw new Error('Could not find DisconSchedule.fact in HTML');
    }

    const adjustedStart = start + startStr.length;
    const end = html.indexOf(',"update"', adjustedStart);
    if (end === -1) {
        throw new Error('Could not find ,"update" terminator in HTML');
    }

    let result = html.substring(adjustedStart, end) + '}';

    try {
        return JSON.parse(result);
    } catch (err) {
        throw new Error(`Failed to parse extracted JSON: ${err.message}`);
    }
}

function formatScheduleToMessage(parsed) {
    let message = '';
    const currentSchedule = {};

    Object.keys(parsed.data).forEach((dateTimestamp, i) => {
        currentSchedule[dateTimestamp] = [];
        const date = new Date(Number(dateTimestamp) * 1000);
        const uaDate = new Intl.DateTimeFormat('uk-UA', {
            day: 'numeric',
            month: 'long',
            year: 'numeric'
        }).format(date);

        if (i > 0) {
            message += '\n\n';
        }
        message += uaDate;

        const myGroupShutdowns = parsed.data[dateTimestamp][GROUP];
        let assigningNewPeriod = false;
        let isStartOfPeriodInitialized = false;
        let currentPeriod = '';

        const hours = Object.keys(myGroupShutdowns);
        hours.forEach((hour, j) => {
            if (myGroupShutdowns[hour] === "no" || myGroupShutdowns[hour] === "second" || myGroupShutdowns[hour] === "first") {
                if (!assigningNewPeriod) {
                    assigningNewPeriod = true;
                    message += '\n';
                }
                if (!isStartOfPeriodInitialized) {
                    isStartOfPeriodInitialized = true;
                    if (myGroupShutdowns[hour] === "second") {
                        currentPeriod = `${hour - 1}:30-`;
                        message += `${hour - 1}:30-`;
                    } else if (myGroupShutdowns[hour] === "first") {
                        currentPeriod = `${hour - 1}:30-`;
                        message += `${hour - 1}:30-`;
                    } else {
                        currentPeriod = `${hour - 1}-`;
                        message += `${hour - 1}-`;
                    }
                    if (!hours[j + 1] || myGroupShutdowns[hours[j + 1]] === "yes") {
                        if (myGroupShutdowns[hour] === "second") {
                            message += `${hour - 1}:30`;
                            currentPeriod += `${hour - 1}:30`;
                        } else if (myGroupShutdowns[hour] === "first") {
                            message += `${hour - 1}:30`;
                            currentPeriod += `${hour - 1}:30`;
                        } else {
                            message += hour;
                            currentPeriod += hour;
                        }
                        currentSchedule[dateTimestamp].push(currentPeriod);
                        assigningNewPeriod = false;
                        isStartOfPeriodInitialized = false;
                        currentPeriod = '';
                    }
                } else if (!hours[j + 1] || myGroupShutdowns[hours[j + 1]] === "yes") {
                    if (myGroupShutdowns[hour] === "second") {
                        message += `${hour - 1}:30`;
                        currentPeriod += `${hour - 1}:30`;
                    } else if (myGroupShutdowns[hour] === "first") {
                        message += `${hour - 1}:30`;
                        currentPeriod += `${hour - 1}:30`;
                    } else {
                        message += hour;
                        currentPeriod += hour;
                    }
                    currentSchedule[dateTimestamp].push(currentPeriod);
                    assigningNewPeriod = false;
                    isStartOfPeriodInitialized = false;
                    currentPeriod = '';
                }
            } else {
                assigningNewPeriod = false;
                isStartOfPeriodInitialized = false;
                currentPeriod = '';
            }
        });
    });

    return {message, currentSchedule};
}

async function sendTelegramNotification(text) {
    const token = process.env.BOT_TOKEN;
    const chatId = '332433737';

    if (!token) {
        console.error('BOT_TOKEN not set in .env');
        return;
    }

    try {
        const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({
                chat_id: chatId,
                text,
                parse_mode: 'HTML',
            }),
        });

        console.log(`Notification sent at ${new Date().toISOString()}`);
    } catch (err) {
        console.error('Telegram send failed:', err);
    }
}

async function main() {
    console.log('Checking power outages...');

    try {
        const html = await getRawHtml();
        const parsed = await parseScheduleFromHtml(html);

        const {message, currentSchedule} = formatScheduleToMessage(parsed);

        let stored = null;
        try {
            const content = await readFile('schedule.json', 'utf-8');
            stored = JSON.parse(content);
        } catch {
            // first run
        }

        let shouldNotify = !stored;

        if (stored) {
            shouldNotify = JSON.stringify(stored) !== JSON.stringify(currentSchedule);
        }

        if (shouldNotify) {
            console.log('Schedule changed → sending notification');
            await writeFile('schedule.json', JSON.stringify(currentSchedule, null, 2));
            if (message.trim()) {
                await sendTelegramNotification(message);
            }
        } else {
            console.log('No changes in schedule');
        }
    } catch (err) {
        console.error('Main error:', err);
    }
}

// Keep alive
const keepAlive = () => {
    fetch('https://power-outage-notifier-976l.onrender.com').catch(() => {
    });
};

main();

setInterval(keepAlive, 10 * 60 * 1000);
setInterval(main, 5 * 60 * 1000);