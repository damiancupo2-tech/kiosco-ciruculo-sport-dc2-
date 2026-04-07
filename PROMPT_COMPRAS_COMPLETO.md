# PROMPT COMPLETO: SISTEMA DE GESTIÓN DE COMPRAS PARA APLICACIÓN POS KIOSCO

## CONTEXTO GENERAL
Necesito implementar un sistema completo de gestión de compras en una aplicación POS de Kiosco. El sistema debe integrar:
- Creación y gestión de facturas de compra
- Control de inventario (stock)
- Pagos parciales y totales de facturas
- Movimientos de caja (egresos)
- Seguimiento de turnos
- Eliminación segura de facturas con reversión de cambios

---

## PARTE 1: BASE DE DATOS (SUPABASE)

### 1.1 Crear tabla `purchase_invoices`
Crear tabla para almacenar facturas de compra con campos:
- `id` (uuid, primary key, default: gen_random_uuid())
- `invoice_number` (text, UNIQUE, NOT NULL) - Número único de factura (ej: FC-000001)
- `supplier` (text, NOT NULL) - Nombre del proveedor
- `total` (numeric, NOT NULL, DEFAULT 0) - Monto total de la factura
- `paid_amount` (numeric, NOT NULL, DEFAULT 0) - Monto pagado hasta el momento
- `status` (text, DEFAULT 'pending', CHECK: 'pending'|'partial'|'paid')
- `created_at` (timestamptz, DEFAULT now())

Habilitar RLS y crear políticas públicas de lectura, inserción y actualización.

### 1.2 Crear tabla `purchase_invoice_items`
Crear tabla para los items de cada factura:
- `id` (uuid, primary key, default: gen_random_uuid())
- `invoice_id` (uuid, NOT NULL, REFERENCES purchase_invoices(id) ON DELETE CASCADE)
- `product_id` (uuid, NOT NULL, REFERENCES products(id))
- `quantity` (numeric, NOT NULL) - Cantidad comprada
- `purchase_price` (numeric, NOT NULL) - Precio de compra por unidad
- `sale_price` (numeric, NOT NULL) - Precio de venta por unidad (se puede actualizar)
- `subtotal` (numeric, NOT NULL) - quantity * purchase_price
- `created_at` (timestamptz, DEFAULT now())

Habilitar RLS y crear políticas públicas de lectura e inserción.
Crear índices en: invoice_id, product_id

### 1.3 Crear tabla `purchase_payments`
Crear tabla para registrar pagos de facturas:
- `id` (uuid, primary key, default: gen_random_uuid())
- `invoice_id` (uuid, NOT NULL, REFERENCES purchase_invoices(id) ON DELETE CASCADE)
- `amount` (numeric, NOT NULL) - Monto del pago
- `payment_method` (text, NOT NULL) - Método: 'efectivo', 'transferencia', 'qr', 'expensas'
- `created_at` (timestamptz, DEFAULT now())

Habilitar RLS y crear políticas públicas de lectura e inserción.
Crear índice en: invoice_id

### 1.4 Función PL/pgSQL: `generate_purchase_invoice_number()`
Crear función que:
- Obtiene el último número de factura con patrón FC-XXXXXX
- Incrementa el contador
- Retorna el nuevo número formateado (ej: FC-000001, FC-000002, etc.)
- Si no hay facturas, comienza en FC-000001

### 1.5 Función PL/pgSQL: `update_purchase_invoice_status()`
Crear trigger function que:
- Se dispara AFTER INSERT en purchase_payments
- Suma todos los pagos de la factura
- Actualiza paid_amount en purchase_invoices
- Cambia el status automáticamente:
  - Si paid_amount >= total: status = 'paid'
  - Si paid_amount > 0 y paid_amount < total: status = 'partial'
  - Si paid_amount = 0: status = 'pending'

### 1.6 Trigger automático
Crear trigger `update_invoice_status_on_payment` que ejecute la función anterior al insertar pagos.

### 1.7 Asegurar que tabla `inventory_movements` existe
Si no existe, crear tabla con campos:
- `id`, `product_id`, `product_code`, `product_name`, `category`
- `type` (CHECK: 'sale'|'purchase')
- `quantity`, `previous_stock`, `new_stock`
- `supplier`, `reference`, `user_name`, `shift_id`, `notes`, `created_at`

Esta tabla registra todos los cambios de stock (compras y ventas).

---

## PARTE 2: COMPONENTE REACT (Compras.tsx)

### 2.1 Estructura básica
- Importar: React hooks (useState, useEffect), lucide-react icons, supabase
- Definir interfaces TypeScript:
  - `Product` (id, name, price, cost, stock, supplier)
  - `PurchaseItem` (tempId, product_id, product_name, quantity, purchase_price, sale_price, subtotal)
  - `PurchaseInvoice` (id, invoice_number, supplier, total, paid_amount, status, created_at)
  - `InvoiceDetail` (extends PurchaseInvoice con array de items)

