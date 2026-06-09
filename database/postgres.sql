CREATE TABLE IF NOT EXISTS scoring_tasks (
  id VARCHAR(64) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  start_at TIMESTAMP,
  end_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS topics (
  id VARCHAR(64) PRIMARY KEY,
  feishu_record_id VARCHAR(128),
  task_id VARCHAR(64),
  title VARCHAR(255) NOT NULL,
  topic_type VARCHAR(32),
  owner_name VARCHAR(255),
  department VARCHAR(255),
  apply_level VARCHAR(32),
  material_url TEXT,
  product_url TEXT,
  summary TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS reviewer_assignments (
  id VARCHAR(64) PRIMARY KEY,
  feishu_record_id VARCHAR(128),
  task_id VARCHAR(64),
  topic_id VARCHAR(64) NOT NULL,
  reviewer_user_id VARCHAR(128),
  reviewer_open_id VARCHAR(128),
  reviewer_name VARCHAR(128),
  review_type VARCHAR(64),
  required_flag BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS scores (
  id VARCHAR(64) PRIMARY KEY,
  assignment_id VARCHAR(64) NOT NULL,
  topic_id VARCHAR(64) NOT NULL,
  reviewer_id VARCHAR(128) NOT NULL,
  reviewer_name VARCHAR(128),
  problem_value INT NOT NULL CHECK (problem_value BETWEEN 0 AND 35),
  usage_depth INT NOT NULL CHECK (usage_depth BETWEEN 0 AND 25),
  delivery_quality INT NOT NULL CHECK (delivery_quality BETWEEN 0 AND 25),
  reuse_asset INT NOT NULL CHECK (reuse_asset BETWEEN 0 AND 15),
  total INT NOT NULL CHECK (total BETWEEN 0 AND 100),
  grade VARCHAR(32) NOT NULL,
  comment TEXT NOT NULL,
  highlights TEXT,
  suggestions TEXT,
  recommend_case BOOLEAN DEFAULT FALSE,
  submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (assignment_id, reviewer_id)
);

CREATE INDEX IF NOT EXISTS idx_scores_topic_id ON scores(topic_id);
CREATE INDEX IF NOT EXISTS idx_assignments_reviewer_user_id ON reviewer_assignments(reviewer_user_id);
CREATE INDEX IF NOT EXISTS idx_assignments_reviewer_open_id ON reviewer_assignments(reviewer_open_id);
