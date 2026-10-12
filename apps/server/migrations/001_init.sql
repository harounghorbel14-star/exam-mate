-- ExamMate initial schema. Every user-owned row carries user_id with ON DELETE CASCADE so
-- account deletion removes all personal data. Ownership is enforced in every query.

CREATE TABLE users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  password_hash text NOT NULL,
  display_name text NOT NULL,
  role text NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin')),
  email_verified_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX users_email_lower ON users (lower(email));

CREATE TABLE sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE,
  user_agent text,
  ip text,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_used_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL
);
CREATE INDEX sessions_user ON sessions (user_id);

CREATE TABLE email_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  purpose text NOT NULL CHECK (purpose IN ('verify', 'reset')),
  token_hash text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Development mailer: messages are written here instead of being sent when no SMTP is configured.
CREATE TABLE outbox_emails (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  to_email text NOT NULL,
  subject text NOT NULL,
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  sent_at timestamptz
);

CREATE TABLE profiles (
  user_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  academic_level text,
  subjects text[] NOT NULL DEFAULT '{}',
  goals text[] NOT NULL DEFAULT '{}',
  locale text NOT NULL DEFAULT 'en' CHECK (locale IN ('en', 'fr', 'ar')),
  onboarded boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE preferences (
  user_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  explanation_style text NOT NULL DEFAULT 'steps' CHECK (explanation_style IN ('short', 'steps', 'simple', 'hint')),
  theme text NOT NULL DEFAULT 'system' CHECK (theme IN ('dark', 'light', 'system')),
  speech_rate real NOT NULL DEFAULT 1.0 CHECK (speech_rate BETWEEN 0.5 AND 2.0),
  voice text,
  memory_enabled boolean NOT NULL DEFAULT true,
  assessment_mode boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE study_subjects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name text NOT NULL,
  color text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, name)
);

CREATE TABLE documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  subject_id uuid REFERENCES study_subjects(id) ON DELETE SET NULL,
  course text,
  exam text,
  title text NOT NULL,
  filename text NOT NULL,
  mime text NOT NULL,
  size_bytes integer NOT NULL,
  sha256 text NOT NULL,
  storage_key text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'ready', 'failed')),
  error text,
  page_count integer,
  language text,
  created_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz
);
CREATE INDEX documents_user ON documents (user_id, created_at DESC);

-- Retrieval index: one row per chunk with a 'simple' (language-agnostic) full-text vector.
CREATE TABLE document_chunks (
  id bigserial PRIMARY KEY,
  document_id uuid NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  page integer,
  section text,
  ordinal integer NOT NULL,
  content text NOT NULL,
  tsv tsvector GENERATED ALWAYS AS (to_tsvector('simple', content)) STORED
);
CREATE INDEX document_chunks_doc ON document_chunks (document_id, ordinal);
CREATE INDEX document_chunks_tsv ON document_chunks USING gin (tsv);
CREATE INDEX document_chunks_user ON document_chunks (user_id);

