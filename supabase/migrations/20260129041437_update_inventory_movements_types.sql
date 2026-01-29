/*
  # Actualizar tipos de movimientos de inventario

  1. Modificaciones
    - Actualizar CHECK constraint en `inventory_movements.type` para incluir más tipos:
      - 'sale' (venta)
      - 'purchase' (compra)
      - 'entrada' (entrada/ingreso)
      - 'salida' (salida/egreso)
      - 'adjustment' (ajuste)
*/

-- Eliminar constraint existente
ALTER TABLE inventory_movements DROP CONSTRAINT IF EXISTS inventory_movements_type_check;

-- Agregar nuevo constraint con más opciones
ALTER TABLE inventory_movements
  ADD CONSTRAINT inventory_movements_type_check
  CHECK (type IN ('sale', 'purchase', 'entrada', 'salida', 'adjustment'));
