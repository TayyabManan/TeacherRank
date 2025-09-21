export const emailTemplates = {
  approved: (teacherName: string, instituteName: string, teacherId?: string) => ({
    subject: `✅ Teacher Request Approved - ${teacherName}`,
    html: `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; border-radius: 10px 10px 0 0; text-align: center; }
            .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
            .button { display: inline-block; padding: 12px 30px; background: #667eea; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
            .footer { text-align: center; margin-top: 30px; color: #666; font-size: 14px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>🎓 Teacher Request Approved!</h1>
            </div>
            <div class="content">
              <h2>Great news!</h2>
              <p>Your request to add <strong>${teacherName}</strong> from <strong>${instituteName}</strong> has been approved and the teacher has been added to TeacherRank.</p>
              
              ${teacherId ? `
                <p>You can now view and rate this teacher:</p>
                <div style="text-align: center;">
                  <a href="https://teacherrank.vercel.app/teacher/${teacherId}" class="button">View Teacher Profile</a>
                </div>
              ` : ''}
              
              <p>Thank you for helping us build a comprehensive database of teachers. Your contribution helps students make informed decisions!</p>
              
              <div class="footer">
                <p>Best regards,<br>The TeacherRank Team</p>
                <p style="font-size: 12px;">This email was sent from TeacherRank. If you have any questions, please contact us at teacherrank.app@gmail.com</p>
              </div>
            </div>
          </div>
        </body>
      </html>
    `
  }),

  rejected: (teacherName: string, reason: string) => ({
    subject: `Teacher Request Update - ${teacherName}`,
    html: `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%); color: white; padding: 30px; border-radius: 10px 10px 0 0; text-align: center; }
            .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
            .reason-box { background: #fff; border-left: 4px solid #f5576c; padding: 15px; margin: 20px 0; }
            .footer { text-align: center; margin-top: 30px; color: #666; font-size: 14px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Teacher Request Update</h1>
            </div>
            <div class="content">
              <h2>Thank you for your submission</h2>
              <p>After reviewing your request to add <strong>${teacherName}</strong>, we were unable to approve it at this time.</p>
              
              <div class="reason-box">
                <strong>Reason:</strong><br>
                ${reason}
              </div>
              
              <p>Common reasons for rejection include:</p>
              <ul>
                <li>The teacher is already in our database</li>
                <li>Insufficient or unverifiable information provided</li>
                <li>The submission didn't meet our quality guidelines</li>
              </ul>
              
              <p>If you believe this was a mistake or have additional information to provide, please feel free to submit a new request with more details.</p>
              
              <div class="footer">
                <p>Best regards,<br>The TeacherRank Team</p>
                <p style="font-size: 12px;">This email was sent from TeacherRank. If you have any questions, please contact us at teacherrank.app@gmail.com</p>
              </div>
            </div>
          </div>
        </body>
      </html>
    `
  }),

  needsInfo: (teacherName: string, adminNotes: string) => ({
    subject: `📝 Additional Information Needed - ${teacherName}`,
    html: `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #fa709a 0%, #fee140 100%); color: white; padding: 30px; border-radius: 10px 10px 0 0; text-align: center; }
            .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
            .info-box { background: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 20px 0; }
            .button { display: inline-block; padding: 12px 30px; background: #ffc107; color: #333; text-decoration: none; border-radius: 5px; margin: 20px 0; }
            .footer { text-align: center; margin-top: 30px; color: #666; font-size: 14px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Additional Information Needed</h1>
            </div>
            <div class="content">
              <h2>Thank you for your submission!</h2>
              <p>We're reviewing your request to add <strong>${teacherName}</strong> to TeacherRank. However, we need some additional information to proceed.</p>
              
              <div class="info-box">
                <strong>Information Needed:</strong><br>
                ${adminNotes}
              </div>
              
              <p>Please reply to this email with the requested information, or submit a new request with complete details.</p>
              
              <div style="text-align: center;">
                <a href="https://teacherrank.app/feedback" class="button">Submit New Request</a>
              </div>
              
              <div class="footer">
                <p>Best regards,<br>The TeacherRank Team</p>
                <p style="font-size: 12px;">This email was sent from TeacherRank. Please reply to teacherrank.app@gmail.com with any additional information.</p>
              </div>
            </div>
          </div>
        </body>
      </html>
    `
  }),

  modified: (teacherName: string, instituteName: string, changes: string, teacherId?: string) => ({
    subject: `✅ Teacher Request Approved with Modifications - ${teacherName}`,
    html: `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; border-radius: 10px 10px 0 0; text-align: center; }
            .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
            .changes-box { background: #e8f5e9; border-left: 4px solid #4caf50; padding: 15px; margin: 20px 0; }
            .button { display: inline-block; padding: 12px 30px; background: #667eea; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
            .footer { text-align: center; margin-top: 30px; color: #666; font-size: 14px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>🎓 Teacher Request Approved!</h1>
            </div>
            <div class="content">
              <h2>Great news!</h2>
              <p>Your request to add <strong>${teacherName}</strong> from <strong>${instituteName}</strong> has been approved and the teacher has been added to TeacherRank.</p>
              
              <div class="changes-box">
                <strong>Note:</strong> We made some minor modifications to ensure accuracy and consistency:<br>
                ${changes}
              </div>
              
              ${teacherId ? `
                <p>You can now view and rate this teacher:</p>
                <div style="text-align: center;">
                  <a href="https://teacherrank.vercel.app/teacher/${teacherId}" class="button">View Teacher Profile</a>
                </div>
              ` : ''}
              
              <p>Thank you for helping us build a comprehensive database of teachers!</p>
              
              <div class="footer">
                <p>Best regards,<br>The TeacherRank Team</p>
                <p style="font-size: 12px;">This email was sent from TeacherRank. If you have any questions, please contact us at teacherrank.app@gmail.com</p>
              </div>
            </div>
          </div>
        </body>
      </html>
    `
  })
}