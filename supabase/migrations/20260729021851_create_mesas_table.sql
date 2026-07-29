/*
# Create mesas table (open table orders)

1. New Tables
- `mesas`
  - `id` (uuid, primary key)
  - `table_number` (text, not null) - Número de mesa ingresado al abrirla
  - `status` (text, default 'open', CHECK: 'open'|'closed') - Estado del ticket de la mesa
  - `items` (jsonb, default '[]') - Carrito de productos cargados a la mesa (mismo formato que SaleItem)
  - `customer_name` (text) - Nombre del cliente (opcional)
  - `customer_lot` (text) - Lote del cliente (opcional)
  - `shift_id` (uuid, not null) - Turno activo al que pertenece la mesa
  - `user_id` (uuid, not null) - Usuario que abrió la mesa
  - `user_name` (text, not null) - Nombre del usuario
  - `created_at` (timestamptz)
  - `updated_at` (timestamptz)

2. Security
- Enable RLS on `mesas`.
- Políticas públicas (anon + authenticated) para CRUD, consistente con el resto del sistema (app single-tenant sin sign-in de Supabase).

3. Notas
- Los tickets abiertos persisten en la base de datos para que se mantengan al navegar entre hojas del sistema.
- Al cobrar una mesa se genera una venta en `sales` (igual que Ventas), se descuenta stock, se registran movimientos de caja y se cierra/elimina la mesa.
*/

CREATE TABLE IF NOT EXISTS mesas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  table_number text NOT NULL,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed')),
  items jsonb NOT NULL DEFAULT '[]'::jsonb,
  customer_name text DEFAULT '',
  customer_lot text DEFAULT '',
  shift_id uuid NOT NULL,
  user_id uuid NOT NULL,
  user_name text NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE mesas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read mesas" ON mesas;
CREATE POLICY "Anyone can read mesas"
  ON mesas FOR SELECT
  TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS "Anyone can insert mesas" ON mesas;
CREATE POLICY "Anyone can insert mesas"
  ON mesas FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "Anyone can update mesas" ON mesas;
CREATE POLICY "Anyone can update mesas"
  ON mesas FOR UPDATE
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "Anyone can delete mesas" ON mesas;
CREATE POLICY "Anyone can delete mesas"
  ON mesas FOR DELETE
  TO anon, authenticated
  USING (true);

CREATE INDEX IF NOT EXISTS idx_mesas_status ON mesas(status);
CREATE INDEX IF NOT EXISTS idx_mesas_shift_id ON mesas(shift_id);
CREATE INDEX IF NOT EXISTS idx_mesas_table_number ON mesas(table_number);
