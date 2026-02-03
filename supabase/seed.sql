-- Seed data for local testing
-- This file populates the database with test data

-- ============================================
-- TEST USERS (created via auth.users first)
-- In local Supabase, you can create users via Dashboard or API
-- These are example records assuming users exist in auth.users
-- ============================================

-- For local testing with Supabase CLI, users are created via:
-- supabase auth signup --email admin@test.local --password Test123!

-- Dummy UUIDs for testing (replace with actual auth.users IDs)
DO $$
DECLARE
  admin_id UUID := '11111111-1111-1111-1111-111111111111';
  mitarbeiter_id UUID := '22222222-2222-2222-2222-222222222222';
  gast_id UUID := '33333333-3333-3333-3333-333333333333';
  
  city1_id UUID;
  city2_id UUID;
  area1_id UUID;
  area2_id UUID;
  area3_id UUID;
  street1_id UUID;
  street2_id UUID;
  street3_id UUID;
  customer1_id UUID;
  template1_id UUID;
BEGIN
  -- Skip if tables don't exist (for safety)
  IF NOT EXISTS (SELECT FROM pg_tables WHERE tablename = 'cities') THEN
    RETURN;
  END IF;

  -- ============================================
  -- CITIES
  -- ============================================
  INSERT INTO cities (id, name) VALUES
    (gen_random_uuid(), 'Teststadt'),
    (gen_random_uuid(), 'Winterhausen')
  ON CONFLICT (name) DO NOTHING
  RETURNING id INTO city1_id;

  SELECT id INTO city1_id FROM cities WHERE name = 'Teststadt';
  SELECT id INTO city2_id FROM cities WHERE name = 'Winterhausen';

  -- ============================================
  -- AREAS
  -- ============================================
  INSERT INTO areas (id, name, city_id, color) VALUES
    (gen_random_uuid(), 'Innenstadt', city1_id, '#ef4444'),
    (gen_random_uuid(), 'Gewerbegebiet', city1_id, '#3b82f6'),
    (gen_random_uuid(), 'Wohngebiet Nord', city2_id, '#22c55e')
  ON CONFLICT (name, city_id) DO NOTHING;

  SELECT id INTO area1_id FROM areas WHERE name = 'Innenstadt';
  SELECT id INTO area2_id FROM areas WHERE name = 'Gewerbegebiet';
  SELECT id INTO area3_id FROM areas WHERE name = 'Wohngebiet Nord';

  -- ============================================
  -- STREETS
  -- ============================================
  INSERT INTO streets (id, name, area_id, priority, length_meters) VALUES
    (gen_random_uuid(), 'Hauptstraße', area1_id, 1, 500),
    (gen_random_uuid(), 'Marktplatz', area1_id, 1, 200),
    (gen_random_uuid(), 'Bahnhofstraße', area1_id, 2, 350),
    (gen_random_uuid(), 'Industrieweg', area2_id, 3, 800),
    (gen_random_uuid(), 'Logistikring', area2_id, 2, 1200),
    (gen_random_uuid(), 'Ahornweg', area3_id, 4, 300),
    (gen_random_uuid(), 'Birkenallee', area3_id, 3, 450)
  ON CONFLICT (name, area_id) DO NOTHING;

  SELECT id INTO street1_id FROM streets WHERE name = 'Hauptstraße';
  SELECT id INTO street2_id FROM streets WHERE name = 'Industrieweg';
  SELECT id INTO street3_id FROM streets WHERE name = 'Ahornweg';

  -- ============================================
  -- CUSTOMERS (for billing tests)
  -- ============================================
  INSERT INTO customers (id, name, company, email, address, postal_code, city, phone, is_active) VALUES
    (gen_random_uuid(), 'Max Mustermann', 'Mustermann GmbH', 'max@mustermann.de', 'Musterweg 1', '12345', 'Teststadt', '+49 123 456789', true),
    (gen_random_uuid(), 'Erika Beispiel', 'Beispiel AG', 'erika@beispiel.de', 'Beispielstraße 42', '54321', 'Winterhausen', '+49 987 654321', true)
  ON CONFLICT DO NOTHING;

  SELECT id INTO customer1_id FROM customers WHERE name = 'Max Mustermann';

  -- ============================================
  -- INVOICE TEMPLATES
  -- ============================================
  INSERT INTO invoice_templates (id, name, is_default, company_name, company_address, company_postal_code, company_city, company_email, company_phone, company_bank_name, company_bank_iban, payment_terms) VALUES
    (gen_random_uuid(), 'Standard Vorlage', true, 'Winterdienst GmbH', 'Winterstraße 1', '10115', 'Berlin', 'info@winterdienst.de', '+49 30 12345678', 'Sparkasse Berlin', 'DE89 3704 0044 0532 0130 00', 'Zahlbar innerhalb von 14 Tagen netto.')
  ON CONFLICT DO NOTHING;

  SELECT id INTO template1_id FROM invoice_templates WHERE name = 'Standard Vorlage';

  -- ============================================
  -- PRICING
  -- ============================================
  INSERT INTO pricing (name, description, unit, price_per_unit, tax_rate, is_active, valid_from) VALUES
    ('Standardstunde', 'Normale Arbeitsstunde', 'hour', 45.00, 19.00, true, CURRENT_DATE),
    ('Pro Meter Räumung', 'Schneeräumung pro Meter', 'meter', 0.50, 19.00, true, CURRENT_DATE),
    ('Pauschal Straße', 'Pauschale pro Straße', 'per_street', 35.00, 19.00, true, CURRENT_DATE)
  ON CONFLICT DO NOTHING;

  -- ============================================
  -- SAMPLE DAILY STATUS
  -- ============================================
  INSERT INTO daily_street_status (street_id, date, status, started_at) VALUES
    (street1_id, CURRENT_DATE, 'done', NOW() - INTERVAL '2 hours'),
    (street2_id, CURRENT_DATE, 'in_progress', NOW() - INTERVAL '30 minutes'),
    (street3_id, CURRENT_DATE, 'open', NULL)
  ON CONFLICT (street_id, date) DO NOTHING;

  RAISE NOTICE 'Seed data inserted successfully';
END $$;
