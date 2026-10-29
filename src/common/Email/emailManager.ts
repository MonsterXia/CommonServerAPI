import { Resend } from "resend";
import { emailSenderAddress } from "../config/email";

class EmailManager {
    private _resendClient: Resend;

    constructor(resendApiKey: string, private readonly db: D1Database) {
        this._resendClient = new Resend(resendApiKey);
    }

    public async sendEmail(to: string, subject: string, content: string | React.ReactNode) {
        // Resend resets at 00:00 UTC. Reserve before sending; failed/ambiguous
        // deliveries still count. This quota covers this app, not other team usage.
        const day = new Date().toISOString().slice(0, 10);
        const [, reservation] = await this.db.batch([
            // Legacy KV usage is not reliably recoverable. On first use, block the
            // cutover day until the next UTC reset. Retain quota history as the marker.
            this.db.prepare(`INSERT INTO EmailDailyQuota(day,count)
                SELECT ?,100 WHERE NOT EXISTS (SELECT 1 FROM EmailDailyQuota)`).bind(day),
            this.db.prepare(`INSERT INTO EmailDailyQuota(day,count) VALUES (?,1)
                ON CONFLICT(day) DO UPDATE SET count=count+1 WHERE count<100`).bind(day),
        ]);
        if (!reservation.meta.changes) {
            throw new Error("Email sending service error. Please try again tomorrow.");
        }
        
        if (typeof content === 'string') {
            return await this.sendEmailResend(to, subject, content);
        } else {
            return await this.sendEmailReactResend(to, subject, content);
        }
    }

    private async sendEmailResend(to: string, subject: string, html: string) {
        return await this._resendClient.emails.send({
            from: emailSenderAddress,
            to,
            subject,
            html,
        })
    }

    private async sendEmailReactResend(to: string, subject: string, react: React.ReactNode) {
        return await this._resendClient.emails.send({
            from: emailSenderAddress,
            to,
            subject,
            react,
        })
    }
}

export default EmailManager;
