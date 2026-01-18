export interface TelegramMessageBody {
    chat_id: number | string,
    text: string,
    parse_mode: TelegramMessageParseMode.html | TelegramMessageParseMode.markdownv2 | TelegramMessageParseMode.markdown,
}

export interface ParsedSchedule {
    data: Record<string, GroupStatus>;
}

export interface GroupStatus {
    [key: string]: Record<string, HourStatus>;
}

export interface Schedule {
    [key: string]: string[]
}

export interface PowerOutagePerHouseData {
    data: Record<string, HousePowerOutageData>;
}

export interface HousePowerOutageData {
    end_date: string,
    start_date: string,
    sub_type: string,
    sub_type_reason: string[],
    type: string,
}

export type HousePowerOutageDatesAndReasonOnly = Omit<HousePowerOutageData, 'sub_type_reason' | 'type'>;

export enum HourStatus {
    no = "no",
    yes = "yes",
    second = "second",
    first = "first",
}

export enum TelegramMessageParseMode {
    html = 'HTML',
    markdown = 'Markdown',
    markdownv2 = 'MarkdownV2',
}