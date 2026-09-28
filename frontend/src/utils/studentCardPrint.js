import { classIdFor } from './studentIds';

const MAPS_PIN = 'https://maps.app.goo.gl/9ji9d2vsb9DasuwC8';

const escapeHtml = (value) => String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');

const initials = (name) => String(name || '?')
    .trim().split(/\s+/).filter(Boolean).map((part) => part[0]).slice(0, 2).join('').toUpperCase();

const cardMarkup = (student) => {
    const id = classIdFor(student) || 'Not assigned';
    const name = escapeHtml(student.name || 'Student');
    const className = escapeHtml(student.className || 'Class not assigned');
    const year = '2026/27';
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
                    <div><span>Academic Year</span><strong>${year}</strong></div>
                </div>
            </main>
            <footer></footer>
        </section>
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
};

const printCss = `
    @page { size: 3.4in 2.1in; margin: 0; }
    * { box-sizing: border-box; }
    html, body { margin: 0; padding: 0; background: #fff; }
    body { font-family: Arial, Helvetica, sans-serif; }
    .id-card { width: 3.4in; height: 2.1in; position: relative; overflow: hidden; color: #19324a; break-after: page; page-break-after: always; }
    .id-card:last-child { break-after: auto; page-break-after: auto; }
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
`;

/** Opens a two-sided, credit-card-sized print dialog. Browser Print can save it as PDF. */
export const openStudentCardPrint = (students = []) => {
    if (typeof window === 'undefined') return;
    const list = (students || []).filter(Boolean);
    if (!list.length) return;
    const popup = window.open('', '_blank', 'noopener,noreferrer');
    if (!popup) return;
    popup.document.write(`<!doctype html><html><head><title>BIS NOC Gerji Student ID Cards</title><style>${printCss}</style></head><body>${list.map(cardMarkup).join('')}</body></html>`);
    popup.document.close();
    popup.focus();
    setTimeout(() => popup.print(), 500);
};

export { MAPS_PIN };
