import {ParsedSchedule} from "./interfaces";

export default function parseScheduleFromHtml(html: string): ParsedSchedule {
    const startStr = 'DisconSchedule.fact = ';
    const startStrIndex = html.indexOf(startStr);
    if (startStrIndex === -1) {
        throw new Error(`Could not find ${startStr} string in HTML`);
    }

    const adjustedStart = startStrIndex + startStr.length;

    const endStr = ',"update"';
    const end = html.indexOf(endStr, adjustedStart);
    if (end === -1) {
        throw new Error(`Could not find ${endStr} terminator in HTML`);
    }

    const result = html.substring(adjustedStart, end) + '}';

    try {
        return JSON.parse(result);
    } catch (err) {
        throw new Error(`Failed to parse extracted JSON: ${err}`);
    }
}