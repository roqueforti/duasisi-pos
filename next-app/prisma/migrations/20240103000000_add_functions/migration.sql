-- =============================================
-- PostgreSQL functions & triggers for Supabase
-- =============================================

-- Function: auto-update customer stats after each transaction
CREATE OR REPLACE FUNCTION increment_customer_stats(p_no_hp TEXT, p_total NUMERIC)
RETURNS void AS $$
BEGIN
  UPDATE customers
  SET
    total_transaksi = total_transaksi + 1,
    total_belanja   = total_belanja + p_total,
    terakhir_order  = NOW()
  WHERE no_hp = p_no_hp;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: auto-generate no_nota in format LDY-YYMMDD-XXXX
CREATE OR REPLACE FUNCTION generate_no_nota()
RETURNS TEXT AS $$
DECLARE
  today_str TEXT := TO_CHAR(NOW() AT TIME ZONE 'Asia/Jakarta', 'YYMMDD');
  max_num   INTEGER;
  new_nota  TEXT;
BEGIN
  SELECT COALESCE(MAX(
    CAST(SPLIT_PART(no_nota, '-', 3) AS INTEGER)
  ), 0)
  INTO max_num
  FROM transactions
  WHERE no_nota LIKE 'LDY-' || today_str || '-%';

  new_nota := 'LDY-' || today_str || '-' || LPAD(CAST(max_num + 1 AS TEXT), 4, '0');
  RETURN new_nota;
END;
$$ LANGUAGE plpgsql;

-- Trigger: auto-set no_nota if null on insert
CREATE OR REPLACE FUNCTION trg_set_no_nota()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.no_nota IS NULL OR NEW.no_nota = '' THEN
    NEW.no_nota := generate_no_nota();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_no_nota ON transactions;
CREATE TRIGGER set_no_nota
  BEFORE INSERT ON transactions
  FOR EACH ROW EXECUTE FUNCTION trg_set_no_nota();

-- Function: audit log helper
CREATE OR REPLACE FUNCTION add_audit_log(
  p_nama_user TEXT,
  p_jenis TEXT,
  p_referensi TEXT DEFAULT NULL,
  p_detail TEXT DEFAULT NULL
)
RETURNS void AS $$
BEGIN
  INSERT INTO audit_logs (nama_user, jenis_aktivitas, referensi, detail)
  VALUES (p_nama_user, p_jenis, p_referensi, p_detail);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- RLS: enable Row Level Security on sensitive tables
ALTER TABLE transactions      ENABLE ROW LEVEL SECURITY;
ALTER TABLE transaction_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers         ENABLE ROW LEVEL SECURITY;
ALTER TABLE employees         ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory         ENABLE ROW LEVEL SECURITY;
ALTER TABLE machines          ENABLE ROW LEVEL SECURITY;
ALTER TABLE shifts            ENABLE ROW LEVEL SECURITY;
ALTER TABLE absensi           ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs        ENABLE ROW LEVEL SECURITY;

-- RLS policies: allow anon key full access (app uses anon key)
-- In production, tighten this to authenticated role only
DO $$ DECLARE t TEXT; BEGIN
  FOREACH t IN ARRAY ARRAY[
    'transactions','transaction_items','customers','employees',
    'inventory','machines','shifts','absensi','audit_logs',
    'services','promos','master_shifts','pipeline_steps','requirements'
  ] LOOP
    EXECUTE format('DROP POLICY IF EXISTS "allow_all" ON %I', t);
    EXECUTE format('CREATE POLICY "allow_all" ON %I FOR ALL USING (true) WITH CHECK (true)', t);
  END LOOP;
END $$;
