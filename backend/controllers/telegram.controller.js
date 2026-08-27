const env = require('../config/env');
const supabase = require('../config/supabase');
const { asyncHandler } = require('../utils/errors');
const { sendTelegramMessageWithOptions, answerCallbackQuery } = require('../utils/telegram');
const { generateCode } = require('../utils/email');

const CODE_TTL_MS = 10 * 60 * 1000;

/**
 * Builds the Telegram Bot Inline Menu Keyboards
 */
const buildMainMenuInlineKeyboard = (appUrl) => {
    return {
        inline_keyboard: [
            [
                { text: '🚀 Launch Mini App', web_app: { url: appUrl || 'https://bisnoc-gerji.vercel.app/app' } }
            ],
            [
                { text: '📅 Today\'s Timetable', callback_data: 'btn_timetable' },
                { text: '✅ Attendance', callback_data: 'btn_attendance' }
            ],
            [
                { text: '📝 My Tasks & Planning', callback_data: 'btn_tasks' },
                { text: '📢 Latest Notices', callback_data: 'btn_notices' }
            ],
            [
                { text: '💬 Messages & Inbox', callback_data: 'btn_messages' },
                { text: '🔑 Get Login Code', callback_data: 'btn_login_code' }
            ]
        ]
    };
};

/**
 * POST /api/telegram/webhook
 *
 * Handles incoming Telegram bot webhook updates: commands (/start, /menu)
 * and callback queries from inline keyboard buttons.
 */
