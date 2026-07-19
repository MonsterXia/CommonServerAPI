import React from 'react';

const PostAdminVerificationTemplate = ({ code }: { code: string }): React.ReactNode => (
  <div style={{ fontFamily: 'Arial, sans-serif', color: '#1e293b', lineHeight: '1.6' }}>
    <h2>Post administrator registration</h2>
    <p>Use the verification code below to complete your Post administrator registration.</p>
    <div
      style={{
        backgroundColor: '#f1f5f9',
        borderRadius: '8px',
        fontFamily: 'monospace',
        fontSize: '32px',
        fontWeight: 'bold',
        letterSpacing: '8px',
        textAlign: 'center',
        padding: '16px',
      }}
    >
      {code}
    </div>
    <p>This code expires in 30 minutes and can only be used once.</p>
    <p>If you did not request this registration, ignore this email.</p>
  </div>
);

PostAdminVerificationTemplate.PreviewProps = {
  code: '123456',
};

export default PostAdminVerificationTemplate;
