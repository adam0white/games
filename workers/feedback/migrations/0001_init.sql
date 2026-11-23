-- One row per note from a tester ('in') or reply to a tester ('out').
CREATE TABLE messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tester TEXT NOT NULL,
  dir TEXT NOT NULL CHECK (dir IN ('in', 'out')),
  kind TEXT NOT NULL CHECK (kind IN ('text', 'voice')),
  game TEXT,
  build TEXT,
  -- 'in': the tester's words (typed, or the transcript). 'out': what the lab wrote.
  body TEXT,
  lang TEXT,
  -- 'in': English translation. 'out': the translation shown to the tester.
  translated TEXT,
  audio_key TEXT,
  audio_type TEXT,
  -- 'pending' until transcription and translation finish; 'failed' keeps the audio for a retry.
  status TEXT NOT NULL DEFAULT 'ready' CHECK (status IN ('ready', 'pending', 'failed')),
  error TEXT,
  client_id TEXT,
  created_at INTEGER NOT NULL,
  handled_at INTEGER,
  seen_at INTEGER
);
CREATE UNIQUE INDEX messages_client ON messages (tester, client_id) WHERE client_id IS NOT NULL;
CREATE INDEX messages_tester ON messages (tester, id);
CREATE INDEX messages_unhandled ON messages (dir, handled_at, id);