### 2.2 Estado del componente (useState)
- `products`: Array de productos
- `invoices`: Array de facturas de compra
- `selectedInvoice`: Factura actualmente seleccionada (para ver detalles)
- `showPaymentModal`: Modal para registrar pagos
- `paymentAmount`, `paymentMethod`: Datos del pago
- `showDeleteModal`: Modal para confirmar eliminación
- `deletePassword`: Contraseña para eliminar (hardcoded: '842114')
- `invoiceToDelete`: ID de factura a eliminar
- `purchaseItems`: Items del carrito de compra (antes de guardar)
- `currentItem`: Item actual en edición (product_id, product_name, quantity, purchase_price, sale_price)
- `supplier`: Nombre del proveedor actual
- `showNewProductModal`: Modal para agregar producto nuevo
- `newProductName`: Nombre del producto nuevo
- `currentUser`: Usuario logueado (de localStorage)
- `activeShift`: Turno activo actual

### 2.3 Efectos (useEffect)
- Al montar: cargar productos, facturas, usuario actual, turno activo

### 2.4 Funciones de carga
**loadProducts()**: 
- Query a tabla products, ordenar por nombre

**loadCurrentUser()**: 
- Obtener usuario de localStorage y parsear JSON

**loadActiveShift()**: 
- Query a tabla shifts donde active = true
- Usar maybeSingle() para obtener uno o null

**loadInvoices()**: 
- Query a tabla purchase_invoices, ordenar por created_at descendente

**loadInvoiceDetail(invoiceId)**:
- Query a purchase_invoices con relación JOINs a purchase_invoice_items
- Seleccionar también products(name) de cada item
- Guardar en selectedInvoice

### 2.5 Funciones de gestión de items
**handleProductChange(value)**:
- Si value === 'new': abrir modal para nuevo producto
- Si hay value: buscar producto en array y llenar campos:
  - currentItem.sale_price = product.price
  - currentItem.purchase_price = product.cost
  - currentItem.product_name = product.name

**handleAddNewProduct()**:
- Validar que newProductName no esté vacío
- Generar código: 'PROD-' + últimos 8 dígitos de timestamp
- INSERT en products con:
  - code, name, price (del sale_price actual), cost (del purchase_price actual)
  - stock = 0 (inicia en cero), category = '', supplier (del estado)
- Recargar productos
- Cerrar modal y limpiar estados

**addItemToPurchase()**:
- Validar que todos los campos estén completos
- Calcular subtotal = quantity * purchase_price
- Crear objeto PurchaseItem con tempId único (timestamp)
- Agregar al array purchaseItems
- Limpiar currentItem

**removeItem(tempId)**:
- Filtrar y remover item del array

**getTotalPurchase()**:
- Sumar todos los subtotales de purchaseItems

### 2.6 Función principal: savePurchaseInvoice()
Este es el core del sistema. Pasos:

1. **Validaciones**:
   - purchaseItems no esté vacío
   - supplier no esté vacío

2. **Generar número de factura**:
   - Llamar a RPC function generate_purchase_invoice_number()
   - Si falla, usar fallback: 'FC-' + timestamp

3. **Crear factura**:
   - INSERT en purchase_invoices con:
     - invoice_number (generado)
     - supplier
     - total (getTotalPurchase())
     - paid_amount = 0
     - status = 'pending'

4. **Crear items de factura**:
   - INSERT multiple en purchase_invoice_items
   - Para cada purchaseItem, insertar con invoice_id de factura creada

5. **Actualizar stock de productos** (LOOP para cada item):
   - SELECT producto actual (para obtener stock anterior)
   - UPDATE products set:
     - stock = old_stock + quantity
     - cost = purchase_price (actualizar costo)
     - price = sale_price (actualizar precio venta)
     - supplier = supplier
   - Esto es crucial: los precios se actualizan al comprar

6. **Registrar movimiento de inventario** (LOOP para cada item):
   - INSERT en inventory_movements con:
     - product_id, product_code, product_name, category
     - type = 'purchase'
     - quantity (cantidad comprada)
     - previous_stock, new_stock (ambos valores)
     - supplier, reference = invoice_number
     - user_name (del currentUser)
     - shift_id (del activeShift)
     - notes = 'Compra {invoiceNumber}'

7. **Limpiar UI**:
   - Limpiar purchaseItems y supplier
   - Recargar productos e invoices
   - Mostrar mensaje de éxito

