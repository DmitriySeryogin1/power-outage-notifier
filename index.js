import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import http from 'http';
import 'dotenv/config';
import {readFile, writeFile} from 'fs/promises';

puppeteer.use(StealthPlugin());

const URL = 'https://www.dtek-kem.com.ua/ua/shutdowns';
const GROUP = 'GPV6.2'; // ← your group here

const server = http.createServer((req, res) => {
    res.writeHead(200);
    res.end('Monitoring bot is alive');
});
server.listen(process.env.PORT || 4000);

async function getCurrentSchedule() {
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
    });

    try {
        const page = await browser.newPage();

        await page.setUserAgent(
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
            '(KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'
        );

        console.log('Loading page...');
        await page.goto(URL, {waitUntil: 'networkidle2', timeout: 45000});

        // Wait for the critical data object to appear
        console.log('Waiting for DisconSchedule...');

        await page.waitForFunction(
            (varName) => {
                return typeof window[varName] === 'object' && window[varName] !== null;
            },
            {timeout: 30000},
            'DisconSchedule'
        );

        const rawData = await page.evaluate((group) => {
            if (!window.DisconSchedule?.fact?.data) {
                return null;
            }

            return window.DisconSchedule.fact.data[group] || null;
        }, GROUP);

        if (!rawData) {
            throw new Error(`Group ${GROUP} not found in DisconSchedule.fact.data`);
        }

        return rawData; // { "1735689600": { "0": "yes", "1": "no", ... }, ... }
    } finally {
        await browser.close();
    }
}

function formatScheduleToMessage(scheduleData) {
    let message = '';
    const currentSchedule = {}; // for comparison later

    Object.entries(scheduleData).forEach(([timestampStr, hoursData], dateIndex) => {
        const timestamp = Number(timestampStr);
        const date = new Date(timestamp * 1000);

        const uaDate = new Intl.DateTimeFormat('uk-UA', {
            day: 'numeric',
            month: 'long',
            year: 'numeric',
        }).format(date);

        if (dateIndex > 0) message += '\n\n';
        message += uaDate;

        currentSchedule[timestampStr] = [];

        let assigningNewPeriod = false;
        let currentPeriod = '';
        let isStartOfPeriodInitialized = false;

        const hours = Object.keys(hoursData)
            .map(Number)
            .sort((a, b) => a - b);

        for (let i = 0; i < hours.length; i++) {
            const hour = hours[i];
            const status = hoursData[hour];

            if (status === 'no' || status === 'first' || status === 'second') {
                if (!assigningNewPeriod) {
                    assigningNewPeriod = true;
                    message += '\n';
                }

                if (!isStartOfPeriodInitialized) {
                    isStartOfPeriodInitialized = true;

                    let startTime;
                    if (status === 'second' || status === 'first') {
                        startTime = `${hour - 1}:30`;
                    } else {
                        startTime = `${hour}`;
                    }

                    currentPeriod = startTime + '-';
                    message += startTime + '-';
                }

                // Check if this is the end of period
                const nextHour = hours[i + 1];
                const isLast = i === hours.length - 1;
                const nextIsOff = isLast || hoursData[nextHour] === 'yes';

                if (nextIsOff) {
                    let endTime;
                    if (status === 'second' || status === 'first') {
                        endTime = `${hour - 1}:30`;
                    } else {
                        endTime = `${hour}`;
                    }

                    message += endTime;
                    currentPeriod += endTime;
                    currentSchedule[timestampStr].push(currentPeriod);

                    // reset
                    assigningNewPeriod = false;
                    isStartOfPeriodInitialized = false;
                    currentPeriod = '';
                }
            } else {
                // light on → reset period
                assigningNewPeriod = false;
                isStartOfPeriodInitialized = false;
                currentPeriod = '';
            }
        }
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
        await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({
                chat_id: chatId,
                text,
                parse_mode: 'HTML', // optional
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
        const scheduleData = await getCurrentSchedule();

        const {message, currentSchedule} = formatScheduleToMessage(scheduleData);

        let stored = null;
        try {
            const content = await readFile('schedule.json', 'utf-8');
            stored = JSON.parse(content);
        } catch {
            // first run
        }

        let shouldNotify = !stored;

        if (stored) {
            // simple deep compare (can be improved)
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

// Keep alive on render.com / fly.io etc.
const keepAlive = () => {
    fetch('https://power-outage-notifier-976l.onrender.com').catch(() => {
    });
};

main(); // first run

setInterval(keepAlive, 10 * 60 * 1000);
setInterval(main, 5 * 60 * 1000);