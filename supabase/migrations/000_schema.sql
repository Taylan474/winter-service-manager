-- ============================================
-- Winterdienst Tracker - Database Schema
-- ============================================
-- Run this file in your Supabase SQL Editor to set up the database.
-- This creates all tables, functions, policies, and indexes needed.
-- 
-- IMPORTANT: Run this ONCE on a fresh Supabase project.
-- ============================================

-- ============================================
-- SECTION 1: CORE TABLES
-- ============================================

-- USERS TABLE (extends auth.users)
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'gast' CHECK (role IN ('admin', 'mitarbeiter', 'gast')),
  password_changed BOOLEAN NOT NULL DEFAULT false,
  avatar_url TEXT,
  custom_permissions TEXT[] DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

COMMENT ON COLUMN users.password_changed IS 'Indicates if user has changed their initial temporary password';
COMMENT ON COLUMN users.custom_permissions IS 'Custom permissions for fine-grained access control';

-- CITIES TABLE
CREATE TABLE IF NOT EXISTS cities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- AREAS TABLE
CREATE TABLE IF NOT EXISTS areas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  city_id UUID NOT NULL REFERENCES cities(id) ON DELETE CASCADE,
  color TEXT DEFAULT '#6366f1',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(name, city_id)
);

-- STREETS TABLE
CREATE TABLE IF NOT EXISTS streets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  area_id UUID NOT NULL REFERENCES areas(id) ON DELETE CASCADE,
  priority INTEGER DEFAULT 3 CHECK (priority BETWEEN 1 AND 5),
  length_meters INTEGER,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(name, area_id)
);

-- DAILY STREET STATUS TABLE (current status summary)
CREATE TABLE IF NOT EXISTS daily_street_status (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  street_id UUID NOT NULL REFERENCES streets(id) ON DELETE CASCADE,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  status TEXT NOT NULL DEFAULT 'offen' CHECK (status IN ('offen', 'auf_dem_weg', 'erledigt')),
  started_at TIMESTAMP WITH TIME ZONE,
  finished_at TIMESTAMP WITH TIME ZONE,
  assigned_users UUID[] DEFAULT '{}',
  changed_by UUID REFERENCES users(id) ON DELETE SET NULL,
  current_round INTEGER DEFAULT 1,
  total_rounds INTEGER DEFAULT 1,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(street_id, date)
);

-- STREET STATUS ENTRIES TABLE (individual rounds per day)
CREATE TABLE IF NOT EXISTS street_status_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  street_id UUID NOT NULL REFERENCES streets(id) ON DELETE CASCADE,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  round_number INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'offen' CHECK (status IN ('offen', 'auf_dem_weg', 'erledigt')),
  started_at TIMESTAMP WITH TIME ZONE,
  finished_at TIMESTAMP WITH TIME ZONE,
  assigned_users UUID[] DEFAULT '{}',
  changed_by UUID REFERENCES users(id) ON DELETE SET NULL,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_street_status_entries_unique 
  ON street_status_entries(street_id, date, round_number);

-- WORK LOGS TABLE
CREATE TABLE IF NOT EXISTS work_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  street_id UUID REFERENCES streets(id) ON DELETE SET NULL,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  start_time TIME NOT NULL,
  end_time TIME,
  duration_minutes INTEGER,
  activity_type TEXT DEFAULT 'winterdienst',
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- USER PERMISSIONS TABLE
CREATE TABLE IF NOT EXISTS user_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  permission TEXT NOT NULL,
  granted_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, permission)
);

-- ============================================
-- SECTION 2: BILLING & INVOICING TABLES
-- ============================================

-- CUSTOMERS TABLE
CREATE TABLE IF NOT EXISTS customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  company TEXT,
  address TEXT,
  postal_code TEXT,
  city TEXT,
  email TEXT,
  phone TEXT,
  tax_id TEXT,
  notes TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- PRICING TABLE