CREATE TABLE questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  text text NOT NULL,
  subject text,
  question_type text,
  language text,
  source text NOT NULL DEFAULT 'typed' CHECK (source IN ('typed', 'scan', 'voice', 'document')),
  saved boolean NOT NULL DEFAULT false,
  bookmarked boolean NOT NULL DEFAULT false,
  tags text[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX questions_user ON questions (user_id, created_at DESC);

CREATE TABLE solutions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id uuid NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  mode text NOT NULL,
  engine text NOT NULL,
  tool text,
  status text NOT NULL,
  answer text,
  confidence text NOT NULL,
  payload jsonb NOT NULL,
  verification jsonb NOT NULL DEFAULT '[]',
  latency_ms integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX solutions_question ON solutions (question_id);
CREATE INDEX solutions_user ON solutions (user_id, created_at DESC);

CREATE TABLE feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  solution_id uuid REFERENCES solutions(id) ON DELETE CASCADE,
  helpful boolean,
  corrected_subject text,
  allow_training boolean NOT NULL DEFAULT false,
  question_text text,
  comment text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE flashcard_decks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title text NOT NULL,
  subject text,
  source_document_id uuid REFERENCES documents(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX decks_user ON flashcard_decks (user_id);

CREATE TABLE flashcards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  deck_id uuid NOT NULL REFERENCES flashcard_decks(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  front text NOT NULL,
  back text NOT NULL,
  kind text NOT NULL DEFAULT 'basic' CHECK (kind IN ('basic', 'formula', 'vocabulary', 'definition')),
  source_page integer,
  schedule jsonb,
  version integer NOT NULL DEFAULT 1,
  deleted boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX flashcards_deck ON flashcards (deck_id);
CREATE INDEX flashcards_due ON flashcards (user_id, ((schedule->>'dueAt')::bigint));

CREATE TABLE review_logs (
  id bigserial PRIMARY KEY,
  card_id uuid NOT NULL REFERENCES flashcards(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  rating text NOT NULL CHECK (rating IN ('again', 'hard', 'good', 'easy')),
  elapsed_ms integer,
  reviewed_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX review_logs_user ON review_logs (user_id, reviewed_at DESC);

-- owner_id NULL = bundled/public bank question.
CREATE TABLE question_bank (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid REFERENCES users(id) ON DELETE CASCADE,
  subject text NOT NULL,
  topic text NOT NULL,
  difficulty smallint NOT NULL CHECK (difficulty BETWEEN 1 AND 3),
  payload jsonb NOT NULL,
  source text NOT NULL DEFAULT 'bundled',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX question_bank_lookup ON question_bank (subject, topic, difficulty);
CREATE INDEX question_bank_owner ON question_bank (owner_id);

CREATE TABLE exam_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title text NOT NULL,
  config jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE exam_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  template_id uuid REFERENCES exam_templates(id) ON DELETE SET NULL,
  config jsonb NOT NULL,
  questions jsonb NOT NULL,
  responses jsonb NOT NULL DEFAULT '{}',
  timings jsonb NOT NULL DEFAULT '{}',
  grades jsonb,
  summary jsonb,
  strategy_mode boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'submitted', 'reviewed')),
  started_at timestamptz NOT NULL DEFAULT now(),
  deadline_at timestamptz NOT NULL,
  submitted_at timestamptz
);
CREATE INDEX exam_attempts_user ON exam_attempts (user_id, started_at DESC);

CREATE TABLE practice_records (
  id bigserial PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  subject text NOT NULL,
  topic text NOT NULL,
  correct boolean NOT NULL,
  time_spent real NOT NULL,
  expected_time real,
  mistake_tag text,
  source text NOT NULL,
  at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX practice_user ON practice_records (user_id, at DESC);

CREATE TABLE study_plan_overrides (
  user_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  exclude text[] NOT NULL DEFAULT '{}',
  pin text[] NOT NULL DEFAULT '{}',
  minutes_per_day integer NOT NULL DEFAULT 45,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE game_progress (
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  game_id text NOT NULL,
  record jsonb NOT NULL,
  version integer NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, game_id)
);

CREATE TABLE content_packs (
  id text PRIMARY KEY,
  game_id text,
  version text NOT NULL,
  title jsonb NOT NULL,
  payload jsonb NOT NULL,
  sha256 text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title text NOT NULL,
  body text NOT NULL DEFAULT '',
  version integer NOT NULL DEFAULT 1,
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX notes_user ON notes (user_id, updated_at DESC);

CREATE TABLE subscriptions (
  user_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  plan text NOT NULL DEFAULT 'free' CHECK (plan IN ('free', 'premium')),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'canceled', 'past_due')),
  provider text NOT NULL DEFAULT 'none',
  provider_ref text,
  current_period_end timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE billing_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind text NOT NULL,
  provider text NOT NULL,
  test_mode boolean NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE ai_usage (
  id bigserial PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  day date NOT NULL DEFAULT current_date,
  kind text NOT NULL,
  units integer NOT NULL DEFAULT 1,
  compute_ms integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ai_usage_user_day ON ai_usage (user_id, day, kind);

CREATE TABLE learning_memory (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('preference', 'level', 'subject', 'goal', 'concept', 'note')),
  key text NOT NULL,
  value text NOT NULL,
  source text NOT NULL CHECK (source IN ('user', 'inferred')),
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, kind, key)
);

-- Privacy-respecting traces: no raw question text, only a hash, tools used, timings and outcomes.
CREATE TABLE agent_traces (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id) ON DELETE CASCADE,
  task_kind text NOT NULL,
  input_hash text NOT NULL,
  plan jsonb NOT NULL,
  steps jsonb NOT NULL,
  outcome text NOT NULL,
  latency_ms integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX agent_traces_created ON agent_traces (created_at DESC);

CREATE TABLE model_registry (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL,
  version text NOT NULL,
  artifact jsonb NOT NULL,
  metrics jsonb NOT NULL,
  status text NOT NULL CHECK (status IN ('candidate', 'active', 'retired', 'rejected')),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  activated_at timestamptz,
  UNIQUE (kind, version)
);
CREATE UNIQUE INDEX model_registry_one_active ON model_registry (kind) WHERE status = 'active';

CREATE TABLE eval_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  suite text NOT NULL,
  dataset_version text NOT NULL,
  system_version text NOT NULL,
  metrics jsonb NOT NULL,
  results jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL,
  payload jsonb NOT NULL,
  status text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'running', 'done', 'failed')),
  attempts integer NOT NULL DEFAULT 0,
  max_attempts integer NOT NULL DEFAULT 3,
  run_at timestamptz NOT NULL DEFAULT now(),
  locked_at timestamptz,
  locked_by text,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz
);
CREATE INDEX jobs_ready ON jobs (status, run_at) WHERE status IN ('queued', 'running');

CREATE TABLE audit_log (
  id bigserial PRIMARY KEY,
  user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  event text NOT NULL,
  ip text,
  user_agent text,
  details jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX audit_log_user ON audit_log (user_id, created_at DESC);
