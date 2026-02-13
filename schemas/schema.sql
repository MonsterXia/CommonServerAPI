DROP TABLE IF EXISTS admins;
CREATE TABLE IF NOT EXISTS admins (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    phone_number TEXT,
    email TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO admins (username, password_hash, phone_number, email) VALUES
('eason_xia', 'hashed_password_123', '123-456-7890', 'example@example.com');