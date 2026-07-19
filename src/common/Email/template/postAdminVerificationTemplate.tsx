import React from 'react';

const PostAdminVerificationTemplate = ({ link }: { link: string }): React.ReactNode => (
  <div style={{ fontFamily: 'Arial, sans-serif', color: '#1e293b', lineHeight: '1.6' }}>
    <h2>Post administrator registration</h2>
    <p>Click the button below to complete your Post administrator registration.</p>
    <div style={{ textAlign: 'center', margin: '24px 0' }}>
      <a
        href={link}
        style={{
          display: 'inline-block',
          backgroundColor: '#1677ff',
          color: '#ffffff',
          textDecoration: 'none',
          padding: '12px 24px',
          borderRadius: '8px',
          fontSize: '16px',
          fontWeight: 'bold',
        }}
      >
        Complete Registration
      </a>
    </div>
    <p>Or copy and paste this link into your browser:</p>
    <p style={{ wordBreak: 'break-all', color: '#1677ff' }}>{link}</p>
    <p>This link expires in 30 minutes and can only be used once.</p>
    <p>If you did not request this registration, ignore this email.</p>
  </div>
);

PostAdminVerificationTemplate.PreviewProps = {
  link: 'https://post.246801357.xyz/server/register/username/test%40example.com/abc123def456',
};

export default PostAdminVerificationTemplate;
