import {Resend} from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);


// just sending the email
export async function sendMatchEmail(
    to: string,
    score: number
) {
    await resend.emails.send({
        from: process.env.EMAIL_FROM as string,
        to,
        subject: 'Welcome to Tracey! 🎉',
        html: `
      <h2>Good news!</h2>
      <p>We found a high-confidence match for your lost item.</p>
      <p><strong>Confidence:</strong> ${(score * 100).toFixed(1)}%</p>
      <p>Open the app to review the match.</p>
    `,
    })
}