**NOTAS CRÍTICAS**:
- El registro en inventory_movements es FUNDAMENTAL para el sistema de reportes
- La actualización de precio y costo permite que al vender se use el último costo
- El supplier debe quedar registrado en products para histórico

### 2.7 Función: handlePayInvoice()
Registrar pago de una factura. Pasos:

1. **Validaciones**:
   - Hay invoice seleccionada
   - Hay turno activo
   - paymentAmount es válido y > 0
   - paymentAmount <= saldo pendiente

2. **Registrar pago**:
   - INSERT en purchase_payments con:
     - invoice_id, amount, payment_method

3. **Registrar en caja** (CREATE cash_transaction):
   - type = 'expense' (es un egreso)
   - category = 'Compras'
   - amount
   - payment_method
   - shift_id (del activeShift)
   - description = 'Pago factura {invoice_number} - {supplier}'

4. **Actualizar turno**:
   - UPDATE shifts: total_expenses += amount
   - Recargar activeShift para tener datos actualizados

5. **El trigger automático** (en DB) actualizar status de factura

6. **Limpiar y recargar**:
   - Limpiar paymentAmount y paymentMethod
   - Recargar invoices y detalles de factura seleccionada
   - Mostrar éxito

**NOTAS**:
- IMPORTANTE: El pago es un EGRESO en caja (type = 'expense')
- Esto afecta directamente el balance de caja del turno
- La descripción en cash_transactions debe ser clara para auditoría

### 2.8 Función: handleDeleteInvoice()
Eliminar factura (con protección):

1. **Validar contraseña**: '842114'

2. **Verificación de integridad**:
   - Si paid_amount > 0: NO permite eliminar
   - Justificación: debe deshacer pagos primero

3. **Revertir cambios de stock** (LOOP):
   - SELECT purchase_invoice_items de factura
   - Para cada item:
     - SELECT productos actuales
     - UPDATE stock = stock - quantity (revertir el aumento)

4. **Eliminar registros de auditoría**:
   - DELETE de inventory_movements donde reference = invoice_number
   - Esto revierte el registro en movimientos

5. **Eliminar datos de transacciones**:
   - DELETE purchase_invoice_items
   - DELETE purchase_invoices

6. **Limpiar UI**:
   - Limpiar selectedInvoice
   - Recargar invoices y products

**NOTAS CRÍTICAS**:
- La reversión debe ser TOTAL y CONSISTENTE
- Protegida con contraseña para evitar borrados accidentales
- Impide borrar si hay pagos (para proteger auditoría financiera)

---

## PARTE 3: INTERFAZ DE USUARIO

### 3.1 Área de Nueva Compra (left side - grid col 1)
- **Título**: "Nueva Compra" con icono Package
- **Input Proveedor**: Campo de texto para nombre del proveedor
- **Grid de 2 columnas**:
  - Select productos (con opción "+ Agregar Nuevo Producto")
  - Input Cantidad (number, step=0.01)
  - Input Precio Compra (number, step=0.01)
  - Input Precio Venta (number, step=0.01)
- **Botón**: "Agregar Item" (azul)
- **Sección Items de Compra** (si hay items):
  - Lista de items con formato: Nombre | Cantidad x Precio = Subtotal | botón eliminar
  - Total de compra en recuadro azul
  - Botón "Guardar Factura de Compra" (verde/emerald)

### 3.2 Área de Facturas (right side - grid col 2)
- **Título**: "Facturas de Compra" con icono FileText
- **Lista scrolleable** (max-h-600):
  - Cada factura como tarjeta clickeable:
    - Número de factura y proveedor
    - Badge de status (Pagada/Parcial/Pendiente) con colores
    - Fecha
    - Monto total
    - Si hay pagado: mostrar "Pagado: $X | Pendiente: $Y"

### 3.3 Modal Detalle de Factura (al hacer click)
- **Header**: Número factura, proveedor, fecha
- **Botón cerrar X**
- **Items**:
  - Tabla con: Producto | Cantidad | Precio Compra | Precio Venta | Subtotal
- **Resumen financiero**:
  - Total: $X
  - Pagado: $X (verde)
  - Pendiente: $X (rojo)
- **Botones**:
  - "Registrar Pago" (si status != 'paid') - verde
  - "Eliminar Factura" - rojo

### 3.4 Modal Registrar Pago
- **Título**: "Registrar Pago"
- **Info**: Mostrar saldo pendiente
- **Input Monto a Pagar**: number, step=0.01
- **Select Método de Pago**: efectivo, transferencia, qr, expensas
- **Botones**: Cancelar | Confirmar Pago

### 3.5 Modal Nuevo Producto
- **Título**: "Agregar Nuevo Producto"
- **Mensaje**: "El producto no existe. ¿Desea agregarlo?"
- **Input**: Nombre del producto
- **Botones**: Cancelar | Agregar

