import fetch from 'node-fetch';
import http from 'http';
import 'dotenv/config';
import {readFile, writeFile} from 'fs/promises'

const server = http.createServer();
server.listen(process.env.PORT);

async function main() {
    try {
        console.log('Checking for power outages updates');

        const response = await fetch("https://www.dtek-kem.com.ua/ua/shutdowns", {
            "headers": {
                "accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
                "accept-language": "en-US,en;q=0.9,ru;q=0.8,uk;q=0.7",
                "cache-control": "max-age=0",
                "priority": "u=0, i",
                "sec-ch-ua": "\"Google Chrome\";v=\"143\", \"Chromium\";v=\"143\", \"Not A(Brand\";v=\"24\"",
                "sec-ch-ua-mobile": "?0",
                "sec-ch-ua-platform": "\"macOS\"",
                "sec-fetch-dest": "document",
                "sec-fetch-mode": "navigate",
                "sec-fetch-site": "same-origin",
                "sec-fetch-user": "?1",
                "upgrade-insecure-requests": "1",
                "cookie": "Domain=dtek-kem.com.ua; _language=1f011804d107a9f0f6fa36417ed49140e5bc2106c740e65666f3a94e857201cca%3A2%3A%7Bi%3A0%3Bs%3A9%3A%22_language%22%3Bi%3A1%3Bs%3A2%3A%22uk%22%3B%7D; _hjSessionUser_5026684=eyJpZCI6IjU1N2ZlMjc0LTZlODktNWIyMS04NjFlLThhMDEzNDNkZTkzOCIsImNyZWF0ZWQiOjE3NjY5MDQ0NjI3MzEsImV4aXN0aW5nIjp0cnVlfQ==; _csrf-dtek-kem=d54bb3b6f857ed1df34d5c45ae13758da4b3842b8d20ad9c9482e78c665be0f7a%3A2%3A%7Bi%3A0%3Bs%3A14%3A%22_csrf-dtek-kem%22%3Bi%3A1%3Bs%3A32%3A%22leIVLa3Egt5pbjcxWdFBoz8b78JgKDqR%22%3B%7D; _gid=GA1.3.1659978059.1768038404; Domain=dtek-kem.com.ua; visid_incap_2224657=Ya6n+aS6SO+z8QHfs3enc4vSUGkAAAAAQkIPAAAAAACAB6PBAbAkS+bzHG8ys7thQz9oOiJ3q5aR; dtek-kem=qb6jrp68g0vvnr5fu0g2uipu71; incap_ses_687_2224657=yKLkQBk9pHRWXvJnTreICVarYmkAAAAARCGGpquJb4Ed7COkx/XtNA==; _hjSession_5026684=eyJpZCI6ImU2OTEwZjkwLWY0MjctNGMwOC05MDBmLTFmMDY5NDRlMWJkMSIsImMiOjE3NjgwNzQ2MTM4MDksInMiOjAsInIiOjAsInNiIjowLCJzciI6MCwic2UiOjAsImZzIjowLCJzcCI6MH0=; _ga_DLFSTRRPM2=GS2.1.s1768074611$o8$g1$t1768074760$j58$l0$h0; _ga=GA1.3.1760325505.1766904461; incap_wrt_373=B69iaQAAAADRUl4DGgAI9QIQjOCHiJACGLPgissGIAIogtmKywYwAV18CF0DC1IBheujX2eZutk=",
                "Referer": "https://www.dtek-kem.com.ua/ua/shutdowns"
            },
            "body": null,
            "method": "GET"
        });

        const html = await response.text();

        const startStr = 'DisconSchedule.fact = ';

        const start = html.indexOf(startStr) + startStr.length;
        const end = html.indexOf(",\"update\"", start);

        const result = html.substring(start, end).trim() + '}';

        const parsed = JSON.parse(result);

        let message = '';

        const currentSchedule = {};
        let storedSchedule = null;

        try {
            const file = await readFile('schedule.json', 'utf-8');
            storedSchedule = JSON.parse(file);
        } catch {

        }

        Object.keys(parsed.data).forEach(((dateTimestamp, i) => {
            currentSchedule[dateTimestamp] = '';

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

            const myGroupShutdowns = parsed.data[dateTimestamp]["GPV6.2"];

            let assigningNewPeriod = false;
            let isStartOfPeriodInitialized = false;
            let currentPeriod = '';

            const hours = Object.keys(myGroupShutdowns);

            hours.forEach((hour, i) => {
                currentSchedule[dateTimestamp] = [];

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

                        if (!hours[i + 1] || myGroupShutdowns[hours[i + 1]] === "yes") {
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
                    } else if (!hours[i + 1] || myGroupShutdowns[hours[i + 1]] === "yes") {
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
            })
        }));

        if (!storedSchedule) {
            await writeFile('schedule.json', JSON.stringify(currentSchedule));
            await sendNotification(message);
        } else {
            let somethingChanged = false;

            Object.keys(storedSchedule).forEach((dateTimestamp) => {
                if (somethingChanged) {
                    return;
                }

                storedSchedule[dateTimestamp].forEach(period => {
                    if (somethingChanged) {
                        return;
                    }

                    somethingChanged = !currentSchedule[dateTimestamp].includes(period);
                })
            });

            if (somethingChanged) {
                await sendNotification(message);
            } else {
                console.log("No changes detected");
            }
        }
    } catch (err) {
        console.error('Error:', err);
    }
}

const sendNotification = async (message) => {
    await fetch(`https://api.telegram.org/bot${process.env.BOT_TOKEN}/sendMessage`, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({chat_id: "332433737", text: message})
    });

    console.log(`Sent notification on ${new Date().toISOString()}`)
}

const callService = () => {
    fetch("https://power-outage-notifier-976l.onrender.com");
}

main();

setInterval(callService, 10 * 60 * 1000);

setInterval(main, 5 * 60 * 1000);


