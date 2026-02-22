-- Connect to your Supabase SQL Editor and run all of this script to fix the 401 Unauthorized errors and allow players to see each other.
-- This script safely enables Row Level Security (RLS) but allows all anonymous connections (the game clients) to read, insert, update, and delete.

-- 1. Create Tables (if they don't exist yet)
CREATE TABLE IF NOT EXISTS players (
    id UUID PRIMARY KEY,
    name TEXT NOT NULL,
    x FLOAT NOT NULL,
    y FLOAT NOT NULL,
    z FLOAT NOT NULL,
    rotation_y FLOAT NOT NULL,
    room TEXT NOT NULL,
    last_updated TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS chat_messages (
    id BIGSERIAL PRIMARY KEY,
    player_id UUID NOT NULL,
    player_name TEXT NOT NULL,
    message TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS game_state (
    id INT PRIMARY KEY,
    lock_key BOOLEAN DEFAULT FALSE,
    lock_tool BOOLEAN DEFAULT FALSE,
    lock_code BOOLEAN DEFAULT FALSE
);

-- Safely add the day column if it doesn't exist yet
ALTER TABLE game_state ADD COLUMN IF NOT EXISTS day INT DEFAULT 1;

-- Insert initial game state row if empty
INSERT INTO game_state (id, lock_key, lock_tool, lock_code) 
VALUES (1, FALSE, FALSE, FALSE)
ON CONFLICT (id) DO NOTHING;

-- 2. Realtime is already enabled for these tables. Skip this step.

-- 3. Fix 401 Unauthorized by configuring Row Level Security (RLS)
-- Enable RLS for all tables
ALTER TABLE players ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE game_state ENABLE ROW LEVEL SECURITY;

-- Drop old policies if they exist to start fresh
DROP POLICY IF EXISTS "Enable all operations for anon" ON players;
DROP POLICY IF EXISTS "Enable all operations for anon" ON chat_messages;
DROP POLICY IF EXISTS "Enable all operations for anon" ON game_state;

-- Create ALL permissions policies for anon roles so the game works purely client-side
CREATE POLICY "Enable all operations for anon" ON players FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Enable all operations for anon" ON chat_messages FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Enable all operations for anon" ON game_state FOR ALL TO anon USING (true) WITH CHECK (true);
