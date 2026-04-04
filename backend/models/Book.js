const mongoose = require('mongoose');

const bookSchema = new mongoose.Schema(
  {
    title:           { type: String, required: [true, 'Title is required'], trim: true },
    author:          { type: String, required: [true, 'Author is required'], trim: true },
    // isbn is optional — seed books are identified by title+author
    isbn:            { type: String, trim: true, sparse: true },
    semester:        { type: String, trim: true },
    genre:           { type: String, trim: true },
    description:     { type: String, trim: true },
    coverImage:      { type: String },
    publisher:       { type: String, trim: true },
    publishedYear:   { type: Number },
    totalCopies:     { type: Number, required: true, min: 1, default: 5 },
    availableCopies: { type: Number, min: 0, default: 5 },
    isActive:        { type: Boolean, default: true },
    addedBy:         { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

// Atomic decrement — prevents race condition
bookSchema.methods.decrementAvailable = async function () {
  const result = await this.constructor.findOneAndUpdate(
    { _id: this._id, availableCopies: { $gt: 0 } },
    { $inc: { availableCopies: -1 } },
    { new: true }
  );
  if (!result) throw new Error('No copies available');
  return result;
};

bookSchema.methods.incrementAvailable = async function () {
  return this.constructor.findByIdAndUpdate(
    this._id,
    { $inc: { availableCopies: 1 } },
    { new: true }
  );
};

bookSchema.index({ title: 'text', author: 'text' });
bookSchema.index({ semester: 1, isActive: 1 });

module.exports = mongoose.model('Book', bookSchema);
