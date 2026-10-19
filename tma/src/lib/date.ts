/** Today's date (YYYY-MM-DD) on the school clock — Addis Ababa (GMT+3). */
export function todayIso(now: Date = new Date()): string {
    // en-CA formats as YYYY-MM-DD, which is exactly what the API expects.
    return new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Africa/Addis_Ababa',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
    }).format(now);
}
