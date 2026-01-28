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

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid email format'
      });
    }

    console.log('=== EMAIL CONFIGURATION ===');
    console.log('EMAIL_USER:', process.env.EMAIL_USER);
    console.log('Using App Password:', process.env.EMAIL_PASS?.substring(0, 4) + '...');
    console.log('===========================');

    // Create transporter with improved settings
    const transporter = nodemailer.createTransport({
      service: 'gmail', // Using service simplifies config
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
      },
      // Additional security options
      tls: {
        rejectUnauthorized: true,
        minVersion: 'TLSv1.2'
      }
    });

    // Verify connection (with timeout)
    console.log('Testing SMTP connection...');
    await Promise.race([
      transporter.verify(),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Connection timeout')), 10000)
      )
    ]);
    console.log('✅ SMTP connection successful!');

    // Email to company
    const mailOptions = {
      from: {
        name: 'House of Cambridge Contact Form',
        address: process.env.EMAIL_USER
      },
      to: 'raveeshaamarawickrama200@gmail.com',
      replyTo: email,
      subject: `Contact Form: ${subject}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #333; border-bottom: 2px solid #FFBB38; padding-bottom: 10px;">
            New Contact Form Submission
          </h2>
          <div style="background-color: #f9f9f9; padding: 20px; margin: 20px 0; border-radius: 5px;">
            <p><strong>Name:</strong> ${first_name}</p>
            <p><strong>Email:</strong> <a href="mailto:${email}">${email}</a></p>
            <p><strong>Subject:</strong> ${subject}</p>
          </div>
          <div style="padding: 20px; background-color: #fff; border-left: 4px solid #FFBB38;">
            <p><strong>Message:</strong></p>
            <p style="white-space: pre-wrap;">${message}</p>
          </div>
          <p style="color: #666; font-size: 12px; margin-top: 20px;">
            Sent via House of Cambridge Contact Form
          </p>
        </div>
      `
    };

    console.log('Sending email to company...');
    await transporter.sendMail(mailOptions);
    console.log('✅ Email sent to company');

    // Auto-reply to user
    const autoReply = {
      from: {
        name: 'House of Cambridge',
        address: process.env.EMAIL_USER
      },
      to: email,
      subject: 'Thank you for contacting House of Cambridge',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background-color: #FFBB38; padding: 20px; text-align: center;">
            <h1 style="color: white; margin: 0;">House of Cambridge</h1>
          </div>
          <div style="padding: 30px; background-color: #f9f9f9;">
            <h2 style="color: #333;">Thank You for Reaching Out!</h2>
            <p>Dear ${first_name},</p>
            <p>We have received your message and will get back to you within 24-48 hours.</p>
            
            <div style="background-color: #fff; padding: 15px; margin: 20px 0; border-radius: 5px;">
              <p><strong>Your message:</strong></p>
              <p style="color: #666; white-space: pre-wrap;">${message}</p>
            </div>
            
            <p>If you need immediate assistance, please contact us:</p>
            <ul style="list-style: none; padding: 0;">
              <li>📞 Phone: 076 460 4227 (WhatsApp)</li>
              <li>📞 Phone: 0112 847 846</li>
              <li>📧 Email: houseofcambridge.lk@gmail.com</li>
            </ul>
            
            <p style="margin-top: 30px;">Best regards,<br>
            <strong>House of Cambridge Team</strong></p>
          </div>
          <div style="background-color: #333; color: white; padding: 15px; text-align: center; font-size: 12px;">
            <p>No 63 Old Road, Pannipitiya</p>
          </div>
        </div>
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
    
    // Specific error messages
    let errorMessage = 'Failed to send email. Please try again later.';
    
    if (error.code === 'EAUTH') {
      errorMessage = 'Email authentication failed. Please check email configuration.';
    } else if (error.code === 'ESOCKET' || error.code === 'ECONNECTION') {
      errorMessage = 'Connection to email server failed. Please try again.';
    } else if (error.message === 'Connection timeout') {
      errorMessage = 'Email server took too long to respond. Please try again.';
    }
    
    res.status(500).json({
      success: false,
      message: errorMessage,
      ...(process.env.NODE_ENV === 'development' && { 
        error: error.message,
        code: error.code 
      })
    });
  }
};