CREATE TABLE IF NOT EXISTS pricing (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  unit TEXT NOT NULL, -- 'hour', 'meter', 'fixed', 'per_street'
  price_per_unit DECIMAL(10, 2) NOT NULL,
  tax_rate DECIMAL(5, 2) DEFAULT 19.00,
  is_active BOOLEAN DEFAULT true,
  valid_from DATE NOT NULL DEFAULT CURRENT_DATE,
  valid_until DATE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- INVOICE TEMPLATES TABLE
CREATE TABLE IF NOT EXISTS invoice_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  is_default BOOLEAN DEFAULT false,
  header_logo_url TEXT,
  header_text TEXT,
  footer_text TEXT,
  company_name TEXT,
  company_address TEXT,
  company_postal_code TEXT,
  company_city TEXT,
  company_tax_id TEXT,
  company_phone TEXT,
  company_email TEXT,
  company_website TEXT,
  company_bank_name TEXT,
  company_bank_iban TEXT,
  company_bank_bic TEXT,
  payment_terms TEXT DEFAULT 'Zahlbar innerhalb von 14 Tagen netto.',
  notes TEXT,
  css_styles TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- INVOICES TABLE
CREATE TABLE IF NOT EXISTS invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_number TEXT UNIQUE NOT NULL,
  customer_id UUID NOT NULL REFERENCES customers(id),
  template_id UUID REFERENCES invoice_templates(id),
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'paid', 'cancelled', 'overdue')),
  issue_date DATE NOT NULL DEFAULT CURRENT_DATE,
  due_date DATE NOT NULL,
  period_start DATE,
  period_end DATE,
  subtotal DECIMAL(10, 2) NOT NULL DEFAULT 0,
  tax_amount DECIMAL(10, 2) NOT NULL DEFAULT 0,
  total DECIMAL(10, 2) NOT NULL DEFAULT 0,
  notes TEXT,
  internal_notes TEXT,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- INVOICE LINE ITEMS TABLE
CREATE TABLE IF NOT EXISTS invoice_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  quantity DECIMAL(10, 3) NOT NULL DEFAULT 1,
  unit TEXT,
  price_per_unit DECIMAL(10, 2) NOT NULL,
  tax_rate DECIMAL(5, 2) DEFAULT 19.00,
  line_total DECIMAL(10, 2) NOT NULL,
  sort_order INTEGER DEFAULT 0,
  street_id UUID REFERENCES streets(id) ON DELETE SET NULL,
  work_log_id UUID REFERENCES work_logs(id) ON DELETE SET NULL,
  date_performed DATE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- SNAPSHOTS TABLE (for archiving invoices/reports)
CREATE TABLE IF NOT EXISTS snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  snapshot_type TEXT NOT NULL CHECK (snapshot_type IN ('invoice', 'report', 'pricing', 'template')),
  reference_id UUID NOT NULL,
  reference_number TEXT,
  customer_id UUID REFERENCES customers(id),
  snapshot_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  data JSONB NOT NULL,
  template_snapshot JSONB,
  pricing_snapshot JSONB,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  notes TEXT
);

-- REPORTS TABLE
CREATE TABLE IF NOT EXISTS reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_number TEXT UNIQUE NOT NULL,
  report_type TEXT NOT NULL CHECK (report_type IN ('daily', 'weekly', 'monthly', 'custom', 'work_summary')),
  title TEXT NOT NULL,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  customer_id UUID REFERENCES customers(id),
  data JSONB NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'finalized', 'archived')),
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- SECTION 3: SEQUENCES & NUMBER GENERATORS
-- ============================================

CREATE SEQUENCE IF NOT EXISTS invoice_number_seq START 1000;
CREATE SEQUENCE IF NOT EXISTS report_number_seq START 1000;

CREATE OR REPLACE FUNCTION generate_invoice_number()
RETURNS TEXT AS $$
DECLARE
  year_prefix TEXT;
  seq_num INTEGER;
BEGIN
  year_prefix := to_char(CURRENT_DATE, 'YYYY');
  seq_num := nextval('invoice_number_seq');
  RETURN 'RE-' || year_prefix || '-' || lpad(seq_num::TEXT, 5, '0');
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION generate_report_number()
RETURNS TEXT AS $$
DECLARE
  year_prefix TEXT;
  seq_num INTEGER;