const handleWebhook = asyncHandler(async (req, res) => {
    const update = req.body;
    if (!update) return res.sendStatus(200);

    const appUrl = env.corsOrigins?.[0] || 'https://bisnoc-gerji.vercel.app/app';

    // Handle incoming text message (e.g. /start or /menu)
    if (update.message && update.message.text) {
        const chatId = update.message.chat.id;
        const text = update.message.text.trim();
        const telegramId = String(update.message.from.id);

        if (text.startsWith('/start') || text.startsWith('/menu')) {
            // Find user in database by telegram_id
            const { data: user } = await supabase
                .from('users')
                .select('*')
                .eq('telegram_id', telegramId)
                .maybeSingle();

            const greetingName = user ? user.name : update.message.from.first_name || 'Staff Member';
            const welcomeText = `🏫 *BIS NOC Gerji School Portal*\n\nHello *${greetingName}*!\nWelcome to the official School Management Telegram Bot.\n\nChoose an option from the menu below:`;

            await sendTelegramMessageWithOptions(chatId, welcomeText, {
                parse_mode: 'Markdown',
                reply_markup: buildMainMenuInlineKeyboard(appUrl)
            });
            return res.sendStatus(200);
        }
    }

    // Handle callback query (button clicks)
    if (update.callback_query) {
        const callbackQuery = update.callback_query;
        const callbackId = callbackQuery.id;
        const data = callbackQuery.data;
        const chatId = callbackQuery.message?.chat?.id;
        const telegramId = String(callbackQuery.from.id);

        // Acknowledge the callback immediately
        await answerCallbackQuery(callbackId);

        // Find associated user
        const { data: user } = await supabase
            .from('users')
            .select('*')
            .eq('telegram_id', telegramId)
            .maybeSingle();

        if (!user) {
            await sendTelegramMessageWithOptions(chatId, '⚠️ Your Telegram account is not linked to a staff account yet. Please sign in to the web app with your password and link Telegram in Settings.', {
                reply_markup: buildMainMenuInlineKeyboard(appUrl)
            });
            return res.sendStatus(200);
        }

        switch (data) {
            case 'btn_timetable': {
                // Fetch today's schedule for this staff member
                const today = new Date().getDay() || 7; // 1 = Mon ... 7 = Sun
                const { data: slots } = await supabase
                    .from('timetable_slots')
                    .select('*, class_subject:class_subjects(*, class:classes(*), subject:subjects(*))')
                    .eq('day_of_week', today)
                    .order('starts_at');

                const mySlots = (slots || []).filter(s =>
                    s.class_subject?.teacher_id === user.id ||
                    user.role === 'admin'
                );

                if (mySlots.length === 0) {
                    await sendTelegramMessageWithOptions(chatId, `📅 *Today's Timetable*\n\nNo lessons timetabled for today.`, {
                        parse_mode: 'Markdown',
                        reply_markup: buildMainMenuInlineKeyboard(appUrl)
                    });
                } else {
                    let msg = `📅 *Today's Timetable*\n\n`;
                    mySlots.forEach(s => {
                        const subjectName = s.class_subject?.subject?.name || 'Subject';
                        const className = s.class_subject?.class?.name || 'Class';
                        msg += `• *${s.starts_at.slice(0, 5)}–${s.ends_at.slice(0, 5)}*: ${subjectName} (${className})\n`;
                    });
                    await sendTelegramMessageWithOptions(chatId, msg, {
                        parse_mode: 'Markdown',
                        reply_markup: buildMainMenuInlineKeyboard(appUrl)
                    });
                }
                break;
            }

            case 'btn_attendance': {
                await sendTelegramMessageWithOptions(chatId, `✅ *Homeroom & Session Attendance*\n\nHomeroom attendance can be taken or checked directly in the app. Tap launch below to manage attendance for your classes.`, {
                    parse_mode: 'Markdown',
                    reply_markup: buildMainMenuInlineKeyboard(appUrl)
                });
                break;
            }

            case 'btn_tasks': {
                const { data: tasks } = await supabase
                    .from('tasks')
                    .select('*')
                    .eq('assigned_to', user.id)
                    .neq('status', 'done')
                    .order('created_at', { ascending: false });

                const openTasks = tasks || [];
                if (openTasks.length === 0) {
                    await sendTelegramMessageWithOptions(chatId, `📝 *My Tasks & Planning*\n\n🎉 No pending tasks! All clear.`, {
                        parse_mode: 'Markdown',
                        reply_markup: buildMainMenuInlineKeyboard(appUrl)
                    });
                } else {
                    let msg = `📝 *Pending Tasks (${openTasks.length})*\n\n`;
                    openTasks.slice(0, 5).forEach(t => {
                        msg += `• *${t.title}* ${t.due_on ? `(Due ${t.due_on})` : ''}\n`;
                    });
                    await sendTelegramMessageWithOptions(chatId, msg, {
                        parse_mode: 'Markdown',
                        reply_markup: buildMainMenuInlineKeyboard(appUrl)
                    });
                }
                break;
            }

            case 'btn_notices': {
                const { data: notices } = await supabase
                    .from('notices')
                    .select('*')
                    .order('created_at', { ascending: false })
                    .limit(3);

                const list = notices || [];
                if (list.length === 0) {
                    await sendTelegramMessageWithOptions(chatId, `📢 *Latest School Notices*\n\nNo active announcements at the moment.`, {
                        parse_mode: 'Markdown',
                        reply_markup: buildMainMenuInlineKeyboard(appUrl)
                    });
                } else {
                    let msg = `📢 *Latest School Notices*\n\n`;
                    list.forEach(n => {
                        msg += `📌 *${n.title}*\n${n.body.slice(0, 120)}...\n\n`;
                    });
                    await sendTelegramMessageWithOptions(chatId, msg, {
                        parse_mode: 'Markdown',
                        reply_markup: buildMainMenuInlineKeyboard(appUrl)
                    });
                }
                break;
            }

            case 'btn_messages': {
                const { data: unread } = await supabase
                    .from('thread_participants')
                    .select('id')
                    .eq('user_id', user.id)
                    .eq('has_unread', true);

                const count = unread ? unread.length : 0;
                await sendTelegramMessageWithOptions(chatId, `💬 *Messages & Inbox*\n\nYou have *${count}* unread conversation${count === 1 ? '' : 's'}. Tap launch to open your inbox.`, {
                    parse_mode: 'Markdown',
                    reply_markup: buildMainMenuInlineKeyboard(appUrl)
                });
                break;
            }

            case 'btn_login_code': {
                const code = generateCode();
                await supabase
                    .from('users')
                    .update({
                        login_code: code,
                        login_code_expires_at: new Date(Date.now() + CODE_TTL_MS).toISOString(),
                    })
                    .eq('id', user.id);

                await sendTelegramMessageWithOptions(chatId, `🔑 *Your BIS NOC Sign-in Code*\n\nYour 6-digit verification code is:\n\`${code}\`\n\nIt expires in 10 minutes. Use this code on the login page to sign in.`, {
                    parse_mode: 'Markdown',
                    reply_markup: buildMainMenuInlineKeyboard(appUrl)
                });
                break;
            }

            default:
                await sendTelegramMessageWithOptions(chatId, `🏫 *BIS NOC Menu*`, {
                    reply_markup: buildMainMenuInlineKeyboard(appUrl)
                });
                break;
        }

        return res.sendStatus(200);
    }

    res.sendStatus(200);
});

module.exports = { handleWebhook };
