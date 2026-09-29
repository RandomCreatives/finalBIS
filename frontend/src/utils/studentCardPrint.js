import { classIdFor } from './studentIds';

const escapeHtml = (value) => String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');

const initials = (name) => String(name || '?')
    .trim().split(/\s+/).filter(Boolean).map((part) => part[0]).slice(0, 2).join('').toUpperCase();

const cardFrontMarkup = (student) => {
    const id = classIdFor(student) || 'Not assigned';
    const name = escapeHtml(student.name || 'Student');
    const className = escapeHtml(student.className || 'Class not assigned');
    const photo = student.photoUrl
        ? `<img class="photo" src="${escapeHtml(student.photoUrl)}" alt="" />`
        : `<div class="photo initials">${escapeHtml(initials(student.name))}</div>`;

    return `
        <section class="id-card front">
            <header>
                <div class="school">British International<br>School</div>
                <div class="title">STUDENT<br>ID CARD</div>
                <div class="mark">BIS<br><small>Gerji</small></div>
            </header>
            <main>
                ${photo}
                <div class="details">
                    <div><span>Name</span><strong>${name}</strong></div>
                    <div><span>Student ID</span><strong>${escapeHtml(id)}</strong></div>
                    <div><span>Class</span><strong>${className}</strong></div>
                    <div><span>Academic Year</span><strong>2026/27</strong></div>
                </div>
            </main>
            <footer></footer>
        </section>`;
};

const cardBackMarkup = () => `
    <section class="id-card back">
        <header><div class="title">TERMS AND<br>CONDITIONS</div></header>
        <main>
            <ul>
                <li>Parents or guardians must present the Student ID at the school gate.</li>
                <li>If someone new is sent to pick up a student, they must bring the Student ID and present it at the gate.</li>
            </ul>
            <div class="location">
                <img src="/bis-gerji-location-qr.png" alt="School location QR code" />
                <small>Scan for school location</small>
                <span>BIS NOC Gerji</span>
            </div>
        </main>
        <footer></footer>
    </section>`;

const printCss = `
    @page { margin: 0; }
    @page card { size: 3.4in 2.1in; margin: 0; }
    @page sheet { size: A4 landscape; margin: 0; }
    * { box-sizing: border-box; }
    html, body { margin: 0; padding: 0; background: #fff; }
    body { font-family: Arial, Helvetica, sans-serif; }
    .id-card { width: 3.4in; height: 2.1in; position: relative; overflow: hidden; color: #19324a; page: card; break-after: page; page-break-after: always; }
    .id-card:last-child { break-after: auto; page-break-after: auto; }
    .sheet { width: 297mm; height: 210mm; padding: 23mm 17mm; display: grid; grid-template-columns: repeat(3, 86.36mm); grid-template-rows: repeat(3, 53.34mm); column-gap: 2mm; row-gap: 2mm; page: sheet; break-after: page; page-break-after: always; }
    .sheet:last-child { break-after: auto; page-break-after: auto; }
    .sheet .id-card { width: 86.36mm; height: 53.34mm; page: auto; break-after: auto; page-break-after: auto; }
    .screen-note { padding: 14px 18px; font: 14px Arial, sans-serif; color: #334155; }
    header, footer { background: linear-gradient(110deg, #4bdaa2 0%, #079caa 45%, #003f67 100%); color: white; }
    header { height: .62in; position: relative; padding: .1in .12in; display: flex; align-items: flex-start; }
    .school { font-size: 8px; line-height: 1.05; width: .72in; }
    .title { font-family: Georgia, serif; font-weight: 800; font-size: 17px; line-height: .88; letter-spacing: .4px; text-align: center; flex: 1; }
    .mark { border: 1px solid rgba(255,255,255,.7); font-weight: 900; font-size: 12px; line-height: .8; text-align: center; padding: 3px 5px; }
    .mark small { font-size: 5px; font-weight: 600; }
    .front main { height: 1.23in; padding: .08in .16in .04in .95in; position: relative; background: #fff; }
    .front main:before { content: ''; position: absolute; left: .04in; right: .04in; top: .03in; bottom: .03in; opacity: .2; background: repeating-radial-gradient(ellipse at 20% 60%, transparent 0 8px, #55b6bc 9px 10px, transparent 11px 16px); }
    .photo { position: absolute; z-index: 2; left: .08in; top: -.15in; width: .7in; height: .7in; border-radius: 50%; object-fit: cover; border: 5px solid #2cae98; background: #e3f5ef; }
    .initials { display: grid; place-items: center; color: #087d86; font-size: 22px; font-weight: 800; }
    .details { position: relative; z-index: 2; padding-top: .04in; }
    .details div { display: flex; gap: .12in; margin: 3px 0; font-size: 8px; }
    .details span { width: .62in; color: #4e5d67; }
    .details strong { font-size: 8px; font-weight: 700; }
    footer { height: .25in; position: absolute; bottom: 0; left: 0; right: 0; }
    .back header { height: .62in; justify-content: center; }
    .back main { height: 1.23in; padding: .12in .12in .04in .16in; display: flex; gap: .08in; background: #fff; position: relative; }
    .back ul { margin: 0; padding-left: .15in; width: 2.1in; font-size: 7.2px; line-height: 1.45; }
    .back li { margin-bottom: 5px; }
    .location { margin-left: auto; width: .82in; text-align: center; font-size: 6px; display: flex; flex-direction: column; align-items: center; gap: 2px; }
    .location img { width: .65in; height: .65in; image-rendering: pixelated; }
    .location small { color: #4e5d67; font-size: 5.5px; }
    .location span { font-weight: 800; font-size: 6px; }
    @media print { .screen-note { display: none; } }
`;

const mirroredForShortEdge = (students) => {
    const result = [];
    for (let i = 0; i < students.length; i += 9) {
        const page = students.slice(i, i + 9);
        for (let row = 0; row < 3; row += 1) {
            result.push(...page.slice(row * 3, row * 3 + 3).reverse());
        }
    }
    return result;
};

/** Opens a credit-card-sized single print or A4 9-up front/back print sheet. */
export const openStudentCardPrint = (students = []) => {
    if (typeof window === 'undefined') return;
    const list = (students || []).filter(Boolean);
    if (!list.length) return;
    const popup = window.open('', '_blank');
    if (!popup) return;

    const bulk = list.length > 1;
    const body = bulk
        ? `<div class="screen-note">A4 landscape · 9 cards per sheet · print duplex using flip on the short edge</div>
           <section class="sheet">${list.map(cardFrontMarkup).join('')}</section>
           <section class="sheet">${mirroredForShortEdge(list).map(() => cardBackMarkup()).join('')}</section>`
        : `${cardFrontMarkup(list[0])}${cardBackMarkup()}`;
    const html = `<!doctype html><html><head><title>BIS NOC Gerji Student ID Cards</title><style>${printCss}</style></head><body>${body}</body></html>`;
    popup.document.open();
    popup.document.write(html);
    popup.document.close();

    let printed = false;
    const print = () => {
        if (printed) return;
        printed = true;
        popup.focus();
        popup.print();
    };
    const images = Array.from(popup.document.images);
    if (images.length === 0) {
        setTimeout(print, 250);
    } else {
        let remaining = images.length;
        const ready = () => {
            remaining -= 1;
            if (remaining <= 0) print();
        };
        images.forEach((image) => {
            image.addEventListener('load', ready, { once: true });
            image.addEventListener('error', ready, { once: true });
        });
        setTimeout(print, 1800);
    }
};
