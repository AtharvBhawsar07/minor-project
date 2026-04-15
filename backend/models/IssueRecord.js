const mongoose = require('mongoose');

const issueRecordSchema = new mongoose.Schema(
  {
    book:       { type: mongoose.Schema.Types.ObjectId, ref: 'Book',        required: true },
    student:    { type: mongoose.Schema.Types.ObjectId, ref: 'User',        required: true },
    libraryCard:{ type: mongoose.Schema.Types.ObjectId, ref: 'LibraryCard', required: false }, // optional for flexibility
    issuedBy:   { type: mongoose.Schema.Types.ObjectId, ref: 'User',        required: true },
    returnedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },

    issueDate:      { type: Date, default: Date.now },
    dueDate:        { type: Date, required: true },
    semesterEndDate:{ type: Date },
    graceUntil:     { type: Date },
    returnDate:     { type: Date },

    status:    { type: String, enum: ['issued', 'returned', 'lost'], default: 'issued' },
    issueType: { type: String, enum: ['temporary', 'permanent'], required: true },

    renewals: { type: Number, default: 0 },
    renewalHistory: [{
      renewedAt:      Date,
      renewedBy:      { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      previousDueDate: Date,
      newDueDate:      Date,
    }],

    condition: {
      atIssue:  { type: String, enum: ['good', 'fair', 'poor'], default: 'good' },
      atReturn: { type: String, enum: ['good', 'fair', 'poor', 'damaged'] },
    },
    notes: { type: String, trim: true },
    reminderSent2Days: { type: Boolean, default: false },
    reminderSent1Day: { type: Boolean, default: false },
  },
  {
    timestamps: true,
    toJSON:   { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Virtual: book is overdue when status=issued and past dueDate
issueRecordSchema.virtual('isOverdue').get(function () {
  return this.status === 'issued' && new Date() > new Date(this.dueDate);
});

issueRecordSchema.index({ student: 1, status: 1 });
issueRecordSchema.index({ book: 1, status: 1 });
issueRecordSchema.index({ status: 1, dueDate: 1 });

module.exports = mongoose.model('IssueRecord', issueRecordSchema);
