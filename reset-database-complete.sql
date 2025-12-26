/*
  # Reset Completo - Sistema POS Kiosco con Movimientos de Inventario

  1. Tablas Creadas
    - `users` - Usuarios del sistema (administradores y vendedores)
    - `products` - Inventario de productos
    - `sales` - Registro de ventas
    - `cash_transactions` - Movimientos de caja (ingresos/egresos)
    - `shifts` - Turnos de trabajo
    - `configuration` - Configuración del negocio
    - `inventory_movements` - Movimientos de inventario (entradas/salidas)

  2. Seguridad
    - RLS habilitado en todas las tablas
    - Políticas públicas para operaciones básicas (anon y authenticated)

  3. Datos Iniciales
    - Usuarios: admin/admin, vendedor/vendedor, damian/2580
    - Configuración: Mi Kiosco
    - Productos de ejemplo

  INSTRUCCIONES:
  1. Ve a tu dashboard de Supabase: https://scgncykiterarqzuqrau.supabase.co
  2. Click en "SQL Editor" en el menú lateral
  3. Copia y pega TODO este archivo
  4. Click en "Run" o presiona Ctrl+Enter
  5. Espera a que termine de ejecutarse
*/

-- Enable extension
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Drop existing tables to start fresh
DROP TABLE IF EXISTS inventory_movements CASCADE;
DROP TABLE IF EXISTS cash_transactions CASCADE;
DROP TABLE IF EXISTS sales CASCADE;
DROP TABLE IF EXISTS shifts CASCADE;
DROP TABLE IF EXISTS products CASCADE;
DROP TABLE IF EXISTS users CASCADE;
DROP TABLE IF EXISTS configuration CASCADE;

-- ===================================
-- USERS TABLE
-- ===================================
CREATE TABLE users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  username text UNIQUE NOT NULL,
  password text NOT NULL,
  full_name text NOT NULL,
  role text NOT NULL CHECK (role IN ('admin', 'vendedor')),
  active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- ===================================
-- PRODUCTS TABLE
-- ===================================
CREATE TABLE products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text UNIQUE NOT NULL,
  name text NOT NULL,
  description text DEFAULT '',
  category text DEFAULT '',
  price numeric(10,2) NOT NULL DEFAULT 0,
  cost numeric(10,2) NOT NULL DEFAULT 0,
  stock integer NOT NULL DEFAULT 0,
  min_stock integer NOT NULL DEFAULT 0,
  active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- ===================================
-- SALES TABLE
-- ===================================
CREATE TABLE sales (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_number text UNIQUE NOT NULL,
  date timestamptz DEFAULT now(),
  user_id uuid NOT NULL,
  user_name text NOT NULL,
  shift_id uuid NOT NULL,
  items jsonb NOT NULL DEFAULT '[]'::jsonb,
  subtotal numeric(10,2) NOT NULL DEFAULT 0,
  discount numeric(10,2) NOT NULL DEFAULT 0,
  total numeric(10,2) NOT NULL DEFAULT 0,
  payment_method text NOT NULL,
  customer_name text,
  customer_lot text,
  payments jsonb,
  created_at timestamptz DEFAULT now()
);

-- ===================================
-- CASH TRANSACTIONS TABLE
-- ===================================
CREATE TABLE cash_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shift_id uuid NOT NULL,
  type text NOT NULL CHECK (type IN ('income', 'expense')),
  category text NOT NULL,
  amount numeric(10,2) NOT NULL DEFAULT 0,
  payment_method text NOT NULL,
  description text DEFAULT '',
  created_at timestamptz DEFAULT now()
);

-- ===================================
-- SHIFTS TABLE
-- ===================================
CREATE TABLE shifts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  user_name text NOT NULL,
  start_date timestamptz DEFAULT now(),
  end_date timestamptz,
  opening_cash numeric(10,2) NOT NULL DEFAULT 0,
  closing_cash numeric(10,2),
  total_sales numeric(10,2) NOT NULL DEFAULT 0,
  total_expenses numeric(10,2) NOT NULL DEFAULT 0,
  active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- ===================================
-- CONFIGURATION TABLE
-- ===================================
CREATE TABLE configuration (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_name text DEFAULT 'Mi Negocio',
  address text DEFAULT '',
  phone text DEFAULT '',
  tax_id text DEFAULT '',
  currency text DEFAULT '$',
  receipt_message text DEFAULT 'Gracias por su compra',
  updated_at timestamptz DEFAULT now()
);

