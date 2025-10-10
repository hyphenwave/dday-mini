-- Core tables for game data
CREATE TABLE IF NOT EXISTS countries (
    id SMALLINT PRIMARY KEY,  -- 1-211
    name VARCHAR(100),
    mint_address VARCHAR(44) NOT NULL,
    mode VARCHAR(10) DEFAULT 'Curve', -- 'Curve' or 'Amm'
    status VARCHAR(10) DEFAULT 'Active', -- 'Active' or 'Nuked'
    current_price DECIMAL(20, 9),
    market_cap DECIMAL(20, 2),
    last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS presidents (
    country_id SMALLINT PRIMARY KEY REFERENCES countries(id),
    wallet_address VARCHAR(44) NOT NULL,
    token_balance BIGINT NOT NULL,
    became_president_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS president_history (
    id SERIAL PRIMARY KEY,
    country_id SMALLINT REFERENCES countries(id),
    wallet_address VARCHAR(44) NOT NULL,
    token_balance BIGINT NOT NULL,
    started_at TIMESTAMP NOT NULL,
    ended_at TIMESTAMP
);

CREATE TABLE IF NOT EXISTS price_history (
    id SERIAL PRIMARY KEY,
    country_id SMALLINT REFERENCES countries(id),
    price DECIMAL(20, 9) NOT NULL,
    market_cap DECIMAL(20, 2) NOT NULL,
    supply_circulating BIGINT NOT NULL,
    mode VARCHAR(10) NOT NULL,
    recorded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS rounds (
    round_number INT PRIMARY KEY,
    started_at TIMESTAMP NOT NULL,
    ended_at TIMESTAMP,
    winner_country_id SMALLINT REFERENCES countries(id),
    countries_remaining SMALLINT,
    prize_pool_lamports BIGINT
);

CREATE TABLE IF NOT EXISTS nukes (
    id SERIAL PRIMARY KEY,
    round_number INT REFERENCES rounds(round_number),
    attacker_country_id SMALLINT REFERENCES countries(id),
    target_country_id SMALLINT REFERENCES countries(id),
    random_beneficiary_id SMALLINT REFERENCES countries(id),
    sol_rugged BIGINT,
    executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS chat_messages (
    id SERIAL PRIMARY KEY,
    sender_wallet VARCHAR(44) NOT NULL,
    country_id SMALLINT REFERENCES countries(id),
    message TEXT NOT NULL,
    sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_price_history_country_time ON price_history(country_id, recorded_at DESC);
CREATE INDEX IF NOT EXISTS idx_chat_country_time ON chat_messages(country_id, sent_at DESC);
CREATE INDEX IF NOT EXISTS idx_presidents_updated ON presidents(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_countries_market_cap ON countries(market_cap DESC);
CREATE INDEX IF NOT EXISTS idx_nukes_round ON nukes(round_number);