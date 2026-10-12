-- Online multiplayer. Rooms are authoritative in server memory and written through to this table
-- so they survive a server restart. Tickets are single-use, short-lived WebSocket credentials.
CREATE TABLE mp_tickets (
  ticket_hash text PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at timestamptz NOT NULL
);
CREATE INDEX mp_tickets_expires_idx ON mp_tickets (expires_at);

CREATE TABLE mp_rooms (
  code text PRIMARY KEY,
  host_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  game text NOT NULL,
  max_players integer NOT NULL CHECK (max_players BETWEEN 2 AND 4),
  status text NOT NULL CHECK (status IN ('lobby', 'playing', 'finished', 'closed')),
  players jsonb NOT NULL,
  state jsonb,
  seq integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX mp_rooms_status_idx ON mp_rooms (status, updated_at);

CREATE TABLE mp_results (
  id bigserial PRIMARY KEY,
  room_code text NOT NULL,
  game text NOT NULL,
  players jsonb NOT NULL,
  winners jsonb NOT NULL,
  scores jsonb NOT NULL,
  finished_at timestamptz NOT NULL DEFAULT now()
);
