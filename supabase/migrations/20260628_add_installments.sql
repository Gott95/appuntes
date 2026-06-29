CREATE TABLE installment_plans (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  store TEXT NOT NULL DEFAULT '',
  category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
  total_amount NUMERIC(12,2) NOT NULL,
  down_payment NUMERIC(12,2) NOT NULL DEFAULT 0,
  financed_amount NUMERIC(12,2) NOT NULL,
  installment_count INT NOT NULL,
  installment_amount NUMERIC(12,2) NOT NULL,
  payment_frequency TEXT NOT NULL DEFAULT 'monthly',
  interest_type TEXT NOT NULL DEFAULT 'zero',
  tna NUMERIC(8,4),
  tea NUMERIC(8,4),
  tem NUMERIC(8,6),
  cft NUMERIC(8,4),
  amortization_system TEXT NOT NULL DEFAULT 'french',
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  notes TEXT DEFAULT '',
  is_shared BOOLEAN DEFAULT FALSE,
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE installment_plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ip_insert" ON installment_plans FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "ip_select" ON installment_plans FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "ip_update" ON installment_plans FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "ip_delete" ON installment_plans FOR DELETE USING (auth.uid() = user_id);

CREATE TABLE installment_payments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  plan_id UUID NOT NULL REFERENCES installment_plans(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  installment_number INT NOT NULL,
  due_date DATE NOT NULL,
  amount NUMERIC(12,2) NOT NULL,
  capital_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  interest_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  iva_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending',
  paid_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  paid_date DATE,
  payment_method TEXT DEFAULT 'cash',
  notes TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE installment_payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ipay_insert" ON installment_payments FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "ipay_select" ON installment_payments FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "ipay_update" ON installment_payments FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "ipay_delete" ON installment_payments FOR DELETE USING (auth.uid() = user_id);

CREATE INDEX idx_installment_plans_user ON installment_plans(user_id);
CREATE INDEX idx_installment_plans_status ON installment_plans(user_id, status);
CREATE INDEX idx_installment_payments_plan ON installment_payments(plan_id);
CREATE INDEX idx_installment_payments_status ON installment_payments(user_id, status);
CREATE INDEX idx_installment_payments_due ON installment_payments(due_date);
