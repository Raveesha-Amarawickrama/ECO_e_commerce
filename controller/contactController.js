import nodemailer from 'nodemailer';

export const sendContactEmail = async (req, res) => {
  try {
    const { first_name, email, subject, message } = req.body;

    // Validation
    if (!first_name || !email || !subject || !message) {
      return res.status(400).json({
        success: false,
        message: 'All fields are required'
      });
    }

    // DETAILED DEBUGGING
    console.log('=== EMAIL CONFIGURATION DEBUG ===');
    console.log('EMAIL_USER:', process.env.EMAIL_USER);
    console.log('EMAIL_PASS exists:', !!process.env.EMAIL_PASS);
    console.log('EMAIL_PASS length:', process.env.EMAIL_PASS?.length);
    console.log('EMAIL_PORT:', process.env.EMAIL_PORT);
    console.log('SECURE:', process.env.SECURE);
    console.log('=================================');

    // Create transporter
    const transporter = nodemailer.createTransport({
      host: 'smtp.gmail.com',
      port: 465,
      secure: true,
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
      },
      debug: true, // Enable debug output
      logger: true // Log information to console
    });

    // Verify connection
    console.log('Testing SMTP connection...');
    await transporter.verify();
    console.log('✅ SMTP connection successful!');

    // Email to company
    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: 'raveeshaamarawickrama200@gmail.com',
      subject: `Contact Form: ${subject}`,
      html: `
        <h2>New Contact Form Submission</h2>
        <p><strong>Name:</strong> ${first_name}</p>
        <p><strong>Email:</strong> ${email}</p>
        <p><strong>Subject:</strong> ${subject}</p>
        <p><strong>Message:</strong></p>
        <p>${message}</p>
      `
    };

    console.log('Sending email to company...');
    await transporter.sendMail(mailOptions);
    console.log('✅ Email sent to company');

    // Auto-reply to user
    const autoReply = {
      from: process.env.EMAIL_USER,
      to: email,
      subject: 'Thank you for contacting House of Cambridge',
      html: `
        <h2>Thank You for Reaching Out!</h2>
        <p>Dear ${first_name},</p>
        <p>We have received your message and will get back to you soon.</p>
        <br>
        <p>Best regards,</p>
        <p>House of Cambridge Team</p>
      `
    };

    console.log('Sending auto-reply to user...');
    await transporter.sendMail(autoReply);
    console.log('✅ Auto-reply sent to user');

    res.status(200).json({
      success: true,
      message: 'Email sent successfully'
    });

  } catch (error) {
    console.error('❌ EMAIL ERROR:', error);
    console.error('Error code:', error.code);
    console.error('Error message:', error.message);
    
    res.status(500).json({
      success: false,
      message: 'Failed to send email',
      error: error.message
    });
  }
};