BEGIN
  year_prefix := to_char(CURRENT_DATE, 'YYYY');
  seq_num := nextval('report_number_seq');
  RETURN 'BR-' || year_prefix || '-' || lpad(seq_num::TEXT, 5, '0');
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- SECTION 4: INDEXES
-- ============================================

-- Users indexes
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_custom_permissions ON users USING GIN (custom_permissions);

-- Location indexes
CREATE INDEX IF NOT EXISTS idx_areas_city_id ON areas(city_id);
CREATE INDEX IF NOT EXISTS idx_streets_area_id ON streets(area_id);

-- Status indexes
CREATE INDEX IF NOT EXISTS idx_daily_status_street ON daily_street_status(street_id);
CREATE INDEX IF NOT EXISTS idx_daily_status_date ON daily_street_status(date);
CREATE INDEX IF NOT EXISTS idx_daily_status_status ON daily_street_status(status);
CREATE INDEX IF NOT EXISTS idx_daily_street_status_street_date ON daily_street_status(street_id, date);

CREATE INDEX IF NOT EXISTS idx_street_status_entries_street ON street_status_entries(street_id);
CREATE INDEX IF NOT EXISTS idx_street_status_entries_date ON street_status_entries(date);
CREATE INDEX IF NOT EXISTS idx_street_status_entries_status ON street_status_entries(status);

-- Work logs indexes
CREATE INDEX IF NOT EXISTS idx_work_logs_user ON work_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_work_logs_date ON work_logs(date);
CREATE INDEX IF NOT EXISTS idx_work_logs_street ON work_logs(street_id);
CREATE INDEX IF NOT EXISTS idx_work_logs_user_date ON work_logs(user_id, date);

-- User permissions index
CREATE INDEX IF NOT EXISTS idx_user_permissions_user ON user_permissions(user_id);

-- Billing indexes
CREATE INDEX IF NOT EXISTS idx_customers_name ON customers(name);
CREATE INDEX IF NOT EXISTS idx_customers_active ON customers(is_active);
CREATE INDEX IF NOT EXISTS idx_pricing_active ON pricing(is_active);
CREATE INDEX IF NOT EXISTS idx_pricing_valid ON pricing(valid_from, valid_until);
CREATE INDEX IF NOT EXISTS idx_invoices_customer ON invoices(customer_id);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status);
CREATE INDEX IF NOT EXISTS idx_invoices_date ON invoices(issue_date);
CREATE INDEX IF NOT EXISTS idx_invoices_number ON invoices(invoice_number);
CREATE INDEX IF NOT EXISTS idx_invoice_items_invoice ON invoice_items(invoice_id);
CREATE INDEX IF NOT EXISTS idx_snapshots_type ON snapshots(snapshot_type);
CREATE INDEX IF NOT EXISTS idx_snapshots_reference ON snapshots(reference_id);
CREATE INDEX IF NOT EXISTS idx_snapshots_customer ON snapshots(customer_id);
CREATE INDEX IF NOT EXISTS idx_snapshots_date ON snapshots(snapshot_date);
CREATE INDEX IF NOT EXISTS idx_reports_type ON reports(report_type);
CREATE INDEX IF NOT EXISTS idx_reports_date ON reports(period_start, period_end);
CREATE INDEX IF NOT EXISTS idx_reports_customer ON reports(customer_id);

-- ============================================
-- SECTION 5: FUNCTIONS & TRIGGERS
-- ============================================

-- Updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply updated_at triggers to all tables
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_cities_updated_at BEFORE UPDATE ON cities FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_areas_updated_at BEFORE UPDATE ON areas FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_streets_updated_at BEFORE UPDATE ON streets FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_daily_status_updated_at BEFORE UPDATE ON daily_street_status FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_street_status_entries_updated_at BEFORE UPDATE ON street_status_entries FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_work_logs_updated_at BEFORE UPDATE ON work_logs FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_customers_updated_at BEFORE UPDATE ON customers FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_pricing_updated_at BEFORE UPDATE ON pricing FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_invoice_templates_updated_at BEFORE UPDATE ON invoice_templates FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_invoices_updated_at BEFORE UPDATE ON invoices FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_reports_updated_at BEFORE UPDATE ON reports FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Helper function to get user role (used by RLS policies)
CREATE OR REPLACE FUNCTION get_user_role(user_id UUID)
RETURNS TEXT AS $$
  SELECT role FROM public.users WHERE id = user_id;
