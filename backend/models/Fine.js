const mongoose = require('mongoose');

const fineSchema = new mongoose.Schema(
  {
    student: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    issueRecord: { type: mongoose.Schema.Types.ObjectId, ref: 'IssueRecord', required: true },
    book: { type: mongoose.Schema.Types.ObjectId, ref: 'Book', required: true },
    amount: { type: Number, required: true, min: 0 },
    paidAmount: { type: Number, default: 0 },
    overdueDays: { type: Number, required: true },
    finePerDay: { type: Number, required: true },
    dueDate: { type: Date, required: true },
    returnDate: { type: Date, required: true },
    status: { type: String, enum: ['pending', 'paid', 'waived', 'partial'], default: 'pending' },
    paymentMethod: { type: String, enum: ['cash', 'online', 'upi', 'card'] },
    paymentReference: { type: String },
    paidAt: { type: Date },
    waivedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    waivedAt: { type: Date },
    waiveReason: { type: String },
    collectedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

fineSchema.index({ student: 1, status: 1 });
fineSchema.index({ status: 1 });

module.exports = mongoose.model('Fine', fineSchema);
