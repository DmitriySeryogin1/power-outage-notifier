import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import http from 'http';
import 'dotenv/config';

puppeteer.use(StealthPlugin());

const GROUP = 'GPV6.2'; // your group here

const server = http.createServer((req, res) => {
    res.writeHead(200);
    res.end('Monitoring bot is alive');
});
server.listen(process.env.PORT || 3000);

let currentScheduleFromMessage = null;
let currentScheduleFromTable = null;

async function getRawHtml() {
    const URL = 'https://www.dtek-kem.com.ua/ua/shutdowns';

    const browser = await puppeteer.launch();

    try {
        const page = await browser.newPage();

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

async function getDataFromTextMessage() {
    const URL = 'https://www.dtek-kem.com.ua/ua/shutdowns';

    const browser = await puppeteer.launch();

    const page = await browser.newPage();

    console.log('Loading json data...');
    const res = await page.goto(URL);

    const requestHeaders = res.request().headers();
    const csrfToken = await page.$eval('meta[name=csrf-token]', el => el.content);

    const json = await page.evaluate(async (csrfToken, cookie) => {
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

        const text = await response.text();

        try {
            return JSON.parse(text);
        } catch {
            return {error: 'Non-JSON response', raw: text};
        }
    }, csrfToken, requestHeaders.cookie);

    await browser.close();

    return json;
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
    const newSchedule = {};

    Object.keys(parsed.data).forEach((dateTimestamp, i) => {
        newSchedule[dateTimestamp] = [];
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
                        newSchedule[dateTimestamp].push(currentPeriod);
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
                    newSchedule[dateTimestamp].push(currentPeriod);
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

    message = 'Из таблицы:\n' + message;

    return {message, newSchedule};
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
                parse_mode: 'HTML',
            }),
        });

        console.log(`Notification sent`);
    } catch (err) {
        console.error('Telegram send failed:', err);
    }
}

async function main() {
    console.log('Checking power outages...');

    try {
        const html = await getRawHtml();
        const parsed = await parseScheduleFromHtml(html);

        let {message, newSchedule} = formatScheduleToMessage(parsed);

        let shouldNotify = !currentScheduleFromTable;

        if (currentScheduleFromTable) {
            shouldNotify = JSON.stringify(currentScheduleFromTable) !== JSON.stringify(currentScheduleFromTable);

            if (shouldNotify) {
                currentScheduleFromTable = newSchedule;
            } else {
                message = '';
            }
        } else {
            currentScheduleFromTable = newSchedule;
            shouldNotify = true;
        }

        const json = await getDataFromTextMessage();

        if (!json.error) {
            const myHouseData = json.data["23/15"];

            const dates = {
                sub_type: myHouseData.sub_type,
                start_date: myHouseData.start_date,
                end_date: myHouseData.end_date
            };

            const additionalMessage = `\n\nИз сообщения:\n${myHouseData.sub_type}\n${dates.start_date} - ${dates.end_date}`;

            if (currentScheduleFromMessage) {
                if (JSON.stringify(currentScheduleFromMessage) !== JSON.stringify(dates)) {
                    currentScheduleFromMessage = dates;
                    message += `\n${additionalMessage}`;
                    shouldNotify = true;
                }
            } else {
                currentScheduleFromMessage = dates;
                message += additionalMessage;
                shouldNotify = true;
            }
        }

        if (shouldNotify) {
            console.log('Sending notification');

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

const keepAlive = () => {
    fetch('https://power-outage-notifier-976l.onrender.com').catch(() => {
    });
};

main();

setInterval(keepAlive, 10 * 60 * 1000);
setInterval(main, 5 * 60 * 1000);