const supabase = require('../config/supabase');
const { NotFoundError, ForbiddenError, asyncHandler } = require('../utils/errors');

/**
 * Assignable action items.
 *
 * Visibility: admins see every task in the school; teachers see tasks they
 * were assigned or that they raised themselves.
 */

const SELECT = `
    id, title, description, due_on, priority, status, completed_at, created_at,
    assignee:users!assigned_to(id, name, role),
    assigner:users!assigned_by(id, name, role),
    class:classes(id, name),
    student:students(id, name, admission_no)
`;

const shape = (t) => ({
    id: t.id,
    title: t.title,
    description: t.description,
    dueOn: t.due_on,
    priority: t.priority,
    status: t.status,
    completedAt: t.completed_at,
    createdAt: t.created_at,
    assignee: t.assignee,
    assigner: t.assigner,
    class: t.class,
    student: t.student,
    // Overdue is derived on read so it can never go stale in storage.
    isOverdue:
        t.due_on && !['done', 'cancelled'].includes(t.status)
            ? t.due_on < new Date().toISOString().slice(0, 10)
            : false,
});

/** GET /api/tasks?status=&assignedTo=&mine=true */
const listTasks = asyncHandler(async (req, res) => {
    const { status, assignedTo, mine } = req.query;

    let query = supabase
        .from('tasks')
        .select(SELECT)
        .eq('school_id', req.user.school_id)
        .order('due_on', { ascending: true, nullsFirst: false });

    if (req.user.role !== 'admin') {
        // Teachers see only their own work, or what they raised.
        query = query.or(`assigned_to.eq.${req.user.id},assigned_by.eq.${req.user.id}`);
    } else if (assignedTo) {
        query = query.eq('assigned_to', assignedTo);
    }

    if (mine === 'true') query = query.eq('assigned_to', req.user.id);
    if (status) query = query.eq('status', status);

    const { data, error } = await query;
    if (error) throw error;

    res.json({ tasks: data.map(shape) });
});

/** POST /api/tasks */
const createTask = asyncHandler(async (req, res) => {
    const { title, description, assignedTo, dueOn, priority, classId, studentId, threadId } = req.body;

    const { data, error } = await supabase
        .from('tasks')
        .insert({
            school_id: req.user.school_id,
            title,
            description: description ?? null,
            assigned_to: assignedTo,
            assigned_by: req.user.id,
            due_on: dueOn ?? null,
            priority: priority ?? 'normal',
            class_id: classId ?? null,
            student_id: studentId ?? null,
            thread_id: threadId ?? null,
        })
        .select(SELECT)
        .single();

    if (error) throw error;

    res.status(201).json({ task: shape(data) });
});

/**
 * PATCH /api/tasks/:id
 *
 * The assignee may move it along the workflow; only an admin or the person
 * who raised it may change what the task actually is.
 */
const updateTask = asyncHandler(async (req, res) => {
    const { data: existing, error: lookupError } = await supabase
        .from('tasks')
        .select('assigned_to, assigned_by, status')
        .eq('id', req.params.id)
        .eq('school_id', req.user.school_id)
        .maybeSingle();

    if (lookupError) throw lookupError;
    if (!existing) throw new NotFoundError('Task not found');

    const isAssignee = existing.assigned_to === req.user.id;
    const isOwner = existing.assigned_by === req.user.id || req.user.role === 'admin';

    const { status, title, description, dueOn, priority, assignedTo } = req.body;
    const patch = {};

    if (status !== undefined) {
        if (!isAssignee && !isOwner) {
            throw new ForbiddenError('Only the assignee or the person who set the task can change its status');
        }
        patch.status = status;
        patch.completed_at = status === 'done' ? new Date().toISOString() : null;
    }

    const editing = { title, description, dueOn, priority, assignedTo };
    const wantsEdit = Object.values(editing).some((v) => v !== undefined);

    if (wantsEdit) {
        if (!isOwner) throw new ForbiddenError('Only the person who set the task can edit it');
        if (title !== undefined) patch.title = title;
        if (description !== undefined) patch.description = description;
        if (dueOn !== undefined) patch.due_on = dueOn;
        if (priority !== undefined) patch.priority = priority;
        if (assignedTo !== undefined) patch.assigned_to = assignedTo;
    }

    const { data, error } = await supabase
        .from('tasks')
        .update(patch)
        .eq('id', req.params.id)
        .select(SELECT)
        .single();

    if (error) throw error;

    res.json({ task: shape(data) });
});

/** DELETE /api/tasks/:id */
const deleteTask = asyncHandler(async (req, res) => {
    const { data: existing, error: lookupError } = await supabase
        .from('tasks')
        .select('assigned_by')
        .eq('id', req.params.id)
        .eq('school_id', req.user.school_id)
        .maybeSingle();

    if (lookupError) throw lookupError;
    if (!existing) throw new NotFoundError('Task not found');

    if (existing.assigned_by !== req.user.id && req.user.role !== 'admin') {
        throw new ForbiddenError('Only the person who set the task can delete it');
    }

    const { error } = await supabase.from('tasks').delete().eq('id', req.params.id);
    if (error) throw error;

    res.json({ message: 'Task deleted' });
});

module.exports = { listTasks, createTask, updateTask, deleteTask };
