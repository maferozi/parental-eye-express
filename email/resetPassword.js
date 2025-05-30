const resetPasswordEmail = (name, resetUrl) => {
  return `
  <!DOCTYPE html>
  <html lang="en">
  <head>
    <meta charset="UTF-8" />
    <title>Password Reset</title>
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <style>
      body {
        margin: 0;
        padding: 0;
        background-color: #f0f4f8;
        font-family: 'Segoe UI', Roboto, sans-serif;
      }
      .email-container {
        max-width: 600px;
        margin: 40px auto;
        background-color: #ffffff;
        border-radius: 12px;
        box-shadow: 0 8px 20px rgba(0, 0, 0, 0.05);
        padding: 40px;
      }
      h2 {
        color: #1f2d3d;
        text-align: center;
        margin-bottom: 20px;
      }
      p {
        color: #4a4a4a;
        line-height: 1.6;
        font-size: 16px;
      }
      .btn {
        display: inline-block;
        background-color: #0061f2;
        color: white;
        padding: 12px 25px;
        text-decoration: none;
        border-radius: 6px;
        margin: 20px 0;
        font-weight: bold;
      }
      .btn:hover {
        background-color: #004bb5;
      }
      .footer {
        font-size: 13px;
        color: #999;
        margin-top: 40px;
        text-align: center;
      }
      .link {
        color: #0061f2;
        word-break: break-all;
      }
    </style>
  </head>
  <body>
    <div class="email-container">
      <h2>Password Reset</h2>
      <p>Hi <strong>${name}</strong>,</p>
      <p>We received a request to reset your password for your <strong>Parental Eye</strong> account. If you made this request, please click the button below to reset your password.</p>

      <div style="text-align: center;">
        <a href="${resetUrl}" class="btn" target="_blank">Reset Password</a>
      </div>

      <p>If the button above doesn't work, you can also use the following link:</p>
      <p><a href="${resetUrl}" class="link" target="_blank">${resetUrl}</a></p>

      <p>If you did not request a password reset, you can safely ignore this email.</p>

      <div class="footer">
        This is an automated message from Parental Eye. Please do not reply.
      </div>
    </div>
  </body>
  </html>
  `;
};

module.exports = { resetPasswordEmail };
