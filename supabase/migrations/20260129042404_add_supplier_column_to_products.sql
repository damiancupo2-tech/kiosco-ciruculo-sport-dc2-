/*
  # Agregar columna supplier a products

  1. Modificaciones
    - Agregar columna `supplier` (text) a la tabla products
    - Permite almacenar el nombre del proveedor del producto
*/

-- Agregar columna supplier si no existe
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'products' AND column_name = 'supplier'
  ) THEN
    ALTER TABLE products ADD COLUMN supplier text;
  END IF;
END $$;
