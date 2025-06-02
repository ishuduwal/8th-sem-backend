import nodemailer from 'nodemailer';
import dotenv from 'dotenv';

dotenv.config();

const transporter = nodemailer.createTransport({
  service: 'gmail', 
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS, 
  },
});

export const generateOTP = (): string => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

export const sendOTPEmail = async (email: string, otp: string, username: string): Promise<void> => {
  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Password Reset OTP</title>
      <style>
        body {
          font-family: 'Helvetica Neue', Arial, sans-serif;
          line-height: 1.5;
          color: #333;
          max-width: 600px;
          margin: 0 auto;
          padding: 20px;
          background-color: #f9f9f9;
        }
        .container {
          background: white;
          padding: 40px;
          border-radius: 8px;
          box-shadow: 0 2px 10px rgba(0,0,0,0.05);
        }
        .header {
          text-align: center;
          margin-bottom: 25px;
          border-bottom: 1px solid #eee;
          padding-bottom: 20px;
        }
        .logo {
          font-size: 20px;
          font-weight: bold;
          color: #2563eb;
          margin-bottom: 10px;
        }
        .otp-box {
          background: #f8fafc;
          border: 1px dashed #2563eb;
          padding: 15px;
          border-radius: 6px;
          text-align: center;
          margin: 25px 0;
          font-size: 18px;
        }
        .otp-code {
          font-size: 28px;
          font-weight: bold;
          letter-spacing: 3px;
          color: #2563eb;
          margin: 10px 0;
        }
        .note {
          background: #f0fdf4;
          border-left: 4px solid #10b981;
          padding: 12px 15px;
          margin: 20px 0;
          font-size: 14px;
        }
        .footer {
          text-align: center;
          margin-top: 30px;
          font-size: 12px;
          color: #64748b;
          border-top: 1px solid #eee;
          padding-top: 20px;
        }
        .button {
          display: inline-block;
          padding: 10px 20px;
          background: #2563eb;
          color: white;
          text-decoration: none;
          border-radius: 4px;
          margin: 15px 0;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <div class="logo">Password Reset</div>
          <h2 style="margin: 10px 0; font-weight: 500;">Your security code</h2>
        </div>
        
        <p>Hi <strong>${username}</strong>,</p>
        
        <p>We received a request to reset your password. Here's your one-time passcode:</p>
        
        <div class="otp-box">
          <div style="margin-bottom: 5px; color: #64748b;">Enter this code to continue:</div>
          <div class="otp-code">${otp}</div>
          <div style="font-size: 14px; color: #64748b;">Expires in 2 minutes</div>
        </div>
        
        <div class="note">
          <strong>For your security:</strong>
          <p>• Never share this code with anyone</p>
          <p>• This code will expire shortly</p>
          <p>• If you didn't request this, please ignore this email</p>
        </div>
        
        <p style="margin-top: 25px;">Need help? Contact our support team.</p>
        
        <div class="footer">
          <p>&copy; 2025 Haina Hola. All rights reserved.</p>
        </div>
      </div>
    </body>
    </html>
  `;

  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: email,
    subject: 'Your Password Reset Code',
    html: htmlContent,
  };

  await transporter.sendMail(mailOptions);
};