const nodemailer = require('nodemailer');

const sendEmail = async (options) => {
    // 1. Create transporter
    // Use 'service: gmail' for Google Email with App Password
    const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
            user: process.env.SMTP_EMAIL,
            pass: process.env.SMTP_PASSWORD,
        },
    });

    /* Login as generic SMTP
    const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: process.env.SMTP_PORT,
        secure: process.env.SMTP_PORT == 465,
        auth: {
            user: process.env.SMTP_EMAIL,
            pass: process.env.SMTP_PASSWORD,
        },
    });
    */

    // 2. Define email options
    const message = {
        from: `${process.env.FROM_NAME || 'Support'} <${process.env.SMTP_EMAIL}>`,
        to: options.email,
        subject: options.subject,
        text: options.message, // Plain text body
        html: options.html,    // HTML body
    };

    // 3. Send email
    const info = await transporter.sendMail(message);

};

module.exports = sendEmail;
