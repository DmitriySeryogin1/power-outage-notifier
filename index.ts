import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import http from 'http';
import 'dotenv/config';
import parseScheduleFromHtml from "./src/parseScheduleFromHtml";
import getShutdownsPageRawHtml from "./src/getShutdownsPageRawHtml";
import getJsonDataFromTextMessage from "./src/getJsonDataFromTextMessage";
import getMessageAndNewScheduleFromTable from "./src/getMessageAndNewScheduleFromTable";
import sendTelegramNotification from "./src/sendTelegramNotification";
import {HousePowerOutageDatesAndReasonOnly, PowerOutagePerHouseData, Schedule} from "./src/interfaces";

puppeteer.use(StealthPlugin());

const GROUP = 'GPV6.2';

const server = http.createServer();

server.listen(process.env.PORT || 3000, '0.0.0.0');

let currentScheduleFromMessage: HousePowerOutageDatesAndReasonOnly | null = null;
let currentScheduleFromTable: Schedule | null = null;

async function main(): Promise<void> {
    console.log('Checking power outages...');

    try {
        let finalMessage = '';
        let shouldNotify = !currentScheduleFromTable && !currentScheduleFromMessage;

        try {
            const html = await getShutdownsPageRawHtml();
            const parsedSchedule = parseScheduleFromHtml(html);

            let {message, newSchedule} = getMessageAndNewScheduleFromTable(parsedSchedule, GROUP);

            if (currentScheduleFromTable) {
                shouldNotify = JSON.stringify(currentScheduleFromTable) !== JSON.stringify(newSchedule);

                if (shouldNotify) {
                    currentScheduleFromTable = newSchedule;
                    finalMessage += message;
                }
            } else {
                currentScheduleFromTable = newSchedule;
                finalMessage += message;
                shouldNotify = true;
            }
        } catch (err) {
            console.error("Error while parsing data from table: " + err);
        }

        try {
            const housesPowerOutage: PowerOutagePerHouseData = await getJsonDataFromTextMessage();

            const myHouseData = housesPowerOutage.data["23/15"];

            const datesAndReason: HousePowerOutageDatesAndReasonOnly = {
                sub_type: myHouseData.sub_type,
                start_date: myHouseData.start_date,
                end_date: myHouseData.end_date
            } as const;

            const additionalMessage = `\n\nИз сообщения:\n${myHouseData.sub_type}\n${datesAndReason.start_date} - ${datesAndReason.end_date}`;

            if (currentScheduleFromMessage) {
                if (currentScheduleFromMessage.end_date !== datesAndReason.end_date || currentScheduleFromMessage.start_date !== datesAndReason.start_date) {
                    currentScheduleFromMessage = datesAndReason;
                    finalMessage += `\n${additionalMessage}`;
                    shouldNotify = true;
                }
            } else {
                currentScheduleFromMessage = datesAndReason;
                finalMessage += additionalMessage;
                shouldNotify = true;
            }
        } catch (err) {
            console.error("Error while generating message from json: " + err);
        }

        if (shouldNotify) {
            console.log('Sending notification');

            if (finalMessage.trim()) {
                await sendTelegramNotification(finalMessage);
            }
        } else {
            console.log('No changes in schedule');
        }
    } catch (err) {
        console.error('Main error:', err);
    }
}

const keepAlive = () => {
    fetch('https://power-outage-notifier-976l.onrender.com')
        .catch((err) => console.error(err));
};

main();

setInterval(keepAlive, 10 * 60 * 1000);
setInterval(main, 5 * 60 * 1000);