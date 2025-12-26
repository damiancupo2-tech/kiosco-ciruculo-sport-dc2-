-- Script SQL para crear la tabla de movimientos de inventario
-- Ejecuta este script en el SQL Editor de Supabase

-- 1. Crear la tabla
CREATE TABLE IF NOT EXISTS inventory_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL,
  product_code text NOT NULL,
  product_name text NOT NULL,
  category text DEFAULT '',
  type text NOT NULL CHECK (type IN ('sale', 'purchase')),
  quantity integer NOT NULL,
  previous_stock integer NOT NULL DEFAULT 0,
  new_stock integer NOT NULL DEFAULT 0,
  supplier text DEFAULT '',
  reference text DEFAULT '',
  user_name text NOT NULL,
  shift_id uuid,
  notes text DEFAULT '',
  created_at timestamptz DEFAULT now()
);

-- 2. Habilitar Row Level Security
ALTER TABLE inventory_movements ENABLE ROW LEVEL SECURITY;

-- 3. Crear políticas de seguridad
CREATE POLICY "Anyone can read inventory_movements"
  ON inventory_movements FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Anyone can insert inventory_movements"
  ON inventory_movements FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- 4. Crear índices para mejorar el rendimiento
CREATE INDEX IF NOT EXISTS idx_inventory_movements_product_id ON inventory_movements(product_id);
CREATE INDEX IF NOT EXISTS idx_inventory_movements_type ON inventory_movements(type);
CREATE INDEX IF NOT EXISTS idx_inventory_movements_created_at ON inventory_movements(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_inventory_movements_category ON inventory_movements(category);
CREATE INDEX IF NOT EXISTS idx_inventory_movements_supplier ON inventory_movements(supplier);
CREATE INDEX IF NOT EXISTS idx_inventory_movements_product_code ON inventory_movements(product_code);
