-- Questions the lab asks a tester, answers tied to a question, and replies that carry a link or an image.
ALTER TABLE messages ADD COLUMN ask INTEGER NOT NULL DEFAULT 0;   -- 'out': 1 when the row is a question
ALTER TABLE messages ADD COLUMN choices TEXT;                     -- 'out' question: JSON list of one-tap answers
ALTER TABLE messages ADD COLUMN link TEXT;                        -- 'out': a path on this site, such as /proto/lantern/
ALTER TABLE messages ADD COLUMN image_key TEXT;                   -- 'out': an image in R2
ALTER TABLE messages ADD COLUMN image_type TEXT;
ALTER TABLE messages ADD COLUMN reply_to INTEGER;                 -- 'in': the question this note answers
ALTER TABLE messages ADD COLUMN closed_at INTEGER;                -- 'out' question: withdrawn by the lab
CREATE INDEX messages_reply_to ON messages (tester, reply_to) WHERE reply_to IS NOT NULL;