$$ LANGUAGE sql SECURITY DEFINER STABLE;

GRANT EXECUTE ON FUNCTION get_user_role TO authenticated;

-- Helper function to get public tables (for backup functionality)
CREATE OR REPLACE FUNCTION get_public_tables()
RETURNS TABLE(table_name TEXT) AS $$
  SELECT tablename::TEXT 
  FROM pg_tables 
  WHERE schemaname = 'public' 
  ORDER BY tablename;
$$ LANGUAGE sql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION get_public_tables TO authenticated;
GRANT EXECUTE ON FUNCTION get_public_tables TO service_role;

-- Function to start a new round for a street
CREATE OR REPLACE FUNCTION start_new_round(
  p_street_id UUID,
  p_date DATE,
  p_user_id UUID
) RETURNS INTEGER AS $$
DECLARE
  v_current_round INTEGER;
  v_new_round INTEGER;
BEGIN
  SELECT COALESCE(MAX(round_number), 0) INTO v_current_round
  FROM street_status_entries
  WHERE street_id = p_street_id AND date = p_date;
  
  v_new_round := v_current_round + 1;
  
  INSERT INTO street_status_entries (
    street_id, date, round_number, status, changed_by
  ) VALUES (
    p_street_id, p_date, v_new_round, 'offen', p_user_id
  );
  
  UPDATE daily_street_status
  SET status = 'offen',
      current_round = v_new_round,
      total_rounds = v_new_round,
      started_at = NULL,
      finished_at = NULL,
      assigned_users = '{}',
      changed_by = p_user_id,
      updated_at = NOW()
  WHERE street_id = p_street_id AND date = p_date;
  
  RETURN v_new_round;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION start_new_round TO authenticated;

-- Function to clean up user references when user is deleted
CREATE OR REPLACE FUNCTION remove_user_from_assignments()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE daily_street_status 
  SET assigned_users = array_remove(assigned_users, OLD.id)
  WHERE OLD.id = ANY(assigned_users);
  
  UPDATE street_status_entries 
  SET assigned_users = array_remove(assigned_users, OLD.id)
  WHERE OLD.id = ANY(assigned_users);
  
  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER before_user_delete
  BEFORE DELETE ON users
  FOR EACH ROW
  EXECUTE FUNCTION remove_user_from_assignments();

-- ============================================
-- SECTION 6: ROW LEVEL SECURITY
-- ============================================

-- Enable RLS on all tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE cities ENABLE ROW LEVEL SECURITY;
ALTER TABLE areas ENABLE ROW LEVEL SECURITY;
ALTER TABLE streets ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_street_status ENABLE ROW LEVEL SECURITY;
ALTER TABLE street_status_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE work_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE pricing ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE reports ENABLE ROW LEVEL SECURITY;

-- ============================================
-- USERS POLICIES
-- ============================================

CREATE POLICY "users_select_authenticated"
  ON users FOR SELECT TO authenticated USING (true);

