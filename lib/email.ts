// Email service using Resend API

import {Resend} from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

export async function sendMatchEmail(
    to: string,
    score: number,
    matchId?: string,
    itemCategory?: string
) {
    // Validate required environment variables
    if (!process.env.RESEND_API_KEY) {
        throw new Error("Email service not configured: Missing RESEND_API_KEY");
    }
    
    if (!process.env.EMAIL_FROM) {
        throw new Error("Email service not configured: Missing EMAIL_FROM");
    }

    // Validate recipient email
    if (!to || !to.includes('@')) {
        throw new Error("Invalid recipient email address");
    }

    const matchUrl = matchId ? `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/matches/${matchId}` : '#';
    
    try {
        const result = await resend.emails.send({
            from: process.env.EMAIL_FROM,
            to,
            subject: `We Found Your Lost ${itemCategory || 'Item'}!`,
            html: `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f4f4f4;">
          <div style="max-width: 600px; margin: 20px auto; background: white; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
            <!-- Header -->
            <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center;">
              <h1 style="color: white; margin: 0; font-size: 28px;">Great News!</h1>
            </div>
            
            <!-- Content -->
            <div style="padding: 30px;">
              <h2 style="color: #667eea; margin-top: 0;">We Found a Match!</h2>
              <p style="font-size: 16px; color: #555;">Someone reported finding an item that matches your lost <strong>${itemCategory || 'item'}</strong>.</p>
              
              <!-- Match Score -->
              <div style="background: #f8f9fa; border-left: 4px solid #667eea; padding: 15px; margin: 20px 0; border-radius: 4px;">
                <p style="margin: 0; font-size: 14px; color: #666;">Match Confidence</p>
                <p style="margin: 5px 0 0 0; font-size: 32px; font-weight: bold; color: #667eea;">${(score * 100).toFixed(0)}%</p>
              </div>
              
              <p style="font-size: 16px; color: #555;">This is a high-confidence match based on AI analysis of the item descriptions and images.</p>
              
              <!-- CTA Button -->
              <div style="text-align: center; margin: 30px 0;">
                <a href="${matchUrl}" style="display: inline-block; background: #667eea; color: white; padding: 14px 32px; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 16px;">View Match Details</a>
              </div>
              
              <!-- Next Steps -->
              <div style="background: #fff8e1; padding: 15px; border-radius: 4px; margin-top: 20px;">
                <h3 style="margin-top: 0; color: #f57c00; font-size: 16px;">📋 Next Steps:</h3>
                <ol style="margin: 10px 0; padding-left: 20px; color: #555;">
                  <li>Review the match details and photos</li>
                  <li>Contact the finder to arrange pickup</li>
                </ol>
              </div>
            </div>
            
            <!-- Footer -->
            <div style="background: #f8f9fa; padding: 20px; text-align: center; color: #666; font-size: 12px; border-top: 1px solid #e0e0e0;">
              <p style="margin: 0;">This is an automated notification from <strong>Tracey</strong></p>
              <p style="margin: 5px 0 0 0;">Helping reunite people with their lost items</p>
            </div>
          </div>
        </body>
      </html>
    `,
        });
        
        return result;
    } catch (error: any) {
        // Don't throw - let push notifications still work
        return { error: true, message: error.message };
    }
}