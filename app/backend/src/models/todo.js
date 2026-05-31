const mongoose = require('mongoose');

const todoSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 200 },
    description: { type: String, trim: true, maxlength: 1000 },
    completed: { type: Boolean, default: false },
    priority: { type: String, enum: ['low', 'medium', 'high'], default: 'medium' },
    tags: [{ type: String }],
    dueDate: { type: Date },
  },
  { timestamps: true }
);

todoSchema.index({ completed: 1 });
todoSchema.index({ priority: 1 });

module.exports = mongoose.model('Todo', todoSchema);
