CREATE TABLE IF NOT EXISTS users (
  wallet_address    VARCHAR(42) PRIMARY KEY,
  name              VARCHAR(255),
  phone             VARCHAR(20),
  role              VARCHAR(20) DEFAULT 'sender',
  wallet_verified   BOOLEAN DEFAULT false,
  kyc_status        VARCHAR(20) DEFAULT 'none',
  kyc_level         VARCHAR(50) DEFAULT 'none',
  kyc_applicant_id  VARCHAR(100),
  created_at        TIMESTAMP DEFAULT NOW()
);

ALTER TABLE users ADD COLUMN IF NOT EXISTS wallet_verified BOOLEAN DEFAULT false;

CREATE TABLE IF NOT EXISTS riders (
  wallet_address   VARCHAR(42) PRIMARY KEY REFERENCES users(wallet_address),
  vehicle_type     VARCHAR(50),
  rating           DECIMAL(3,2) DEFAULT 5.00,
  total_deliveries INTEGER DEFAULT 0,
  is_active        BOOLEAN DEFAULT true,
  kyc_nin          BOOLEAN DEFAULT false,
  kyc_license      BOOLEAN DEFAULT false,
  created_at       TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS jobs (
  id                            SERIAL PRIMARY KEY,
  job_id                        INTEGER UNIQUE NOT NULL,
  sender                        VARCHAR(42) NOT NULL,
  recipient                     VARCHAR(42) NOT NULL,
  rider                         VARCHAR(42),
  amount                        DECIMAL(36,18) NOT NULL,
  encrypted_pickup_location     TEXT,
  encrypted_delivery_location   TEXT,
  location_salt                 TEXT,
  pickup_location_hash          VARCHAR(66),
  delivery_location_hash        VARCHAR(66),
  status                        VARCHAR(20) DEFAULT 'created',
  token                         VARCHAR(42) DEFAULT '0x0000000000000000000000000000000000000000',
  deadline                      TIMESTAMP,
  created_at                    TIMESTAMP DEFAULT NOW(),
  updated_at                    TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS transactions (
  id           SERIAL PRIMARY KEY,
  job_id       INTEGER REFERENCES jobs(id),
  tx_hash      VARCHAR(66) NOT NULL,
  block_number INTEGER,
  event_type   VARCHAR(50) NOT NULL,
  data         JSONB,
  created_at   TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs(status);
CREATE INDEX IF NOT EXISTS idx_jobs_sender ON jobs(sender);
CREATE INDEX IF NOT EXISTS idx_jobs_rider ON jobs(rider);
CREATE INDEX IF NOT EXISTS idx_jobs_job_id ON jobs(job_id);
CREATE INDEX IF NOT EXISTS idx_jobs_pickup_hash ON jobs(pickup_location_hash);
CREATE INDEX IF NOT EXISTS idx_transactions_job_id ON transactions(job_id);
CREATE INDEX IF NOT EXISTS idx_transactions_tx_hash ON transactions(tx_hash);
