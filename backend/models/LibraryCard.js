const mongoose = require('mongoose');

const libraryCardSchema = new mongoose.Schema(
  {
    cardNumber: {
      type: String,
      unique: true,
      default: () => `LIB-${Date.now()}-${Math.floor(Math.random() * 9000) + 1000}`,
    },
    student:  { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    book:     { type: mongoose.Schema.Types.ObjectId, ref: 'Book' },
    status: {
      type: String,
      // Full flow: pending → approved_pending_pickup → issued → returned
      //   OR:      pending → rejected  (student can re-apply)
      //            approved_pending_pickup → expired (missed 2-day pickup)
      // Only pending/approved_pending_pickup/issued are "active" (block new requests)
      // returned/rejected/expired FREE the card slot for a new request
      enum: ['pending', 'approved_pending_pickup', 'issued', 'returned', 'rejected', 'suspended', 'expired'],
      default: 'pending',
    },
    // Card sub-type
    type: { type: String, enum: ['temporary', 'permanent'], default: 'temporary' },
    // Student details at time of application
    course: { type: String },
    branch: { type: String },
    year:   { type: String },
    applicationNotes: { type: String },
    // Approval info
    approvedByLibrarian: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    approvedByAdmin:     { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    rejectionReason:     { type: String },
    suspensionReason:    { type: String },
    reviewedBy:          { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    reviewedAt:          { type: Date },
    // Pickup deadline: student must collect within 2 days of approval
    pickupDeadline: { type: Date },
    // Collected-by: staff who marked "Mark as Collected"
    collectedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    collectedAt: { type: Date },
    returnedAt: { type: Date },
    // Book issue dates (set when collected)
    issueDate:  { type: Date },
    dueDate:    { type: Date },
    // Legacy validity window (kept for compatibility)
    validFrom:  { type: Date },
    validUntil: { type: Date },
  },
  {
    timestamps: true,
    toJSON:   { virtuals: true },
    toObject: { virtuals: true },
  }
);

libraryCardSchema.virtual('isExpired').get(function () {
  return this.validUntil ? new Date() > this.validUntil : false;
});

libraryCardSchema.index({ student: 1, status: 1 });
libraryCardSchema.index({ status: 1 });
// Index to quickly find approved-pending-pickup cards past deadline
libraryCardSchema.index({ status: 1, pickupDeadline: 1 });

module.exports = mongoose.model('LibraryCard', libraryCardSchema);
