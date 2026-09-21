import { lessonLabel, periodOrdinal, timeRange, to12h } from '../utils/periods';

describe('to12h', () => {
    test('drops the leading zero and adds the suffix', () => {
        expect(to12h('08:30')).toBe('8:30 AM');
        expect(to12h('09:20:00')).toBe('9:20 AM');
        expect(to12h('11:30')).toBe('11:30 AM');
        expect(to12h('12:20')).toBe('12:20 PM');
        expect(to12h('13:10')).toBe('1:10 PM');
        expect(to12h('15:00')).toBe('3:00 PM');
    });

    test('empty input stays empty', () => {
        expect(to12h('')).toBe('');
        expect(to12h(null)).toBe('');
    });
});

describe('periodOrdinal', () => {
    test('maps the six bells to the school wording', () => {
        expect(periodOrdinal('08:30')).toBe('1st');
        expect(periodOrdinal('09:20')).toBe('2nd');
        expect(periodOrdinal('10:40')).toBe('3rd');
        expect(periodOrdinal('11:30')).toBe('4th');
        expect(periodOrdinal('13:10')).toBe('5th');
        expect(periodOrdinal('14:10')).toBe('6th');
    });

    test('seconds are tolerated; off-bell times get no name', () => {
        expect(periodOrdinal('08:30:00')).toBe('1st');
        expect(periodOrdinal('08:10')).toBeNull(); // registration
        expect(periodOrdinal('12:45')).toBeNull(); // hand-added slot
    });
});

describe('timeRange', () => {
    test('shares the suffix within one half of the day', () => {
        expect(timeRange('08:30', '09:20')).toBe('8:30–9:20 AM');
        expect(timeRange('14:10', '15:00')).toBe('2:10–3:00 PM');
    });

    test('keeps both suffixes across noon', () => {
        expect(timeRange('11:30', '12:20')).toBe('11:30 AM–12:20 PM');
    });
});

describe('lessonLabel', () => {
    test('bell lessons name the period in school language', () => {
        expect(lessonLabel('08:30', '09:20')).toBe('1st period · 8:30–9:20 AM');
        expect(lessonLabel('13:10', '14:00')).toBe('5th period · 1:10–2:00 PM');
        expect(lessonLabel('14:10:00', '15:00:00')).toBe('6th period · 2:10–3:00 PM');
    });

    test('registration and off-bell rows show the time only', () => {
        expect(lessonLabel('08:10', '08:30')).toBe('8:10–8:30 AM');
    });
});