CREATE POLICY "users_insert_admin_only"
  ON users FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "users_update_restricted"
  ON users FOR UPDATE TO authenticated
  USING (auth.uid() = id OR EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'))
  WITH CHECK (
    CASE 
      WHEN EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin') THEN true
      WHEN auth.uid() = id THEN
        role = (SELECT role FROM users WHERE id = auth.uid()) AND
        custom_permissions = (SELECT custom_permissions FROM users WHERE id = auth.uid())
      ELSE false
    END
  );

CREATE POLICY "users_delete_admin_only"
  ON users FOR DELETE TO authenticated
  USING (get_user_role(auth.uid()) = 'admin' AND auth.uid() != id);

-- ============================================
-- CITIES POLICIES
-- ============================================

CREATE POLICY "cities_select_authenticated" ON cities FOR SELECT TO authenticated USING (true);
CREATE POLICY "cities_insert_admin" ON cities FOR INSERT TO authenticated WITH CHECK (get_user_role(auth.uid()) = 'admin');
CREATE POLICY "cities_update_admin" ON cities FOR UPDATE TO authenticated USING (get_user_role(auth.uid()) = 'admin') WITH CHECK (get_user_role(auth.uid()) = 'admin');
CREATE POLICY "cities_delete_admin" ON cities FOR DELETE TO authenticated USING (get_user_role(auth.uid()) = 'admin');

-- ============================================
-- AREAS POLICIES
-- ============================================

CREATE POLICY "areas_select_authenticated" ON areas FOR SELECT TO authenticated USING (true);
CREATE POLICY "areas_insert_admin" ON areas FOR INSERT TO authenticated WITH CHECK (get_user_role(auth.uid()) = 'admin');
CREATE POLICY "areas_update_admin" ON areas FOR UPDATE TO authenticated USING (get_user_role(auth.uid()) = 'admin') WITH CHECK (get_user_role(auth.uid()) = 'admin');
CREATE POLICY "areas_delete_admin" ON areas FOR DELETE TO authenticated USING (get_user_role(auth.uid()) = 'admin');

-- ============================================
-- STREETS POLICIES
-- ============================================

CREATE POLICY "streets_select_authenticated" ON streets FOR SELECT TO authenticated USING (true);
CREATE POLICY "streets_insert_admin" ON streets FOR INSERT TO authenticated WITH CHECK (get_user_role(auth.uid()) = 'admin');
CREATE POLICY "streets_update_admin" ON streets FOR UPDATE TO authenticated USING (get_user_role(auth.uid()) = 'admin') WITH CHECK (get_user_role(auth.uid()) = 'admin');
CREATE POLICY "streets_delete_admin" ON streets FOR DELETE TO authenticated USING (get_user_role(auth.uid()) = 'admin');

-- ============================================
-- DAILY_STREET_STATUS POLICIES
-- ============================================

CREATE POLICY "daily_street_status_select_authenticated" ON daily_street_status FOR SELECT TO authenticated USING (true);
CREATE POLICY "daily_street_status_insert_worker" ON daily_street_status FOR INSERT TO authenticated WITH CHECK (get_user_role(auth.uid()) IN ('admin', 'mitarbeiter'));
CREATE POLICY "daily_street_status_update_worker" ON daily_street_status FOR UPDATE TO authenticated USING (get_user_role(auth.uid()) IN ('admin', 'mitarbeiter')) WITH CHECK (get_user_role(auth.uid()) IN ('admin', 'mitarbeiter'));
CREATE POLICY "daily_street_status_delete_admin" ON daily_street_status FOR DELETE TO authenticated USING (get_user_role(auth.uid()) = 'admin');

-- ============================================
-- STREET_STATUS_ENTRIES POLICIES
-- ============================================

CREATE POLICY "street_status_entries_select" ON street_status_entries FOR SELECT TO authenticated USING (true);
CREATE POLICY "street_status_entries_insert" ON street_status_entries FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "street_status_entries_update" ON street_status_entries FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "street_status_entries_delete" ON street_status_entries FOR DELETE TO authenticated USING (true);
CREATE POLICY "street_status_entries_service" ON street_status_entries FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ============================================
-- WORK_LOGS POLICIES
-- ============================================

CREATE POLICY "work_logs_select_own_or_admin" ON work_logs FOR SELECT TO authenticated USING (user_id = auth.uid() OR get_user_role(auth.uid()) = 'admin');
CREATE POLICY "work_logs_insert_own" ON work_logs FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "work_logs_update_own" ON work_logs FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "work_logs_delete_own_or_admin" ON work_logs FOR DELETE TO authenticated USING (user_id = auth.uid() OR get_user_role(auth.uid()) = 'admin');

-- ============================================
-- USER_PERMISSIONS POLICIES
-- ============================================

CREATE POLICY "user_permissions_select" ON user_permissions FOR SELECT TO authenticated USING (true);
CREATE POLICY "user_permissions_admin" ON user_permissions FOR ALL TO authenticated USING (get_user_role(auth.uid()) = 'admin') WITH CHECK (get_user_role(auth.uid()) = 'admin');

-- ============================================
-- BILLING TABLE POLICIES
-- ============================================

-- Customers
CREATE POLICY "customers_select_authenticated" ON customers FOR SELECT TO authenticated USING (true);
CREATE POLICY "customers_insert_admin" ON customers FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'));
CREATE POLICY "customers_update_admin" ON customers FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'));
CREATE POLICY "customers_delete_admin" ON customers FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'));

-- Pricing
CREATE POLICY "pricing_select_authenticated" ON pricing FOR SELECT TO authenticated USING (true);
CREATE POLICY "pricing_insert_admin" ON pricing FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'));
CREATE POLICY "pricing_update_admin" ON pricing FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'));
CREATE POLICY "pricing_delete_admin" ON pricing FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'));

-- Templates
CREATE POLICY "templates_select_authenticated" ON invoice_templates FOR SELECT TO authenticated USING (true);
CREATE POLICY "templates_insert_admin" ON invoice_templates FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'));
CREATE POLICY "templates_update_admin" ON invoice_templates FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'));
CREATE POLICY "templates_delete_admin" ON invoice_templates FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'));

-- Invoices
CREATE POLICY "invoices_select_authenticated" ON invoices FOR SELECT TO authenticated USING (true);
CREATE POLICY "invoices_insert_admin" ON invoices FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'));
CREATE POLICY "invoices_update_admin" ON invoices FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'));
CREATE POLICY "invoices_delete_admin" ON invoices FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'));

-- Invoice Items
CREATE POLICY "invoice_items_select_authenticated" ON invoice_items FOR SELECT TO authenticated USING (true);
CREATE POLICY "invoice_items_insert_admin" ON invoice_items FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'));
CREATE POLICY "invoice_items_update_admin" ON invoice_items FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'));
CREATE POLICY "invoice_items_delete_admin" ON invoice_items FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'));

-- Snapshots
CREATE POLICY "snapshots_select_authenticated" ON snapshots FOR SELECT TO authenticated USING (true);
CREATE POLICY "snapshots_insert_admin" ON snapshots FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'));
CREATE POLICY "snapshots_update_admin" ON snapshots FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'));
CREATE POLICY "snapshots_delete_admin" ON snapshots FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'));

-- Reports
CREATE POLICY "reports_select_authenticated" ON reports FOR SELECT TO authenticated USING (true);
CREATE POLICY "reports_insert_worker" ON reports FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('admin', 'mitarbeiter')));
CREATE POLICY "reports_update_admin" ON reports FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'));
CREATE POLICY "reports_delete_admin" ON reports FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'));

