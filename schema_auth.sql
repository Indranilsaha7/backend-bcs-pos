CREATE TABLE users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    security_code TEXT,
    device_token TEXT,
    role TEXT CHECK(role IN ('admin', 'employee')) NOT NULL DEFAULT 'employee',
    permissions TEXT
);
