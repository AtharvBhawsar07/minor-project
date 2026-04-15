const IssueRecord = require('../models/IssueRecord');
const User = require('../models/User');
const emailService = require('./emailService');
const logger = require('./logger');

const startOfDay = (date) => new Date(date.getFullYear(), date.getMonth(), date.getDate());

const getReminderSenderEmail = async () => {
  const admin = await User.findOne({ role: 'admin', isActive: true }).select('email').lean();
  if (admin?.email) return admin.email;
  const librarian = await User.findOne({ role: 'librarian', isActive: true }).select('email').lean();
  if (librarian?.email) return librarian.email;
  return null;
};

const processDueDateReminders = async () => {
  const today = startOfDay(new Date());
  const senderEmail = await getReminderSenderEmail();

  const issuedRecords = await IssueRecord.find({
    status: 'issued',
    dueDate: { $exists: true, $ne: null },
  }).populate('student', 'name email');

  let sentCount = 0;

  for (const issue of issuedRecords) {
    if (!issue?.student?.email || !issue?.dueDate) continue;

    const dueStart = startOfDay(new Date(issue.dueDate));
    const daysLeft = Math.round((dueStart - today) / 86400000);

    if (daysLeft !== 1 && daysLeft !== 2) continue;

    const reminderFlag = daysLeft === 2 ? 'reminderSent2Days' : 'reminderSent1Day';
    if (issue[reminderFlag]) continue;

    try {
      await emailService.sendDueDateReminder(issue.student, daysLeft, senderEmail || undefined);
      issue[reminderFlag] = true;
      await issue.save();
      sentCount += 1;
    } catch (err) {
      logger.error(`Due-date reminder failed for issue ${issue._id}: ${err?.message || err}`);
    }
  }

  logger.info(`Due-date reminder job finished. Sent ${sentCount} reminder(s).`);
  return { sent: sentCount };
};

module.exports = { processDueDateReminders };
