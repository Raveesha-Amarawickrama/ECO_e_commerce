import nodemailer from "nodemailer";

/**
 * Send email utility function using Nodemailer
 * Configured for House of Cambridge email system
 * @param {Object} options - Email configuration options
 * @param {string} options.email - Recipient email address
 * @param {string} options.subject - Email subject line
 * @param {string} options.message - Email message content (HTML format)
 * @returns {Promise} - Returns promise with email info
 */
const sendEmail = async (options) => {
  try {
    // 1. Create a transporter using your .env configuration
    const transporter = nodemailer.createTransport({
      host: process.env.HOST, // smtp.gmail.com
      port: parseInt(process.env.EMAIL_PORT), // 465
      secure: process.env.SECURE === "true", // true for port 465
      auth: {
        user: process.env.EMAIL_USER,  
        pass: process.env.EMAIL_PASS,  
      },
      tls: {
        rejectUnauthorized: false, // Accept self-signed certificates
      },
    });

    // 2. Verify transporter configuration
    await transporter.verify();
    console.log("✅ Email transporter is ready");
    console.log("   Using:", process.env.USER);

    // 3. Define email options
    const mailOptions = {
      from: {
        name: "House of Cambridge",
        address: process.env.USER, // udithaindunil5@gmail.com
      },
      to: options.email,
      subject: options.subject,
      html: options.message,
      // Optional: Add text version for email clients that don't support HTML
      text: options.message.replace(/<[^>]*>/g, ""), // Strip HTML tags for plain text
    };

    // 4. Send email
    const info = await transporter.sendMail(mailOptions);

    console.log("✅ Email sent successfully:");
    console.log("   Message ID:", info.messageId);
    console.log("   To:", options.email);
    console.log("   Subject:", options.subject);

    return {
      success: true,
      messageId: info.messageId,
      response: info.response,
    };
  } catch (error) {
    console.error("❌ Error sending email:", error);
    
    // Provide more detailed error information
    if (error.code === "EAUTH") {
      console.error("   Authentication failed - Check USER and PASS in .env");
      throw new Error("Email authentication failed. Please check your credentials in .env file.");
    } else if (error.code === "ESOCKET") {
      console.error("   Network error - Check internet connection");
      throw new Error("Network error. Please check your internet connection.");
    } else if (error.code === "EENVELOPE") {
      console.error("   Invalid email address:", options.email);
      throw new Error("Invalid recipient email address.");
    } else if (error.code === "ETIMEDOUT") {
      console.error("   Connection timeout");
      throw new Error("Email server connection timeout. Please try again.");
    } else if (error.code === "ECONNECTION") {
      console.error("   Cannot connect to email server");
      throw new Error("Cannot connect to email server. Check HOST and EMAIL_PORT.");
    } else {
      throw new Error(`Failed to send email: ${error.message}`);
    }
  }
};

export default sendEmail;