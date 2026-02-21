import { Resend } from "resend";
import { emailSenderAddress } from "../config/email";

class EmailManager {
    private _resendClient: Resend;

    constructor(resendApiKey: string) {
        this._resendClient = new Resend(resendApiKey);
    }

    public async sendEmail(to: string, subject: string, content: string | React.ReactNode) {
        // resend
        let key = `email_resend_daily_count_${new Date().toISOString().split('T')[0]}`;
        let count = await KV?.get(key);
        console.log(`Current resend count for ${key}:`, count);
        if (count && parseInt(count) > 90) {
            throw new Error("Email sending service error. Please try again tomorrow.");
        }

        await KV?.put(key, count ? (parseInt(count) + 1).toString() : "1", { expirationTtl: 24 * 60 * 60 });
        
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