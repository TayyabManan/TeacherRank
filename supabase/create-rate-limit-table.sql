-- Create rate limit logs table
CREATE TABLE IF NOT EXISTS rate_limit_logs (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  key text NOT NULL,
  timestamp timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_rate_limit_key ON rate_limit_logs(key);
CREATE INDEX IF NOT EXISTS idx_rate_limit_timestamp ON rate_limit_logs(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_rate_limit_key_timestamp ON rate_limit_logs(key, timestamp DESC);

-- Enable RLS
ALTER TABLE rate_limit_logs ENABLE ROW LEVEL SECURITY;

-- Only service role can access this table
CREATE POLICY "Service role only" ON rate_limit_logs
  FOR ALL USING (auth.role() = 'service_role');

-- Auto-cleanup old entries (older than 1 hour)
CREATE OR REPLACE FUNCTION cleanup_old_rate_limits()
RETURNS void AS $$
BEGIN
  DELETE FROM rate_limit_logs 
  WHERE timestamp < NOW() - INTERVAL '1 hour';
END;
$$ LANGUAGE plpgsql;

-- Schedule cleanup every hour (requires pg_cron extension)
-- If pg_cron is not available, this can be called manually or from edge function
-- SELECT cron.schedule('cleanup-rate-limits', '0 * * * *', 'SELECT cleanup_old_rate_limits();');