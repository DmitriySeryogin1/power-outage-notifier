import fetch from 'node-fetch';
import { writeFile, readFile } from 'fs/promises';

async function main() {
    try {
        console.log('Checking for power outages updates');

        const response = await fetch('https://www.dtek-kem.com.ua/ua/ajax', {
            method: 'POST',
            headers: {
                'accept': 'application/json, text/javascript, */*; q=0.01',
                'accept-language': 'en-US,en;q=0.9,ru;q=0.8,uk;q=0.7',
                'content-type': 'application/x-www-form-urlencoded; charset=UTF-8',
                'origin': 'https://www.dtek-kem.com.ua',
                'priority': 'u=1, i',
                'referer': 'https://www.dtek-kem.com.ua/ua/shutdowns',
                'sec-ch-ua': '"Google Chrome";v="143", "Chromium";v="143", "Not A(Brand";v="24"',
                'sec-ch-ua-mobile': '?0',
                'sec-ch-ua-platform': '"macOS"',
                'sec-fetch-dest': 'empty',
                'sec-fetch-mode': 'cors',
                'sec-fetch-site': 'same-origin',
                'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36',
                'x-csrf-token': 'MZXb9QwxK6bxvsHFIYFJ-2CglaRTIK6_RuT-CZULQeBp47qaVkNF9aX5lJZrszyrDNLW7CMW4-wOsJ0k5kUM0Q==',
                'x-requested-with': 'XMLHttpRequest',
                'cookie': 'Domain=dtek-kem.com.ua; _language=1f011804d107a9f0f6fa36417ed49140e5bc2106c740e65666f3a94e857201cca%3A2%3A%7Bi%3A0%3Bs%3A9%3A%22_language%22%3Bi%3A1%3Bs%3A2%3A%22uk%22%3B%7D; visid_incap_2224657=Ya6n+aS6SO+z8QHfs3enc4vSUGkAAAAAQUIPAAAAAACaHlD+/e4pZPbSaKZoCRjU; _hjSessionUser_5026684=eyJpZCI6IjU1N2ZlMjc0LTZlODktNWIyMS04NjFlLThhMDEzNDNkZTkzOCIsImNyZWF0ZWQiOjE3NjY5MDQ0NjI3MzEsImV4aXN0aW5nIjp0cnVlfQ==; Domain=dtek-kem.com.ua; incap_ses_687_2224657=hT9TAW88BCbwCBdlTreICSXCX2kAAAAAg8/7ttEKkj4/GC7kwRAbYA==; _csrf-dtek-kem=f65c52b7ba76c7961f997a677b35ab3ec68d8e03e0eeb0190910ef437fd5ddd2a%3A2%3A%7Bi%3A0%3Bs%3A14%3A%22_csrf-dtek-kem%22%3Bi%3A1%3Bs%3A32%3A%22XvaoZrnSTGUSJ2uPlrCHp6MSHTc-sNM1%22%3B%7D; _gid=GA1.3.481720410.1767883305; _hjSession_5026684=eyJpZCI6IjQ4NWJmZDgxLTcwZDUtNGM2OS1hNmZmLWRjMWEzMjU3MDExNCIsImMiOjE3Njc4ODMzMDQ3MDksInMiOjAsInIiOjAsInNiIjowLCJzciI6MCwic2UiOjAsImZzIjowLCJzcCI6MH0=; _ga_DLFSTRRPM2=GS2.1.s1767883304$o2$g1$t1767883384$j59$l0$h0; _ga=GA1.3.1760325505.1766904461; dtek-kem=scmqb64i3bbp6n55ctog7oaegb; incap_wrt_373=PdRfaQAAAABujiIiGgAI9QIQtvT94I4CGOmq/8oGIAIoiaf/ygYwAYpPkG9N1LoQS53BHMKacrI='
            },
            body: new URLSearchParams({
                'method': 'getHomeNum',
                'data[0][name]': 'street',
                'data[0][value]': 'вул. Клавдіївська',
                'data[1][name]': 'house_num',
                'data[1][value]': '',
                'data[2][name]': 'updateFact',
                'data[2][value]': '08.01.2026 16:24'
            })
        });

        const {data} = await response.json();
        const filename = "schedule.json";
        const homeData = data['23/15'];
        const powerOutagePeriod = {
            start_date: homeData.start_date,
            end_date: homeData.end_date
        }
        const message = `${powerOutagePeriod.start_date} - ${powerOutagePeriod.end_date}`;

        try {
            const json = await readFile(`./${filename}`, 'utf8');
            const parsed = JSON.parse(json);

            if (parsed.start_date !== homeData.start_date || parsed.end_date !== homeData.end_date) {
                await writeFile(`./${filename}`, JSON.stringify(powerOutagePeriod));

                try {
                    await sendNotification(message);
                }
                catch (e) {
                    console.error(e);
                }
            }
            else {
                console.log("No updates detected")
            }
        }
        catch (e) {
            console.error(e);

            console.log("Creating schedule.json file");
            await writeFile(`./${filename}`, JSON.stringify(powerOutagePeriod));

            try {
                await sendNotification(message);
            }
            catch (e) {
                console.error(e);
            }
        }
    } catch (err) {
        console.error('Error:', err);
    }
}

const sendNotification = async (message) => {
    await fetch(`https://api.telegram.org/bot${process.env.BOT_TOKEN}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: "332433737", text: message })
    });

    console.log(`Sent notification on ${new Date().toISOString()}`)
}

const callService = () => {
    fetch("https://power-outage-notifier-976l.onrender.com");
}

main();

setInterval(callService, 10 * 60 * 1000);

setInterval(main, 5 * 60 * 1000);