-- ===================================
-- INVENTORY MOVEMENTS TABLE (NUEVA!)
-- ===================================
CREATE TABLE inventory_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL,
  product_code text NOT NULL,
  product_name text NOT NULL,
  category text DEFAULT '',
  type text NOT NULL CHECK (type IN ('purchase', 'sale', 'adjustment')),
  quantity integer NOT NULL,
  previous_stock integer NOT NULL DEFAULT 0,
  new_stock integer NOT NULL DEFAULT 0,
  supplier text DEFAULT '',
  reference text DEFAULT '',
  user_name text NOT NULL,
  shift_id uuid NOT NULL,
  notes text DEFAULT '',
  created_at timestamptz DEFAULT now()
);

-- ===================================
-- ENABLE ROW LEVEL SECURITY
-- ===================================
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE cash_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE shifts ENABLE ROW LEVEL SECURITY;
ALTER TABLE configuration ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_movements ENABLE ROW LEVEL SECURITY;

-- ===================================
-- RLS POLICIES - USERS
-- ===================================
CREATE POLICY "Anyone can read users"
  ON users FOR SELECT
  TO anon, authenticated
  USING (true);

-- ===================================
-- RLS POLICIES - PRODUCTS
-- ===================================
CREATE POLICY "Anyone can manage products"
  ON products FOR ALL
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

-- ===================================
-- RLS POLICIES - SALES
-- ===================================
CREATE POLICY "Anyone can read sales"
  ON sales FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Anyone can insert sales"
  ON sales FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- ===================================
-- RLS POLICIES - CASH TRANSACTIONS
-- ===================================
CREATE POLICY "Anyone can read cash_transactions"
  ON cash_transactions FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Anyone can insert cash_transactions"
  ON cash_transactions FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- ===================================
-- RLS POLICIES - SHIFTS
-- ===================================
CREATE POLICY "Anyone can read shifts"
  ON shifts FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Anyone can insert shifts"
  ON shifts FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Anyone can update shifts"
  ON shifts FOR UPDATE
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

-- ===================================
-- RLS POLICIES - CONFIGURATION
-- ===================================
CREATE POLICY "Anyone can read configuration"
  ON configuration FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Anyone can update configuration"
  ON configuration FOR UPDATE
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

-- ===================================
-- RLS POLICIES - INVENTORY MOVEMENTS
-- ===================================
CREATE POLICY "Anyone can read inventory_movements"
  ON inventory_movements FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Anyone can insert inventory_movements"
  ON inventory_movements FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- ===================================
-- INDEXES FOR PERFORMANCE
-- ===================================
CREATE INDEX idx_products_code ON products(code);
CREATE INDEX idx_products_category ON products(category);
CREATE INDEX idx_sales_date ON sales(date);
CREATE INDEX idx_sales_shift_id ON sales(shift_id);
CREATE INDEX idx_cash_transactions_shift_id ON cash_transactions(shift_id);
CREATE INDEX idx_shifts_active ON shifts(active);
CREATE INDEX idx_inventory_movements_product_id ON inventory_movements(product_id);
CREATE INDEX idx_inventory_movements_type ON inventory_movements(type);
CREATE INDEX idx_inventory_movements_created_at ON inventory_movements(created_at);
CREATE INDEX idx_inventory_movements_shift_id ON inventory_movements(shift_id);

-- ===================================
-- INSERT INITIAL DATA - USERS
-- ===================================
INSERT INTO users (username, password, full_name, role, active)
VALUES
  ('admin', 'admin', 'Administrador', 'admin', true),
  ('vendedor', 'vendedor', 'Vendedor', 'vendedor', true),
  ('damian', '2580', 'Damian', 'admin', true);

-- ===================================
-- INSERT INITIAL DATA - CONFIGURATION
-- ===================================
INSERT INTO configuration (business_name, currency, receipt_message)
VALUES ('Mi Kiosco', '$', 'Gracias por su compra');

-- ===================================
-- INSERT INITIAL DATA - PRODUCTS
-- ===================================
INSERT INTO products (code, name, description, category, price, cost, stock, min_stock)
VALUES
  ('001', 'Coca Cola 500ml', 'Gaseosa Coca Cola 500ml', 'Bebida', 2.50, 1.50, 50, 10),
  ('002', 'Agua Mineral 500ml', 'Agua mineral sin gas', 'Bebida', 1.50, 0.80, 100, 20),
  ('003', 'Alfajor Havanna', 'Alfajor de dulce de leche', 'Comida', 3.00, 2.00, 30, 10),
  ('004', 'Galletitas Oreo', 'Galletitas Oreo pack 6', 'Comida', 4.50, 3.00, 40, 15),
  ('005', 'Caramelos Sugus', 'Caramelos Sugus bolsa', 'Comida', 2.00, 1.20, 60, 20);

-- ===================================
-- DONE!
-- ===================================
-- Si ves este mensaje sin errores, la base de datos está lista.
-- Ahora puedes cerrar esta ventana y usar la aplicación.
