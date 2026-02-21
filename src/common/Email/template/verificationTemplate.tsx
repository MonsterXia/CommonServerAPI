import React from "react";

const VerificationTemplate = ({ code }: { code: string }): React.ReactNode => {
  // Clean, modern email template (English)
  return (
    <div
      style={{
        fontFamily:
          '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
        maxWidth: "480px",
        margin: "0 auto",
        padding: "36px 28px",
        backgroundColor: "#ffffff",
        borderRadius: "24px",
        boxShadow: "0 12px 40px rgba(0, 0, 0, 0.06)",
        color: "#1e293b",
        lineHeight: "1.5",
      }}
    >
      {/* Greeting */}
      <p style={{ fontSize: "16px", margin: "0 0 12px 0" }}>Hello,</p>

      {/* Context */}
      <p style={{ fontSize: "15px", margin: "0 0 24px 0", color: "#334155" }}>
        A verification was requested for your account on{" "}
        <strong style={{ color: "#2563eb", fontWeight: 600 }}>
          246801357.xyz
        </strong>
        . Use the code below to complete this process.
      </p>

      {/* Verification Code Card */}
      <div
        style={{
          background: "linear-gradient(135deg, #f1f5f9 0%, #f8fafc 100%)",
          border: "1px solid #e2e8f0",
          borderRadius: "28px",
          padding: "32px 24px",
          margin: "24px 0 28px",
          textAlign: "center" as const,
        }}
      >
        <div style={{ fontSize: "14px", fontWeight: 500, color: "#64748b", marginBottom: "8px" }}>
          Verification code
        </div>
        <span
          style={{
            fontFamily:
              'ui-monospace, "JetBrains Mono", "Cascadia Code", "SF Mono", Monaco, Consolas, monospace',
            fontSize: "44px",
            fontWeight: 700,
            letterSpacing: "12px",
            color: "#0f172a",
          }}
        >
          {code}
        </span>
      </div>

      {/* Notice */}
      <div
        style={{
          fontSize: "14px",
          backgroundColor: "#ffffff",
          border: "1px solid #e2e8f0",
          borderRadius: "16px",
          padding: "18px 20px",
          marginBottom: "28px",
          color: "#475569",
        }}
      >
        <span style={{ display: "inline-block", marginRight: "8px" }}>⏱️</span>
        This code will expire in <strong style={{ color: "#1e293b" }}>5 minutes</strong>. If you
        didn’t request this, you can safely ignore this email.
      </div>

      {/* Footer */}
      <div
        style={{
          borderTop: "1px solid #e9edf2",
          paddingTop: "24px",
          fontSize: "14px",
          color: "#64748b",
          textAlign: "center" as const,
        }}
      >
        <p style={{ margin: "0 0 4px 0" }}>Thanks for using 246801357.xyz</p>
        <p style={{ margin: 0, fontSize: "13px", color: "#94a3b8" }}>— The Team</p>
      </div>
    </div>
  );
}

VerificationTemplate.PreviewProps = {
  code: '123456',
};

export default VerificationTemplate;