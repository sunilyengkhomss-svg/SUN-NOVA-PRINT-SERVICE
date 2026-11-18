-- SUN-NOVA PRINT SERVICE · Cloudflare D1 Database Schema (Migration 0001)

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS admins (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('super_admin', 'admin', 'content_manager')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'disabled')),
  reset_token_hash TEXT,
  reset_token_expires_at TEXT,
  last_login_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS admin_sessions (
  id TEXT PRIMARY KEY,
  admin_id TEXT NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  ip_address TEXT,
  user_agent TEXT,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY (admin_id) REFERENCES admins(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_admin_sessions_token ON admin_sessions(token_hash);
CREATE INDEX IF NOT EXISTS idx_admin_sessions_admin ON admin_sessions(admin_id);

CREATE TABLE IF NOT EXISTS media_files (
  id TEXT PRIMARY KEY,
  r2_key TEXT NOT NULL UNIQUE,
  filename TEXT NOT NULL,
  original_name TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  file_size INTEGER NOT NULL,
  category TEXT NOT NULL DEFAULT 'image',
  visibility TEXT NOT NULL DEFAULT 'public' CHECK (visibility IN ('public', 'private')),
  public_url TEXT,
  uploaded_by TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (uploaded_by) REFERENCES admins(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_media_files_category ON media_files(category);
CREATE INDEX IF NOT EXISTS idx_media_files_visibility ON media_files(visibility);

CREATE TABLE IF NOT EXISTS outfit_templates (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('Student', 'Officer', 'Men', 'Women', 'Formal', 'Custom')),
  builtin_style_id TEXT,
  media_id TEXT,
  image_url TEXT,
  display_order INTEGER NOT NULL DEFAULT 0,
  is_published INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (media_id) REFERENCES media_files(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS background_presets (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  preset_type TEXT NOT NULL DEFAULT 'color' CHECK (preset_type IN ('color', 'image')),
  hex_color TEXT,
  media_id TEXT,
  image_url TEXT,
  display_order INTEGER NOT NULL DEFAULT 0,
  is_published INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (media_id) REFERENCES media_files(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS sample_portraits (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  media_id TEXT,
  image_url TEXT NOT NULL,
  display_order INTEGER NOT NULL DEFAULT 0,
  is_published INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (media_id) REFERENCES media_files(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS website_settings (
  setting_key TEXT PRIMARY KEY,
  setting_value TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS services (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'Commercial Printing',
  studio_mode TEXT,
  media_id TEXT,
  image_url TEXT,
  display_order INTEGER NOT NULL DEFAULT 0,
  is_published INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (media_id) REFERENCES media_files(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS portfolio_items (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  subtitle TEXT NOT NULL,
  category TEXT NOT NULL,
  media_id TEXT,
  image_url TEXT,
  display_order INTEGER NOT NULL DEFAULT 0,
  is_published INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (media_id) REFERENCES media_files(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS quote_requests (
  id TEXT PRIMARY KEY,
  customer_name TEXT NOT NULL,
  customer_email TEXT NOT NULL,
  phone_number TEXT,
  service_type TEXT NOT NULL,
  quantity TEXT NOT NULL,
  paper_size TEXT NOT NULL,
  material TEXT,
  color_mode TEXT,
  description TEXT,
  attachment_media_id TEXT,
  attachment_name TEXT,
  status TEXT NOT NULL DEFAULT 'New' CHECK (status IN ('New', 'Pending', 'Contacted', 'Quoted', 'Completed', 'Cancelled')),
  internal_notes TEXT DEFAULT '',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (attachment_media_id) REFERENCES media_files(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_quote_requests_status ON quote_requests(status);

CREATE TABLE IF NOT EXISTS contact_messages (
  id TEXT PRIMARY KEY,
  customer_name TEXT NOT NULL,
  customer_email TEXT NOT NULL,
  phone_number TEXT,
  subject TEXT NOT NULL,
  message TEXT NOT NULL,
  is_read INTEGER NOT NULL DEFAULT 0,
  reply_note TEXT DEFAULT '',
  replied_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_contact_messages_read ON contact_messages(is_read);

CREATE TABLE IF NOT EXISTS activity_logs (
  id TEXT PRIMARY KEY,
  admin_id TEXT,
  admin_email TEXT,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT,
  details TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (admin_id) REFERENCES admins(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_activity_logs_created ON activity_logs(created_at);

CREATE TABLE IF NOT EXISTS rate_limits (
  rate_key TEXT PRIMARY KEY,
  hits INTEGER NOT NULL DEFAULT 1,
  window_start INTEGER NOT NULL
);
