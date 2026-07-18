import React from 'react';

const PostAdminVerificationTemplate = ({ token }: { token: string }): React.ReactNode => (
  <div style={{ fontFamily: 'Arial, sans-serif', color: '#1e293b', lineHeight: '1.6' }}>
    <h2>Post administrator registration</h2>
    <p>Use the verification token below to complete your Post administrator registration.</p>
    <div
      style={{
        backgroundColor: '#f1f5f9',
        borderRadius: '8px',
        fontFamily: 'monospace',
        fontSize: '20px',
        overflowWrap: 'anywhere',
        padding: '16px',
      }}
    >
      {token}
    </div>
    <p>This token expires in 30 minutes and can only be used once.</p>
    <p>If you did not request this registration, ignore this email.</p>
  </div>
);

PostAdminVerificationTemplate.PreviewProps = {
  token: '1234567890abcdef1234567890abcdef',
};

export default PostAdminVerificationTemplate;
