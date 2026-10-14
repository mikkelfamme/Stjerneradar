CREATE TABLE IF NOT EXISTS installations (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  lat REAL NOT NULL, lon REAL NOT NULL, tz TEXT NOT NULL,
  light TEXT NOT NULL DEFAULT 'unknown', mode TEXT NOT NULL DEFAULT 'eyes',
  threshold INTEGER NOT NULL DEFAULT 80, min_hours INTEGER NOT NULL DEFAULT 1,
  notify_early INTEGER NOT NULL DEFAULT 1,
  notify_late INTEGER NOT NULL DEFAULT 1,
  notify_clearing INTEGER NOT NULL DEFAULT 1,
  notify_events INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL,
  last_check_at INTEGER, last_reason TEXT, dedup_count INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS subscriptions (
  endpoint TEXT PRIMARY KEY, installation_id TEXT NOT NULL,
  p256dh TEXT NOT NULL, auth TEXT NOT NULL,
  created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL,
  FOREIGN KEY(installation_id) REFERENCES installations(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_subscriptions_installation ON subscriptions(installation_id);
CREATE TABLE IF NOT EXISTS sent_notices (
  installation_id TEXT NOT NULL, notice_key TEXT NOT NULL, kind TEXT NOT NULL,
  local_date TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'reserved',
  sent_at INTEGER NOT NULL, detail TEXT,
  PRIMARY KEY(installation_id, notice_key),
  FOREIGN KEY(installation_id) REFERENCES installations(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_sent_notices_day ON sent_notices(installation_id, local_date, kind, status);
CREATE TABLE IF NOT EXISTS forecast_snapshots (
  installation_id TEXT NOT NULL, hour_time INTEGER NOT NULL,
  score INTEGER NOT NULL, saved_at INTEGER NOT NULL,
  PRIMARY KEY(installation_id, hour_time),
  FOREIGN KEY(installation_id) REFERENCES installations(id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS external_cache (
  key TEXT PRIMARY KEY, contents TEXT NOT NULL, updated_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);
