import {HourStatus, ParsedSchedule, Schedule} from "./interfaces";

export default function getMessageAndNewScheduleFromTable(parsed: ParsedSchedule, group: string): {
    message: string,
    newSchedule: Schedule
} {
    let message = '';
    const newSchedule: Schedule = {};

    Object.keys(parsed.data).forEach((dateTimestamp, i) => {
        newSchedule[dateTimestamp] = [];
        const date = new Date(Number(dateTimestamp) * 1000);
        const uaDate: string = new Intl.DateTimeFormat('uk-UA', {
            day: 'numeric',
            month: 'long',
            year: 'numeric'
        }).format(date);

        if (i > 0) {
            message += '\n\n';
        }

        message += uaDate;

        const myGroupShutdowns = parsed.data[dateTimestamp][group];

        let assigningNewPeriod = false;
        let isStartOfPeriodInitialized = false;
        let currentPeriod = '';

        const resetPeriodAssigningVars = (): void => {
            assigningNewPeriod = false;
            isStartOfPeriodInitialized = false;
            currentPeriod = '';
        }

        const hours: string[] = Object.keys(myGroupShutdowns);
        hours.forEach((hour: string, j: number) => {
            const numericNumber = Number(hour);

            if (myGroupShutdowns[numericNumber] === HourStatus.no || myGroupShutdowns[numericNumber] === HourStatus.second || myGroupShutdowns[numericNumber] === HourStatus.first) {
                if (!assigningNewPeriod) {
                    assigningNewPeriod = true;
                    message += '\n';
                }

                const endOfPeriod = !hours[j + 1] || myGroupShutdowns[hours[j + 1]] === HourStatus.yes;

                if (!isStartOfPeriodInitialized) {
                    isStartOfPeriodInitialized = true;

                    const startOfPeriod = getStartOfPeriod(myGroupShutdowns[numericNumber], numericNumber);
                    currentPeriod = startOfPeriod;
                    message += startOfPeriod;

                    if (endOfPeriod) {
                        const endOfPeriod = getEndOfPeriod(myGroupShutdowns[numericNumber], numericNumber);
                        message += endOfPeriod;
                        currentPeriod += endOfPeriod;

                        newSchedule[dateTimestamp].push(currentPeriod);

                        resetPeriodAssigningVars();
                    }
                } else if (endOfPeriod) {
                    const endOfPeriod = getEndOfPeriod(myGroupShutdowns[numericNumber], numericNumber);
                    message += endOfPeriod;
                    currentPeriod += endOfPeriod;

                    newSchedule[dateTimestamp].push(currentPeriod);

                    resetPeriodAssigningVars();
                }
            } else {
                resetPeriodAssigningVars();
            }
        });
    });

    message = 'Из таблицы:\n' + message;

    return {message, newSchedule};
}

const getStartOfPeriod = (hourStatus: HourStatus, hour: number): string => {
    if (hourStatus === HourStatus.second || hourStatus === HourStatus.first) {
        return `${hour - 1}:30`;
    } else {
        return `${hour}`;
    }
}

const getEndOfPeriod = (hourStatus: HourStatus, hour: number): string => {
    if (hourStatus === HourStatus.second || hourStatus === HourStatus.first) {
        return `${hour - 1}:30-`;
    } else {
        return `${hour - 1}-`;
    }
}
