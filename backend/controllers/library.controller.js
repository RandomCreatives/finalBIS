const supabase = require('../config/supabase');
const { NotFoundError, ConflictError, asyncHandler } = require('../utils/errors');

const MAX_ACTIVE_LOANS = 3;

const SELECT = `
    id, book_title, book_author, book_isbn, borrowed_on, due_on, returned_on,
    status,
    student:students(id, name, admission_no, class_id)
`;

const shape = (l) => ({
    id: l.id,
    bookTitle: l.book_title,
    bookAuthor: l.book_author,
    bookIsbn: l.book_isbn,
    borrowedOn: l.borrowed_on,
    dueOn: l.due_on,
    returnedOn: l.returned_on,
    status: l.status,
    // Derived on read so it is never stale.
    isOverdue: l.status === 'borrowed' && l.due_on < new Date().toISOString().slice(0, 10),
    student: l.student,
});

/** POST /api/library/loans — issue a book. */
const issueBook = asyncHandler(async (req, res) => {
    const { studentId, bookTitle, bookAuthor, bookIsbn, dueOn } = req.body;

    const { data: active, error: activeError } = await supabase
        .from('library_loans')
        .select('id, due_on')
        .eq('student_id', studentId)
        .eq('status', 'borrowed');

    if (activeError) throw activeError;

    if (active.length >= MAX_ACTIVE_LOANS) {
        throw new ConflictError(`Student already has ${MAX_ACTIVE_LOANS} books on loan`);
    }

    const today = new Date().toISOString().slice(0, 10);
    if (active.some((l) => l.due_on < today)) {
        throw new ConflictError('Student has an overdue book and must return it first');
    }

    const { data, error } = await supabase
        .from('library_loans')
        .insert({
            school_id: req.user.school_id,
            student_id: studentId,
            book_title: bookTitle,
            book_author: bookAuthor ?? null,
            book_isbn: bookIsbn ?? null,
            due_on: dueOn,
            issued_by: req.user.id,
        })
        .select(SELECT)
        .single();

    if (error) throw error;

    res.status(201).json({ loan: shape(data) });
});

/**
 * POST /api/library/loans/:id/return
 * Delegates to a DB function so the status change and fine calculation
 * are atomic and use the database clock.
 */
const returnBook = asyncHandler(async (req, res) => {
    const { data, error } = await supabase.rpc('return_library_loan', {
        p_loan_id: req.params.id,
        p_school_id: req.user.school_id,
    });

    if (error) {
        if (error.message?.includes('LOAN_NOT_FOUND')) throw new NotFoundError('Loan not found');
        if (error.message?.includes('ALREADY_RETURNED')) throw new ConflictError('Book already returned');
        throw error;
    }

    res.json({
        message: data.days_late > 0
            ? `Returned ${data.days_late} day(s) late`
            : 'Book returned on time',
        loan: data,
    });
});

/** GET /api/library/loans?status=&studentId=&overdue=true */
const listLoans = asyncHandler(async (req, res) => {
    const { status, studentId, overdue } = req.query;

    let query = supabase
        .from('library_loans')
        .select(SELECT)
        .eq('school_id', req.user.school_id)
        .order('due_on');

    if (status) query = query.eq('status', status);
    if (studentId) query = query.eq('student_id', studentId);

    if (overdue === 'true') {
        query = query.eq('status', 'borrowed').lt('due_on', new Date().toISOString().slice(0, 10));
    }

    const { data, error } = await query;
    if (error) throw error;

    res.json({ loans: data.map(shape) });
});

/** GET /api/library/summary */
const getLibrarySummary = asyncHandler(async (req, res) => {
    const { data, error } = await supabase
        .from('library_loans')
        .select('status, due_on')
        .eq('school_id', req.user.school_id);

    if (error) throw error;

    const today = new Date().toISOString().slice(0, 10);

    res.json({
        totalLoans: data.length,
        onLoan: data.filter((l) => l.status === 'borrowed').length,
        overdue: data.filter((l) => l.status === 'borrowed' && l.due_on < today).length,
    });
});

module.exports = { issueBook, returnBook, listLoans, getLibrarySummary };
