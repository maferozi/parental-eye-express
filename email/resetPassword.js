const resetPasswordEmail = (name, resetUrl,serverUrl) => {
  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Reset Password</title>
    </head>
    <body style="margin: 0; padding: 30px auto; font-family: Arial, sans-serif; background-color: #f4f6f8; color: #333;">
      <div style="max-width: 600px; margin: 20px auto; background-color: #ffffff; border-radius: 12px; padding: 20px; box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);">
        <div style="text-align: center;">
          <img src="${serverUrl}/logo.webp" alt="Company Logo" style="display: block; margin: 0 auto 20px; width: 80px; height: auto;" />
          <h1 style="color: #003366; font-size: 24px; margin-bottom: 10px;">Password Reset Request</h1>
        </div>
        <p style="color: #333; text-align: start; line-height: 1.6; font-size: 16px;">
          Hello ${name},<br/><br/>
          We received a request to reset your password. To proceed, please click the button below. If you did not request a password reset, please disregard this email.
        </p>
        <a href="${resetUrl}" target="_blank" style="display: block; background-color: #0066cc; color: #ffffff; text-decoration: none; text-align: center; padding: 12px; margin: 20px auto 20px; width: 200px; border-radius: 6px; font-size: 16px;">
          Reset Password
        </a>
        <p style="color: #555; text-align: start; line-height: 1.6; font-size: 14px; margin-top: 20px;">
          If the button above doesn't work, copy and paste the following link into your browser:
        </p>
        <p style="color: #0066cc; word-wrap: break-word; font-size: 14px; margin-top: 10px;">
          <a href="${resetUrl}" target="_blank" style="color: #0066cc; text-decoration: none;">${resetUrl}</a>
        </p>
        <p style="color: #555; text-align: start; line-height: 1.6; font-size: 14px; margin-top: 20px;">
          For further assistance, feel free to reach out to our support team.
        </p>
        <p style="color: #555; text-align: start; font-size: 14px; margin-top: 20px;">Best regards,<br/>The E-Invoicing Support Team</p>
      </div>
    </body>
    </html>
  `;
};

module.exports = { resetPasswordEmail };
