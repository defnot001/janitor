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

CREATE TABLE IF NOT EXISTS bad_actors (
    id SERIAL PRIMARY KEY,
    user_id VARCHAR(20) NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    actor_type VARCHAR(15) NOT NULL,
    originally_created_in VARCHAR(20) NOT NULL,
    screenshot_proof VARCHAR(50),
    explanation TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_changed_by VARCHAR(20) NOT NULL
);

CREATE TABLE IF NOT EXISTS server_configs (
    server_id VARCHAR(20) NOT NULL,
    log_channel VARCHAR(20),
    ping_users BOOLEAN NOT NULL DEFAULT FALSE,
    action_level INT NOT NULL DEFAULT 0,
    timeout_users_with_role BOOLEAN NOT NULL DEFAULT FALSE,
    ignored_roles VARCHAR(20)[] NOT NULL DEFAULT '{}',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    primary key (server_id)
);

CREATE TABLE IF NOT EXISTS server_users (
    server_id VARCHAR(20) NOT NULL,
    user_id VARCHAR(20) NOT NULL,
    FOREIGN KEY (server_id) REFERENCES server_configs(server_id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    PRIMARY KEY (server_id, user_id)
);