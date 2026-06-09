CREATE TABLE IF NOT EXISTS scoring_tasks (
  id VARCHAR(64) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  start_at DATETIME,
  end_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
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
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
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
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS scores (
  id VARCHAR(64) PRIMARY KEY,
  assignment_id VARCHAR(64) NOT NULL,
  topic_id VARCHAR(64) NOT NULL,
  reviewer_id VARCHAR(128) NOT NULL,
  reviewer_name VARCHAR(128),
  problem_value INT NOT NULL,
  usage_depth INT NOT NULL,
  delivery_quality INT NOT NULL,
  reuse_asset INT NOT NULL,
  total INT NOT NULL,
  grade VARCHAR(32) NOT NULL,
  comment TEXT NOT NULL,
  highlights TEXT,
  suggestions TEXT,
  recommend_case BOOLEAN DEFAULT FALSE,
  submitted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_assignment_reviewer (assignment_id, reviewer_id),
  INDEX idx_scores_topic_id (topic_id),
  INDEX idx_scores_reviewer_id (reviewer_id)
);
