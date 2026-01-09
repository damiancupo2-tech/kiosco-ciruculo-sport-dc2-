/*
  # Create Purchase Invoice Tables

  1. New Tables
    - `purchase_invoices`
      - `id` (uuid, primary key)
      - `invoice_number` (text, unique, auto-generated)
      - `supplier` (text)
      - `total` (numeric)
      - `paid_amount` (numeric, default 0)
      - `status` (text, default 'pending') - 'pending', 'partial', 'paid'
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

    - `purchase_invoice_items`
      - `id` (uuid, primary key)
      - `invoice_id` (uuid, foreign key)
      - `product_id` (uuid, foreign key)
      - `quantity` (numeric)
      - `purchase_price` (numeric)
      - `sale_price` (numeric)
      - `subtotal` (numeric)
      - `created_at` (timestamptz)

    - `purchase_payments`
      - `id` (uuid, primary key)
      - `invoice_id` (uuid, foreign key)
      - `amount` (numeric)
      - `payment_method` (text)
      - `created_at` (timestamptz)

  2. Changes to existing tables
    - Add `supplier` column to `products` table if it doesn't exist

  3. Security
    - Enable RLS on all new tables
    - Add policies for authenticated users
*/

-- Add supplier column to products if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'products' AND column_name = 'supplier'
  ) THEN
    ALTER TABLE products ADD COLUMN supplier text DEFAULT '';
  END IF;
END $$;

-- Create purchase_invoices table
CREATE TABLE IF NOT EXISTS purchase_invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_number text UNIQUE NOT NULL,
  supplier text NOT NULL,
  total numeric NOT NULL DEFAULT 0,
  paid_amount numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create purchase_invoice_items table
CREATE TABLE IF NOT EXISTS purchase_invoice_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id uuid NOT NULL REFERENCES purchase_invoices(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  quantity numeric NOT NULL,
  purchase_price numeric NOT NULL,
  sale_price numeric NOT NULL,
  subtotal numeric NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Create purchase_payments table
CREATE TABLE IF NOT EXISTS purchase_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id uuid NOT NULL REFERENCES purchase_invoices(id) ON DELETE CASCADE,
  amount numeric NOT NULL,
  payment_method text NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE purchase_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_invoice_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_payments ENABLE ROW LEVEL SECURITY;

-- Policies for purchase_invoices
DROP POLICY IF EXISTS "Users can view purchase invoices" ON purchase_invoices;
CREATE POLICY "Users can view purchase invoices"
  ON purchase_invoices FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Users can insert purchase invoices" ON purchase_invoices;
CREATE POLICY "Users can insert purchase invoices"
  ON purchase_invoices FOR INSERT
  TO authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "Users can update purchase invoices" ON purchase_invoices;
CREATE POLICY "Users can update purchase invoices"
  ON purchase_invoices FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "Users can delete purchase invoices" ON purchase_invoices;
CREATE POLICY "Users can delete purchase invoices"
  ON purchase_invoices FOR DELETE
  TO authenticated
  USING (true);

-- Policies for purchase_invoice_items
DROP POLICY IF EXISTS "Users can view purchase invoice items" ON purchase_invoice_items;
CREATE POLICY "Users can view purchase invoice items"
  ON purchase_invoice_items FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Users can insert purchase invoice items" ON purchase_invoice_items;
CREATE POLICY "Users can insert purchase invoice items"
  ON purchase_invoice_items FOR INSERT
  TO authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "Users can update purchase invoice items" ON purchase_invoice_items;
CREATE POLICY "Users can update purchase invoice items"
  ON purchase_invoice_items FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "Users can delete purchase invoice items" ON purchase_invoice_items;
CREATE POLICY "Users can delete purchase invoice items"
  ON purchase_invoice_items FOR DELETE
  TO authenticated
  USING (true);

-- Policies for purchase_payments
DROP POLICY IF EXISTS "Users can view purchase payments" ON purchase_payments;
CREATE POLICY "Users can view purchase payments"
  ON purchase_payments FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Users can insert purchase payments" ON purchase_payments;
CREATE POLICY "Users can insert purchase payments"
  ON purchase_payments FOR INSERT
  TO authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "Users can update purchase payments" ON purchase_payments;
CREATE POLICY "Users can update purchase payments"
  ON purchase_payments FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "Users can delete purchase payments" ON purchase_payments;
CREATE POLICY "Users can delete purchase payments"
  ON purchase_payments FOR DELETE
  TO authenticated
  USING (true);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_purchase_invoice_items_invoice_id ON purchase_invoice_items(invoice_id);
CREATE INDEX IF NOT EXISTS idx_purchase_invoice_items_product_id ON purchase_invoice_items(product_id);
CREATE INDEX IF NOT EXISTS idx_purchase_payments_invoice_id ON purchase_payments(invoice_id);
CREATE INDEX IF NOT EXISTS idx_purchase_invoices_created_at ON purchase_invoices(created_at DESC);

-- Function to generate invoice numbers
CREATE OR REPLACE FUNCTION generate_purchase_invoice_number()
RETURNS text AS $$
DECLARE
  next_number integer;
  invoice_num text;
BEGIN
  SELECT COALESCE(MAX(CAST(SUBSTRING(invoice_number FROM 4) AS integer)), 0) + 1
  INTO next_number
  FROM purchase_invoices
  WHERE invoice_number ~ '^FC-[0-9]+$';

  invoice_num := 'FC-' || LPAD(next_number::text, 6, '0');
  RETURN invoice_num;
END;
$$ LANGUAGE plpgsql;

-- Function to update invoice status and total
CREATE OR REPLACE FUNCTION update_purchase_invoice_status()
RETURNS trigger AS $$
BEGIN
  UPDATE purchase_invoices
  SET
    paid_amount = (
      SELECT COALESCE(SUM(amount), 0)
      FROM purchase_payments
      WHERE invoice_id = NEW.invoice_id
    ),
    status = CASE
      WHEN (SELECT COALESCE(SUM(amount), 0) FROM purchase_payments WHERE invoice_id = NEW.invoice_id) >= total THEN 'paid'
      WHEN (SELECT COALESCE(SUM(amount), 0) FROM purchase_payments WHERE invoice_id = NEW.invoice_id) > 0 THEN 'partial'
      ELSE 'pending'
    END,
    updated_at = now()
  WHERE id = NEW.invoice_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update invoice status when payment is added
DROP TRIGGER IF EXISTS trigger_update_invoice_status ON purchase_payments;
CREATE TRIGGER trigger_update_invoice_status
AFTER INSERT ON purchase_payments
FOR EACH ROW
EXECUTE FUNCTION update_purchase_invoice_status();
