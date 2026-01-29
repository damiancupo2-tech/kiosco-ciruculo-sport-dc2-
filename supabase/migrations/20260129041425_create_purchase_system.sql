/*
  # Sistema completo de gestión de compras

  1. Nuevas Tablas
    - `purchase_invoices` - Facturas de compra
      - `id` (uuid, primary key)
      - `invoice_number` (text, número de factura único)
      - `supplier` (text, nombre del proveedor)
      - `total` (numeric, total de la factura)
      - `paid_amount` (numeric, monto pagado)
      - `status` (text, estado: pending/partial/paid)
      - `created_at` (timestamptz)
      
    - `purchase_invoice_items` - Items de las facturas
      - `id` (uuid, primary key)
      - `invoice_id` (uuid, referencia a purchase_invoices)
      - `product_id` (uuid, referencia a products)
      - `quantity` (numeric, cantidad)
      - `purchase_price` (numeric, precio de compra)
      - `sale_price` (numeric, precio de venta)
      - `subtotal` (numeric, subtotal del item)
      - `created_at` (timestamptz)
      
    - `purchase_payments` - Pagos de facturas
      - `id` (uuid, primary key)
      - `invoice_id` (uuid, referencia a purchase_invoices)
      - `amount` (numeric, monto del pago)
      - `payment_method` (text, método de pago)
      - `created_at` (timestamptz)

  2. Funciones
    - `generate_purchase_invoice_number()` - Genera números de factura consecutivos
    - `update_invoice_status()` - Actualiza el estado de la factura según pagos

  3. Triggers
    - Actualizar estado de factura automáticamente al registrar pagos
    - Actualizar paid_amount al registrar pagos

  4. Seguridad
    - RLS habilitado en todas las tablas
    - Políticas de acceso público (anon y authenticated)
*/

-- Crear tabla de facturas de compra
CREATE TABLE IF NOT EXISTS purchase_invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_number text UNIQUE NOT NULL,
  supplier text NOT NULL,
  total numeric DEFAULT 0 NOT NULL,
  paid_amount numeric DEFAULT 0 NOT NULL,
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'partial', 'paid')),
  created_at timestamptz DEFAULT now()
);

-- Crear tabla de items de facturas
CREATE TABLE IF NOT EXISTS purchase_invoice_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id uuid NOT NULL REFERENCES purchase_invoices(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES products(id),
  quantity numeric NOT NULL,
  purchase_price numeric NOT NULL,
  sale_price numeric NOT NULL,
  subtotal numeric NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Crear tabla de pagos
CREATE TABLE IF NOT EXISTS purchase_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id uuid NOT NULL REFERENCES purchase_invoices(id) ON DELETE CASCADE,
  amount numeric NOT NULL,
  payment_method text NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE purchase_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_invoice_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_payments ENABLE ROW LEVEL SECURITY;

-- Políticas para purchase_invoices
CREATE POLICY "Anyone can read purchase_invoices"
  ON purchase_invoices FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Anyone can insert purchase_invoices"
  ON purchase_invoices FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Anyone can update purchase_invoices"
  ON purchase_invoices FOR UPDATE
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

-- Políticas para purchase_invoice_items
CREATE POLICY "Anyone can read purchase_invoice_items"
  ON purchase_invoice_items FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Anyone can insert purchase_invoice_items"
  ON purchase_invoice_items FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- Políticas para purchase_payments
CREATE POLICY "Anyone can read purchase_payments"
  ON purchase_payments FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Anyone can insert purchase_payments"
  ON purchase_payments FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- Función para generar números de factura
CREATE OR REPLACE FUNCTION generate_purchase_invoice_number()
RETURNS text AS $$
DECLARE
  last_number integer;
  new_number text;
BEGIN
  SELECT COALESCE(
    MAX(CAST(SUBSTRING(invoice_number FROM 4) AS integer)),
    0
  ) INTO last_number
  FROM purchase_invoices
  WHERE invoice_number ~ '^FC-[0-9]+$';
  
  new_number := 'FC-' || LPAD((last_number + 1)::text, 6, '0');
  RETURN new_number;
END;
$$ LANGUAGE plpgsql;

-- Función para actualizar el estado de la factura
CREATE OR REPLACE FUNCTION update_purchase_invoice_status()
RETURNS TRIGGER AS $$
DECLARE
  total_paid numeric;
  invoice_total numeric;
BEGIN
  SELECT COALESCE(SUM(amount), 0) INTO total_paid
  FROM purchase_payments
  WHERE invoice_id = NEW.invoice_id;
  
  SELECT total INTO invoice_total
  FROM purchase_invoices
  WHERE id = NEW.invoice_id;
  
  UPDATE purchase_invoices
  SET 
    paid_amount = total_paid,
    status = CASE
      WHEN total_paid >= invoice_total THEN 'paid'
      WHEN total_paid > 0 THEN 'partial'
      ELSE 'pending'
    END
  WHERE id = NEW.invoice_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para actualizar estado al registrar pago
DROP TRIGGER IF EXISTS update_invoice_status_on_payment ON purchase_payments;
CREATE TRIGGER update_invoice_status_on_payment
  AFTER INSERT ON purchase_payments
  FOR EACH ROW
  EXECUTE FUNCTION update_purchase_invoice_status();

-- Índices para mejorar rendimiento
CREATE INDEX IF NOT EXISTS idx_purchase_invoices_created_at ON purchase_invoices(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_purchase_invoices_status ON purchase_invoices(status);
CREATE INDEX IF NOT EXISTS idx_purchase_invoice_items_invoice_id ON purchase_invoice_items(invoice_id);
CREATE INDEX IF NOT EXISTS idx_purchase_invoice_items_product_id ON purchase_invoice_items(product_id);
CREATE INDEX IF NOT EXISTS idx_purchase_payments_invoice_id ON purchase_payments(invoice_id);
