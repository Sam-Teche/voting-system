const nodemailer = require("nodemailer");

// Email configuration - Add these to your .env file
const EMAIL_USER = process.env.EMAIL_USER; // your email
const EMAIL_PASS = process.env.EMAIL_PASS; // your email password or app password
const EMAIL_HOST = process.env.EMAIL_HOST || "smtp.gmail.com"; // or your email provider's SMTP
const EMAIL_PORT = process.env.EMAIL_PORT || 587;

// Create nodemailer transporter
const transporter = nodemailer.createTransport({
  // or remove this line if using other providers
  host: EMAIL_HOST,
  port: parseInt(EMAIL_PORT),
  secure: false, // true for 465, false for other ports
  auth: {
    user: EMAIL_USER,
    pass: EMAIL_PASS,
  },
  tls: {
    rejectUnauthorized: false,
  },
});

// Email sending function
const sendEmail = async (to, subject, html) => {
  try {
    const mailOptions = {
      from: `"Voting System" <${EMAIL_USER}>`,
      to,
      subject,
      html,
    };

    await transporter.sendMail(mailOptions);
    console.log("✅ Email sent to:", to); // success log
    return true;
  } catch (error) {
    console.error(
      "❌ Email sending error:",
      error.response || error.message || error
    );
    return false;
  }
};

module.exports = { sendEmail };
