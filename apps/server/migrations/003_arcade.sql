-- Arcade (entertainment games) stats, synced optionally when the user is signed in.
-- Separate from game_progress so the 15 educational games keep their own schema.
CREATE TABLE arcade_progress (
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  game_id text NOT NULL,
  record jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, game_id)
);
