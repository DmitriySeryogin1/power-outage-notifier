import {TelegramMessageBody, TelegramMessageParseMode} from "./interfaces";

    export default async function sendTelegramNotification(message: string, chatId: TelegramMessageBody['chat_id']  = '332433737'): Promise<void> {
    const token = process.env.BOT_TOKEN;

    if (!token) {
        throw new Error('BOT_TOKEN not set in .env');
    }

    const body: TelegramMessageBody = {
        chat_id: chatId,
        text: message,
        parse_mode: TelegramMessageParseMode.html,
    };

    try {
        await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify(body),
        });

        console.log(`Notification sent`);
    } catch (err) {
        throw new Error('Telegram send failed: ' + err);
    }
}