-- ============================================
-- SECTION 7: REALTIME CONFIGURATION
-- ============================================

-- Set REPLICA IDENTITY FULL for realtime tables
ALTER TABLE daily_street_status REPLICA IDENTITY FULL;
ALTER TABLE street_status_entries REPLICA IDENTITY FULL;
ALTER TABLE users REPLICA IDENTITY FULL;
ALTER TABLE cities REPLICA IDENTITY FULL;
ALTER TABLE areas REPLICA IDENTITY FULL;
ALTER TABLE streets REPLICA IDENTITY FULL;

-- Add tables to realtime publication
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'daily_street_status') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE daily_street_status;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'street_status_entries') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE street_status_entries;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'users') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE users;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'cities') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE cities;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'areas') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE areas;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'streets') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE streets;
  END IF;
END $$;

-- ============================================
-- SECTION 8: ANALYZE TABLES
-- ============================================

ANALYZE users;
ANALYZE cities;
ANALYZE areas;
ANALYZE streets;
ANALYZE daily_street_status;
ANALYZE street_status_entries;
ANALYZE work_logs;
ANALYZE user_permissions;
ANALYZE customers;
ANALYZE pricing;
ANALYZE invoice_templates;
ANALYZE invoices;
ANALYZE invoice_items;
ANALYZE snapshots;
ANALYZE reports;
