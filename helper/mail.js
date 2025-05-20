const { createTransport, createTestAccount, getTestMessageUrl } = require('nodemailer');
const path = require("path");



const {
  NODE_ENV, DEFAULT_MAIL_SENDER,EMAIL_USER,EMAIL_PASS
} = process.env;

async function getTransporter() {
  let transporter;
  // if (NODE_ENV !== 'production') {
    const testAccount = await createTestAccount();
    transporter = createTransport({
      service: "gmail",
        auth: {
            user: EMAIL_USER, 
            pass: EMAIL_PASS, 
        }
  });
  // } else {
  //   transporter = createTransport({
  //     host: SMTP_HOST,
  //     port: SMTP_PORT,
  //     secure: Number(SMTP_PORT) === 465,
  //     auth: {
  //       user: SMTP_USER,
  //       pass: SMTP_PASSWORD,
  //     },
  //   });
  // }
  return transporter;
}



exports.sendMail = async (mail) => {
  try {
    const transporter = await getTransporter();

    const mailInfo = await transporter.sendMail(mail);
    
    
    if (NODE_ENV !== 'production') {
      console.log(`Mail Preview URL: ${getTestMessageUrl(mailInfo)}`);
    }
    
    return mailInfo;
  } catch (error) {
    console.error("Error sending email:", error);
    throw error;
  }
};