### 3.6 Modal Eliminar Factura
- **Título rojo**: "Eliminar Factura"
- **Advertencia**: "Esta acción eliminará la factura y revertirá cambios en inventario. No se puede deshacer."
- **Input Password**: Con placeholder "Ingrese la contraseña"
- **Botones**: Cancelar | Eliminar (rojo)

---

## PARTE 4: INTEGRACIÓN CON OTRAS PARTES DEL SISTEMA

### 4.1 Impacto en Stock (Products)
- Al crear factura: stock += cantidad
- Al eliminar factura: stock -= cantidad (reversión)
- Al cambiar precios: se actualizan cost y price

### 4.2 Impacto en Caja (Cash Transactions)
- Cada pago de factura genera un EGRESO en cash_transactions
- Category: 'Compras'
- Description: 'Pago factura {number} - {supplier}'
- Visible en módulo Caja como egreso
- Afecta el cierre de turno

### 4.3 Impacto en Turnos (Shifts)
- Cada pago incrementa total_expenses del turno
- Esto afecta el balance final del turno
- Es crítico para cierre de caja

### 4.4 Movimientos de Inventario
- Cada compra registra un movimiento tipo 'purchase'
- Reference = invoice_number (para auditoría)
- Visible en módulo Movimientos
- Permite rastrear todas las compras

### 4.5 Reportes
- Las facturas deben sumarse en reportes de gastos
- El inventory_movements muestra histórico de stock
- Los cash_transactions muestran flujo de caja

---

## PARTE 5: DETALLES TÉCNICOS IMPORTANTES

### 5.1 Timestamps y Zona Horaria
- Todas las fechas usan timestamptz
- Formato de visualización: toLocaleDateString('es-AR')

### 5.2 Validaciones
- No permitir crear factura sin items
- No permitir crear factura sin proveedor
- No permitir pagar más del saldo pendiente
- No permitir eliminar factura con pagos

### 5.3 Contraseña de Eliminación
- Hardcoded: '842114'
- Solo usa esta contraseña, no validar contra BD

### 5.4 IDs temporales
- Los items antes de guardar usan tempId = timestamp
- Esto permite identificarlos mientras están en memoria

### 5.5 Relaciones en DB
- Las políticas RLS deben permitir lectura/escritura pública
- Los triggers automáticos deben actualizar status
- Los ON DELETE CASCADE protegen integridad referencial

---

## PARTE 6: FLUJO COMPLETO DE EJEMPLO

### Crear una compra:
1. Usuario selecciona proveedor "Distribuidor XYZ"
2. Agrega Coca Cola 2.50 (compra) x 5 unidades = 12.50
3. Agrega Agua 1.00 (compra) x 10 unidades = 10.00
4. Total = 22.50
5. Click "Guardar Factura"
   - Se genera FC-000001
   - Se crean 2 items
   - Stock de Coca Cola: +5
   - Stock de Agua: +10
   - Se registran 2 movimientos inventory_movements

### Pagar factura:
1. Usuario hace click en FC-000001
2. Ve detalles y hace click "Registrar Pago"
3. Ingresa $22.50 y selecciona "efectivo"
4. Click confirmar
   - Se registra pago en purchase_payments
   - Se crea egreso en cash_transactions
   - Status automáticamente cambia a 'paid'
   - total_expenses del turno se incrementa

### Eliminar factura:
1. Usuario ve FC-000001 y hace click "Eliminar"
2. Ingresa contraseña '842114'
3. Click eliminar
   - Stock vuelve a valores anteriores
   - Se eliminan movimientos de inventory
   - Factura desaparece

---

## ARCHIVO: src/components/Compras.tsx

Basarse en el componente proporcionado. Las funcionalidades clave:
- No agregar comentarios
- Usar tailwindcss para estilos
- Usar lucide-react para iconos
- Mantener estructura de grid 2 columnas
- Todos los modales deben ser fixed inset-0 con overlay

---

## VERIFICACIÓN FINAL

Después de implementar, verificar:
- [ ] Las tablas están creadas en Supabase
- [ ] Las funciones y triggers están activos
- [ ] El componente Compras se importa en App.tsx
- [ ] Se puede crear factura y ve incremento en stock
- [ ] Se puede registrar pago y aparece en Caja
- [ ] Se puede eliminar factura sin pagos
- [ ] Inventory_movements se registran correctamente
- [ ] El sistema es simétrico: crear = +stock, eliminar = -stock

---

## CONSIDERACIONES DE DATOS

- El sistema maneja dinero: validar todas las operaciones
- Los timestamps son críticos para auditoría
- Las reversiones deben ser idempotentes (se puede ejecutar múltiples veces sin problemas)
- Los movimientos de inventario son el registro de auditoría principal
