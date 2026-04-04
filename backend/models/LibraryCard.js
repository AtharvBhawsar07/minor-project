const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');

const libraryCardSchema = new mongoose.Schema(
  {
    cardNumber: {
      type: String,
      unique: true,
      default: () => `LIB-${uuidv4().slice(0, 8).toUpperCase()}`,
    },
    student: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    book: { type: mongoose.Schema.Types.ObjectId, ref: 'Book' },
    status: {
      type: String,
      enum: ['pending', 'approved_by_librarian', 'approved', 'rejected', 'suspended', 'expired'],
      default: 'pending',
    },
    course: { type: String },
    branch: { type: String },
    year: { type: String },
    approvedByLibrarian: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    approvedByAdmin: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    // College rule: max 5 books per student (5 cards total)
    bookLimit: { type: Number, default: 5 },
    currentBooksIssued: { type: Number, default: 0, min: 0 },
    validFrom: { type: Date },
    validUntil: { type: Date },
    rejectionReason: { type: String },
    suspensionReason: { type: String },
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    reviewedAt: { type: Date },
    applicationNotes: { type: String },
    type: { type: String, enum: ['temporary', 'permanent'], default: 'temporary' },
  },
  { timestamps: true, toJSON: { virtuals: true }, toObject: { virtuals: true } }
);

libraryCardSchema.virtual('isExpired').get(function () {
  return this.validUntil ? new Date() > this.validUntil : false;
});

libraryCardSchema.index({ status: 1 });

module.exports = mongoose.model('LibraryCard', libraryCardSchema);
