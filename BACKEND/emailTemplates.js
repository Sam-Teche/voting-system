// emailTemplates.js

const emailTemplates = {
  adminVerification: (verificationUrl, verificationExpires) => `
      <!DOCTYPE html>
      <html lang="en">
      <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Admin Account Verification</title>
      </head>
      <body style="margin: 0; padding: 0; background-color: #f5f7fa; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">
          <div style="max-width: 650px; margin: 40px auto; background-color: #ffffff; border-radius: 16px; box-shadow: 0 8px 32px rgba(0, 0, 0, 0.08); overflow: hidden;">
              
              <!-- Header Section -->
              <div style="background: linear-gradient(135deg, #4CAF50 0%, #45a049 100%); padding: 50px 40px; text-align: center; position: relative;">
                  <div style="background-color: rgba(255, 255, 255, 0.15); width: 80px; height: 80px; border-radius: 50%; margin: 0 auto 20px; display: flex; align-items: center; justify-content: center;">
                      <svg width="40" height="40" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <path d="M12 2L13.09 8.26L19 7L14.74 11.26L21 12L14.74 12.74L19 17L13.09 15.74L12 22L10.91 15.74L5 17L9.26 12.74L3 12L9.26 11.26L5 7L10.91 8.26L12 2Z" fill="white"/>
                      </svg>
                  </div>
                  <h1 style="color: white; font-size: 2.4rem; font-weight: 700; margin: 0 0 12px 0; text-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);">Account Verification</h1>
                  <p style="color: rgba(255, 255, 255, 0.9); font-size: 1.1rem; margin: 0; font-weight: 400;">Secure Admin Access</p>
              </div>
  
              <!-- Content Section -->
              <div style="padding: 50px 40px;">
                  <div style="text-align: center; margin-bottom: 40px;">
                      <h2 style="color: #2c3e50; font-size: 1.8rem; font-weight: 600; margin: 0 0 16px 0;">Welcome to the Busy Voting System</h2>
                      <p style="color: #5a6c7d; font-size: 1.1rem; line-height: 1.6; margin: 0;">Your admin account has been created successfully. Please verify your email address to complete the setup process.</p>
                  </div>
  
                  <!-- Verification Button -->
                  <div style="text-align: center; margin: 40px 0;">
                      <a href="${verificationUrl}" style="display: inline-block; background: linear-gradient(135deg, #4CAF50 0%, #45a049 100%); color: white; text-decoration: none; padding: 18px 40px; border-radius: 50px; font-size: 1.1rem; font-weight: 600; box-shadow: 0 6px 20px rgba(76, 175, 80, 0.3); transition: all 0.3s ease; text-transform: uppercase; letter-spacing: 0.5px;">
                          <svg style="vertical-align: middle; margin-right: 10px;" width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                              <path d="M9 12L11 14L15 10M21 12C21 16.9706 16.9706 21 12 21C7.02944 21 3 16.9706 3 12C3 7.02944 7.02944 3 12 3C16.9706 3 21 7.02944 21 12Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                          </svg>
                          Verify Email Address
                      </a>
                  </div>
  
                  <!-- Info Box -->
                  <div style="background-color: #fef7e6; border: 1px solid #f9d71c; border-radius: 12px; padding: 24px; margin: 40px 0;">
                      <div style="display: flex; align-items: flex-start;">
                          <div style="background-color: #f9d71c; width: 24px; height: 24px; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin-right: 16px; flex-shrink: 0;">
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                  <path d="M12 9V13M12 17H12.01M21 12C21 16.9706 16.9706 21 12 21C7.02944 21 3 16.9706 3 12C3 7.02944 7.02944 3 12 3C16.9706 3 21 7.02944 21 12Z" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                              </svg>
                          </div>
                          <div>
                              <h3 style="color: #8b6914; font-size: 1rem; font-weight: 600; margin: 0 0 8px 0;">Important Information</h3>
                              <p style="color: #8b6914; font-size: 0.95rem; line-height: 1.5; margin: 0;">This verification link will expire on <strong>${verificationExpires.toLocaleString()}</strong>. Please complete the verification process before this time.</p>
                          </div>
                      </div>
                  </div>
  
                  <!-- Alternative Link -->
                  <div style="text-align: center; margin: 30px 0;">
                      <p style="color: #7f8c8d; font-size: 0.95rem; margin: 0 0 12px 0;">Having trouble with the button? Copy and paste this link:</p>
                      <p style="background-color: #f8f9fa; padding: 12px; border-radius: 8px; font-family: 'Courier New', monospace; font-size: 0.9rem; color: #495057; word-break: break-all; margin: 0;">${verificationUrl}</p>
                  </div>
  
                  <!-- Security Notice -->
                  <div style="background-color: #e8f4fd; border-left: 4px solid #3498db; padding: 20px; margin: 30px 0;">
                      <p style="color: #2980b9; font-size: 0.95rem; margin: 0; line-height: 1.5;">
                          <strong>Security Notice:</strong> If you didn't create this admin account, please ignore this email. Your account will not be activated without verification.
                      </p>
                  </div>
              </div>
  
              <!-- Footer Section -->
              <div style="background-color: #f8f9fa; padding: 30px 40px; border-top: 1px solid #e9ecef;">
                  <div style="text-align: center;">
                      <div style="margin-bottom: 20px;">
                          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                              <path d="M12 2L13.09 8.26L19 7L14.74 11.26L21 12L14.74 12.74L19 17L13.09 15.74L12 22L10.91 15.74L5 17L9.26 12.74L3 12L9.26 11.26L5 7L10.91 8.26L12 2Z" fill="#4CAF50"/>
                          </svg>
                      </div>
                      <h3 style="color: #2c3e50; font-size: 1.2rem; font-weight: 600; margin: 0 0 8px 0;">Voting System</h3>
                      <p style="color: #7f8c8d; font-size: 0.9rem; margin: 0 0 4px 0;">Secure • Reliable • Transparent</p>
                      <p style="color: #95a5a6; font-size: 0.85rem; margin: 0;">© ${new Date().getFullYear()} Voting System. All rights reserved.</p>
                  </div>
              </div>
          </div>
  
          <!-- Mobile Responsiveness -->
          <style>
              @media only screen and (max-width: 600px) {
                  .email-container {
                      margin: 20px auto !important;
                      border-radius: 12px !important;
                  }
                  .header-content {
                      padding: 40px 30px !important;
                  }
                  .main-content {
                      padding: 40px 30px !important;
                  }
                  .verify-button {
                      padding: 16px 30px !important;
                      font-size: 1rem !important;
                  }
                  .footer-content {
                      padding: 25px 30px !important;
                  }
              }
          </style>
      </body>
      </html>
    `,

  // You can add more email templates here
  passwordReset: (resetUrl, userName) => `
      <!-- Password reset email template -->
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto;">
        <h2>Password Reset Request</h2>
        <p>Hello ${userName},</p>
        <p>Click the link below to reset your password:</p>
        <a href="${resetUrl}" style="background-color: #007bff; color: white; padding: 12px 20px; text-decoration: none; border-radius: 4px;">Reset Password</a>
      </div>
    `,

  welcomeEmail: (userName) => `
      <!-- Welcome email template -->
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto;">
        <h2>Welcome ${userName}!</h2>
        <p>Your account has been successfully verified.</p>
      </div>
    `,
};

// Export for Node.js (CommonJS)
if (typeof module !== "undefined" && module.exports) {
  module.exports = emailTemplates;
}

// Export for ES6 modules
if (typeof window === "undefined") {
  module.exports = emailTemplates;
}
