import EmailManager from "@/common/Email/emailManager";

declare global {
  var EmailManager: EmailManager | undefined
}

export const initEmailManager = (env: { RESEND_API_KEY: string }) => {
  if (!global.EmailManager) {
    console.log('📧 Initializing Email Manager...');
    global.EmailManager = new EmailManager(env.RESEND_API_KEY);
  }
}

export const getEmailManager = () => {
  if (!global.EmailManager) {
    throw new Error("Email Manager is not initialized");
  }
  return global.EmailManager;
}