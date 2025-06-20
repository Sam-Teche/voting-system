const nodemailer = require("nodemailer");

// Email configuration - Add these to your .env file
const EMAIL_USER = process.env.EMAIL_USER; // ✅ Correct
const EMAIL_PASS = process.env.EMAIL_PASS; // ✅ Correct
const EMAIL_HOST = process.env.EMAIL_HOST || "smtp.gmail.com";
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
      from: `"Busy Voting System" <${EMAIL_USER}>`,
      to: to,
      subject: subject,
      html: html,
    };

    await transporter.sendMail(mailOptions);
    console.log("✅ Email sent to:", to); // success log
    return true;
  }  catch (error) {
    console.error("❌ Email sending error:");
    console.error("Full error:", error);
    console.error("Message:", error.message);
    console.error("Response:", error.response);
    return false;
  }
};





module.exports = { sendEmail };
