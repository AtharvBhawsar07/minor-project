const nodemailer = require('nodemailer');
const logger = require('./logger');

// Create transporter (lazy — only connects when first email is sent)
const createTransporter = () => {
  if (process.env.NODE_ENV === 'test') {
    return { sendMail: async () => ({ messageId: 'test' }) };
  }
  return nodemailer.createTransport({
    host: process.env.EMAIL_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.EMAIL_PORT) || 587,
    secure: process.env.EMAIL_SECURE === 'true',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });
};

const send = async ({ to, subject, html }) => {
  if (!process.env.EMAIL_USER) {
    logger.warn('Email not configured — skipping send');
    return;
  }
  const transporter = createTransporter();
  const info = await transporter.sendMail({
    from: process.env.EMAIL_FROM || 'Digital Library <noreply@digitallibrary.com>',
    to,
    subject,
    html,
  });
  logger.info(`Email sent: ${info.messageId}`);
};

const emailService = {
  sendBookIssued: async (student, issueRecord, book) => {
    await send({
      to: student.email,
      subject: `Book Issued: ${book.title}`,
      html: `
        <h2>Book Issued Successfully</h2>
        <p>Dear ${student.name},</p>
        <p>The book <strong>${book.title}</strong> has been issued to you.</p>
        <p><strong>Due Date:</strong> ${new Date(issueRecord.dueDate).toDateString()}</p>
        <p>Please return it on time to avoid fines of ₹${process.env.FINE_PER_DAY || 5}/day.</p>
        <br><p>Digital Library System</p>
      `,
    });
  },

  sendBookReturned: async (student, book, fine) => {
    const fineMsg = fine
      ? `<p style="color:red"><strong>Fine: ₹${fine.amount}</strong> for ${fine.overdueDays} overdue day(s). Please clear it at the library.</p>`
      : `<p style="color:green">Returned on time. No fine charged.</p>`;
    await send({
      to: student.email,
      subject: `Book Returned: ${book.title}`,
      html: `
        <h2>Book Returned</h2>
        <p>Dear ${student.name},</p>
        <p>Thank you for returning <strong>${book.title}</strong>.</p>
        ${fineMsg}
        <br><p>Digital Library System</p>
      `,
    });
  },

  sendFineReminder: async (student, fine) => {
    await send({
      to: student.email,
      subject: `Fine Reminder — ₹${fine.amount} Pending`,
      html: `
        <h2>Library Fine Reminder</h2>
        <p>Dear ${student.name},</p>
        <p>You have a pending fine of <strong>₹${fine.amount}</strong>. Please pay at the library counter.</p>
        <br><p>Digital Library System</p>
      `,
    });
  },
};

module.exports = emailService;
