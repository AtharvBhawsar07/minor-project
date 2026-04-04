const { calculateFine, calculateDueDate } = require('../utils/fineCalculator');

describe('Fine Calculator Utils', () => {
  beforeEach(() => {
    process.env.FINE_PER_DAY = '5';
    process.env.MAX_ISSUE_DAYS = '14';
  });

  describe('calculateFine', () => {
    it('should return 0 fine if returned on or before due date', () => {
      const dueDate = new Date('2025-01-10T12:00:00Z');
      const returnDate = new Date('2025-01-09T12:00:00Z');
      const result = calculateFine(dueDate, returnDate);
      
      expect(result.isOverdue).toBe(false);
      expect(result.fineAmount).toBe(0);
      expect(result.overdueDays).toBe(0);
    });

    it('should correctly calculate fine for overdue books', () => {
      const dueDate = new Date('2025-01-10T12:00:00Z');
      const returnDate = new Date('2025-01-15T12:00:00Z');
      const result = calculateFine(dueDate, returnDate);
      
      expect(result.isOverdue).toBe(true);
      expect(result.overdueDays).toBe(5);
      expect(result.fineAmount).toBe(25); // 5 days * 5 rs/day
    });
  });

  describe('calculateDueDate', () => {
    it('should return date 14 days from issue date by default', () => {
      const issueDate = new Date('2025-01-01T12:00:00Z');
      const dueDate = calculateDueDate(issueDate);
      
      const expectedDueDate = new Date('2025-01-15T12:00:00Z');
      expect(dueDate.getTime()).toEqual(expectedDueDate.getTime());
    });
  });
});
