CREATE TABLE IF NOT EXISTS admins (
    id VARCHAR(20) NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    primary key (id)
);

CREATE TABLE IF NOT EXISTS users (
    id VARCHAR(20) NOT NULL,
    servers VARCHAR(20)[] NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    primary key (id)
);

CREATE TABLE IF NOT EXISTS spammers (
    id VARCHAR(20) NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    screenshot_proof VARCHAR(50),
    explanation TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_changed_by VARCHAR(20) NOT NULL,
    primary key (id)
);

CREATE TABLE IF NOT EXISTS server_configs (
    server_id VARCHAR(20) NOT NULL,
    log_channel VARCHAR(20),
    ping_users BOOLEAN NOT NULL DEFAULT FALSE,
    action_level INT NOT NULL DEFAULT 0,
    timeout_users_with_role BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    primary key (server_id)
);
