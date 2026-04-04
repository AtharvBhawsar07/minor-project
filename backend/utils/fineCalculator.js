/**
 * Calculate fine for an overdue book
 * @param {Date} dueDate
 * @param {Date} returnDate - defaults to now
 * @param {object} opts
 * @param {string} opts.issueType - 'temporary' | 'permanent'
 * @param {Date} opts.semesterEndDate
 * @param {Date} opts.graceUntil
 */
const calculateFine = (dueDate, returnDate = new Date(), opts = {}) => {
  const { issueType, semesterEndDate, graceUntil } = opts || {};

  // For permanent cards: fine starts from Day 6 after semester end.
  // We implement it by shifting the effective due date to (semesterEnd + 5 days).
  const effectiveDueDate = (() => {
    if (issueType === 'permanent') {
      const base = graceUntil || semesterEndDate || dueDate;
      if (!base) return dueDate;
      const d = new Date(base);
      // If base is the semester end date (not graceUntil), add 5 days.
      if (!graceUntil && semesterEndDate) {
        d.setDate(d.getDate() + 5);
      }
      return d;
    }
    return dueDate;
  })();

  const due = new Date(effectiveDueDate);
  const returned = new Date(returnDate);

  // Zero out time component for fair day-based calculation
  due.setHours(0, 0, 0, 0);
  returned.setHours(0, 0, 0, 0);

  const diffMs = returned - due;
  const overdueDays = diffMs > 0 ? Math.floor(diffMs / (1000 * 60 * 60 * 24)) : 0;
  const finePerDay = parseFloat(process.env.FINE_PER_DAY) || 5;
  const fineAmount = overdueDays * finePerDay;
  const isOverdue = overdueDays > 0;

  return { overdueDays, fineAmount, finePerDay, isOverdue };
};

/**
 * Calculate due date from issue date
 * @param {string} type - 'temporary' or 'permanent'
 * @param {Date} issueDate - defaults to now
 */
const calculateDueDate = (type = 'temporary', issueDate = new Date()) => {
  const dueDate = new Date(issueDate);
  
  if (type === 'permanent') {
    // Semester end date - ideally configurable, but defaulting to a fixed future date for now
    // In a real app, this might come from a settings collection
    const semesterEnd = process.env.SEMESTER_END_DATE ? new Date(process.env.SEMESTER_END_DATE) : null;
    if (semesterEnd && semesterEnd > dueDate) {
      return semesterEnd;
    }
    // Fallback: 6 months for permanent
    dueDate.setMonth(dueDate.getMonth() + 6);
  } else {
    // 15 days for temporary
    const maxDays = parseInt(process.env.MAX_ISSUE_DAYS) || 15;
    dueDate.setDate(dueDate.getDate() + maxDays);
  }
  
  return dueDate;
};

module.exports = { calculateFine, calculateDueDate };
