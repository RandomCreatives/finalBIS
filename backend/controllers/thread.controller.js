const supabase = require('../config/supabase');
const { NotFoundError, ForbiddenError, BadRequestError, asyncHandler } = require('../utils/errors');

/**
 * Threaded conversations between admins and teachers.
 *
 * Access rule: you can only see a thread you participate in. Admins are not
 * special-cased into every conversation — they are added as participants when
 * relevant, which keeps welfare discussions appropriately contained.
 */

const shapeThread = (t, unread = 0) => ({
    id: t.id,
    subject: t.subject,
    category: t.category,
    priority: t.priority,
    status: t.status,
    lastMessageAt: t.last_message_at,
    createdAt: t.created_at,
    student: t.student || null,
    class: t.class || null,
    createdBy: t.author || null,
    participants: (t.participants || []).map((p) => p.user).filter(Boolean),
    unreadCount: unread,
});

const THREAD_SELECT = `
    id, subject, category, priority, status, last_message_at, created_at,
    student:students(id, name, admission_no),
    class:classes(id, name),
    author:users!created_by(id, name, role),
    participants:thread_participants(user:users(id, name, role), last_read_at)
`;

/** Confirms the caller is in the thread, returning their participant row. */
const requireParticipant = async (threadId, userId) => {
    const { data, error } = await supabase
        .from('thread_participants')
        .select('id, last_read_at')
        .eq('thread_id', threadId)
        .eq('user_id', userId)
        .maybeSingle();

    if (error) throw error;
    if (!data) throw new ForbiddenError('You are not a participant in this conversation');
    return data;
};

/** GET /api/threads?status=&studentId= */
const listThreads = asyncHandler(async (req, res) => {
    const { status, studentId } = req.query;

    // Threads the caller belongs to.
    const { data: memberships, error: memberError } = await supabase
        .from('thread_participants')
        .select('thread_id, last_read_at')
        .eq('user_id', req.user.id);

    if (memberError) throw memberError;

    const threadIds = memberships.map((m) => m.thread_id);
    if (threadIds.length === 0) return res.json({ threads: [] });

    let query = supabase
        .from('threads')
        .select(THREAD_SELECT)
        .in('id', threadIds)
        .eq('school_id', req.user.school_id)
        .order('last_message_at', { ascending: false });

    if (status) query = query.eq('status', status);
    if (studentId) query = query.eq('student_id', studentId);

    const { data: threads, error } = await query;
    if (error) throw error;

    // Unread = messages after the caller's last_read_at, from someone else.
    const readMap = new Map(memberships.map((m) => [m.thread_id, m.last_read_at]));

    const { data: messages, error: msgError } = await supabase
        .from('messages')
        .select('thread_id, sender_id, created_at')
        .in('thread_id', threads.map((t) => t.id));

    if (msgError) throw msgError;

    const unreadFor = (threadId) => {
        const lastRead = readMap.get(threadId);
        return messages.filter(
            (m) =>
                m.thread_id === threadId &&
                m.sender_id !== req.user.id &&
                (!lastRead || new Date(m.created_at) > new Date(lastRead))
        ).length;
    };

    res.json({ threads: threads.map((t) => shapeThread(t, unreadFor(t.id))) });
});

/** GET /api/threads/:id — thread with its messages; marks it read. */
const getThread = asyncHandler(async (req, res) => {
    await requireParticipant(req.params.id, req.user.id);

    const { data: thread, error } = await supabase
        .from('threads')
        .select(THREAD_SELECT)
        .eq('id', req.params.id)
        .eq('school_id', req.user.school_id)
        .maybeSingle();

    if (error) throw error;
    if (!thread) throw new NotFoundError('Conversation not found');

    const { data: messages, error: msgError } = await supabase
        .from('messages')
        .select('id, body, created_at, sender:users(id, name, role)')
        .eq('thread_id', req.params.id)
        .order('created_at');

    if (msgError) throw msgError;

    // Opening a thread marks it read.
    await supabase
        .from('thread_participants')
        .update({ last_read_at: new Date().toISOString() })
        .eq('thread_id', req.params.id)
        .eq('user_id', req.user.id);

    res.json({ thread: shapeThread(thread), messages });
});

/** POST /api/threads */
const createThread = asyncHandler(async (req, res) => {
    const { subject, body, participantIds, studentId, classId, category, priority } = req.body;

    if (!Array.isArray(participantIds) || participantIds.length === 0) {
        throw new BadRequestError('Choose at least one recipient');
    }

    const { data, error } = await supabase.rpc('create_thread', {
        p_school_id: req.user.school_id,
        p_subject: subject,
        p_body: body,
        p_author_id: req.user.id,
        p_participants: participantIds,
        p_student_id: studentId ?? null,
        p_class_id: classId ?? null,
        p_category: category ?? 'general',
        p_priority: priority ?? 'normal',
    });

    if (error) throw error;

    res.status(201).json({ thread: data });
});

/** POST /api/threads/:id/messages */
const postMessage = asyncHandler(async (req, res) => {
    const { data, error } = await supabase.rpc('post_message', {
        p_thread_id: req.params.id,
        p_sender_id: req.user.id,
        p_body: req.body.body,
    });

    if (error) {
        if (error.message?.includes('NOT_A_PARTICIPANT')) {
            throw new ForbiddenError('You are not a participant in this conversation');
        }
        throw error;
    }

    res.status(201).json({ message: data });
});

/** PATCH /api/threads/:id — resolve or reopen. */
const updateThread = asyncHandler(async (req, res) => {
    await requireParticipant(req.params.id, req.user.id);

    const { status, priority } = req.body;
    const patch = {};

    if (status) {
        patch.status = status;
        patch.resolved_by = status === 'resolved' ? req.user.id : null;
        patch.resolved_at = status === 'resolved' ? new Date().toISOString() : null;
    }
    if (priority) patch.priority = priority;

    if (Object.keys(patch).length === 0) {
        throw new BadRequestError('Nothing to update');
    }

    const { data, error } = await supabase
        .from('threads')
        .update(patch)
        .eq('id', req.params.id)
        .eq('school_id', req.user.school_id)
        .select(THREAD_SELECT)
        .maybeSingle();

    if (error) throw error;
    if (!data) throw new NotFoundError('Conversation not found');

    res.json({ thread: shapeThread(data) });
});

/** GET /api/threads/unread-count — for the navigation badge. */
const getUnreadCount = asyncHandler(async (req, res) => {
    const { data: memberships, error } = await supabase
        .from('thread_participants')
        .select('thread_id, last_read_at')
        .eq('user_id', req.user.id);

    if (error) throw error;
    if (memberships.length === 0) return res.json({ unread: 0, threads: 0 });

    const { data: messages, error: msgError } = await supabase
        .from('messages')
        .select('thread_id, sender_id, created_at')
        .in('thread_id', memberships.map((m) => m.thread_id));

    if (msgError) throw msgError;

    const readMap = new Map(memberships.map((m) => [m.thread_id, m.last_read_at]));

    const unreadMessages = messages.filter((m) => {
        if (m.sender_id === req.user.id) return false;
        const lastRead = readMap.get(m.thread_id);
        return !lastRead || new Date(m.created_at) > new Date(lastRead);
    });

    res.json({
        unread: unreadMessages.length,
        threads: new Set(unreadMessages.map((m) => m.thread_id)).size,
    });
});

module.exports = {
    listThreads, getThread, createThread, postMessage, updateThread, getUnreadCount,
};
