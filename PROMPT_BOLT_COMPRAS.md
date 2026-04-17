# PROMPT PARA BOLT: SISTEMA DE GESTIÓN DE COMPRAS POS KIOSCO

## INSTRUCCIÓN GENERAL
Implementa un módulo completo de gestión de compras (Compras.tsx) idéntico al del repositorio adjunto. El sistema debe conectar facturas de compra con inventario, caja y reportes automáticamente.

---

## BASE DE DATOS - EJECUTAR ESTAS MIGRACIONES EN SUPABASE

### Migración 1: Tablas de Compras
```sql
CREATE TABLE IF NOT EXISTS purchase_invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_number text UNIQUE NOT NULL,
  supplier text NOT NULL,
  total numeric DEFAULT 0 NOT NULL,
  paid_amount numeric DEFAULT 0 NOT NULL,
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'partial', 'paid')),
  created_at timestamptz DEFAULT now()
);

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

CREATE TABLE IF NOT EXISTS purchase_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id uuid NOT NULL REFERENCES purchase_invoices(id) ON DELETE CASCADE,
  amount numeric NOT NULL,
  payment_method text NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE purchase_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_invoice_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read purchase_invoices" ON purchase_invoices FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Anyone can insert purchase_invoices" ON purchase_invoices FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "Anyone can update purchase_invoices" ON purchase_invoices FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Anyone can read purchase_invoice_items" ON purchase_invoice_items FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Anyone can insert purchase_invoice_items" ON purchase_invoice_items FOR INSERT TO anon, authenticated WITH CHECK (true);

CREATE POLICY "Anyone can read purchase_payments" ON purchase_payments FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Anyone can insert purchase_payments" ON purchase_payments FOR INSERT TO anon, authenticated WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_purchase_invoices_created_at ON purchase_invoices(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_purchase_invoices_status ON purchase_invoices(status);
CREATE INDEX IF NOT EXISTS idx_purchase_invoice_items_invoice_id ON purchase_invoice_items(invoice_id);
CREATE INDEX IF NOT EXISTS idx_purchase_invoice_items_product_id ON purchase_invoice_items(product_id);
CREATE INDEX IF NOT EXISTS idx_purchase_payments_invoice_id ON purchase_payments(invoice_id);
```

### Migración 2: Funciones y Triggers
```sql
CREATE OR REPLACE FUNCTION generate_purchase_invoice_number()
RETURNS text AS $$
DECLARE
  last_number integer;
  new_number text;
BEGIN
  SELECT COALESCE(MAX(CAST(SUBSTRING(invoice_number FROM 4) AS integer)), 0) INTO last_number
  FROM purchase_invoices
  WHERE invoice_number ~ '^FC-[0-9]+$';
  
  new_number := 'FC-' || LPAD((last_number + 1)::text, 6, '0');
  RETURN new_number;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION update_purchase_invoice_status()
RETURNS TRIGGER AS $$
DECLARE
  total_paid numeric;
  invoice_total numeric;
BEGIN
  SELECT COALESCE(SUM(amount), 0) INTO total_paid FROM purchase_payments WHERE invoice_id = NEW.invoice_id;
  SELECT total INTO invoice_total FROM purchase_invoices WHERE id = NEW.invoice_id;
  
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

DROP TRIGGER IF EXISTS update_invoice_status_on_payment ON purchase_payments;
CREATE TRIGGER update_invoice_status_on_payment
  AFTER INSERT ON purchase_payments
  FOR EACH ROW
  EXECUTE FUNCTION update_purchase_invoice_status();
```

---

## COMPONENTE: src/components/Compras.tsx

Crear archivo con la siguiente estructura:

### Interfaces TypeScript
```typescript
interface Product {
  id: string;
  name: string;
  price: number;
  cost: number;
  stock: number;
  supplier?: string;
}

interface PurchaseItem {
  tempId: string;
  product_id: string;
  product_name: string;
  quantity: number;
  purchase_price: number;
  sale_price: number;
  subtotal: number;
}

interface PurchaseInvoice {
  id: string;
  invoice_number: string;
  supplier: string;
  total: number;
  paid_amount: number;
  status: string;
  created_at: string;
}

interface InvoiceDetail extends PurchaseInvoice {
  items: Array<{
    id: string;
    product_id: string;
    quantity: number;
    purchase_price: number;
    sale_price: number;
    subtotal: number;
    products: { name: string };
  }>;
}
```

### Estados (useState)
- `products: Product[]`
- `invoices: PurchaseInvoice[]`
- `selectedInvoice: InvoiceDetail | null`
- `showPaymentModal: boolean`
- `paymentAmount: string`
- `paymentMethod: string` (default: 'efectivo')
- `showDeleteModal: boolean`
- `deletePassword: string`
- `invoiceToDelete: string | null`
- `purchaseItems: PurchaseItem[]`
- `currentItem: { product_id, product_name, quantity, purchase_price, sale_price }`
- `supplier: string`
- `showNewProductModal: boolean`
- `newProductName: string`
- `currentUser: any` (obtenido de localStorage.user)
- `activeShift: any` (del turno activo)

### Funciones a Implementar

#### loadProducts()
```
- SELECT * FROM products ORDER BY name
```

#### loadCurrentUser()
```
- Obtener de localStorage el key 'user'
- Parsear y guardar en state
```

#### loadActiveShift()
```
- SELECT * FROM shifts WHERE active = true
- Usar maybeSingle()
```

#### loadInvoices()
```
- SELECT * FROM purchase_invoices ORDER BY created_at DESC
```

#### loadInvoiceDetail(invoiceId: string)
```
- SELECT * FROM purchase_invoices 
  - WITH purchase_invoice_items (id, product_id, quantity, purchase_price, sale_price, subtotal, products(name))
  - WHERE id = invoiceId
- Guardar en selectedInvoice
```

#### handleProductChange(value: string)
```
- Si value === 'new': setShowNewProductModal(true)
- Si value !== 'new':
  - Buscar producto en array products
  - Llenar currentItem con datos del producto
  - sale_price = product.price
  - purchase_price = product.cost
```

#### handleAddNewProduct()
```
- Validar newProductName no vacío
- Generar código: 'PROD-' + Date.now().toString().slice(-8)
- INSERT en products:
  - code, name, price, cost, stock=0, category='', supplier
- loadProducts()
- Cerrar modal y limpiar
```

#### addItemToPurchase()
```
- Validar todos los campos completos
- Calcular subtotal = quantity * purchase_price
- Crear PurchaseItem con tempId = Date.now().toString()
- Agregar a purchaseItems
- Limpiar currentItem
```

#### removeItem(tempId: string)
```
- Filtrar purchaseItems para remover por tempId
```

#### getTotalPurchase()
```
- Retornar sum(item.subtotal para todos los items)
```

#### savePurchaseInvoice() - FUNCIÓN CRÍTICA
```
PASO 1: Validaciones
- Si purchaseItems vacío: alert('Agregue al menos un producto')
- Si supplier vacío: alert('Ingrese el proveedor')

PASO 2: Generar número de factura
- invoiceNumber = await supabase.rpc('generate_purchase_invoice_number')
- Si falla: invoiceNumber = 'FC-' + Date.now()

PASO 3: Crear factura
- INSERT purchase_invoices:
  {
    invoice_number: invoiceNumber,
    supplier: supplier,
    total: getTotalPurchase(),
    paid_amount: 0,
    status: 'pending'
  }

PASO 4: Crear items
- INSERT multiple purchase_invoice_items:
  Para cada purchaseItem:
  {
    invoice_id: invoice.id,
    product_id, quantity, purchase_price, sale_price, subtotal
  }

PASO 5: LOOP - Actualizar stock y crear movimientos
Para cada purchaseItem:
  a) SELECT product WHERE id = item.product_id
  b) previousStock = product.stock
  c) newStock = previousStock + item.quantity
  
  d) UPDATE products:
     - stock = newStock
     - cost = item.purchase_price
     - price = item.sale_price
     - supplier = supplier
  
  e) INSERT inventory_movements:
     {
       product_id, product_code, product_name, category,
       type: 'purchase',
       quantity: item.quantity,
       previous_stock: previousStock,
       new_stock: newStock,
       supplier,
       reference: invoiceNumber,
       user_name: currentUser?.full_name || 'Sistema',
       shift_id: activeShift?.id || null,
       notes: `Compra ${invoiceNumber}`
     }

PASO 6: Limpiar
- setPurchaseItems([])
- setSupplier('')
- loadProducts()
- loadInvoices()
- alert('Factura {invoiceNumber} creada exitosamente')
```

#### handlePayInvoice() - PAGO DE FACTURA
```
PASO 1: Validaciones
- Hay selectedInvoice
- Hay activeShift
- paymentAmount > 0 y es número válido
- paymentAmount <= (selectedInvoice.total - selectedInvoice.paid_amount)

PASO 2: Registrar pago en compras
- INSERT purchase_payments:
  {
    invoice_id: selectedInvoice.id,
    amount: parseFloat(paymentAmount),
    payment_method: paymentMethod
  }
- El trigger automático actualiza paid_amount y status

PASO 3: Registrar egreso en caja
- INSERT cash_transactions:
  {
    shift_id: activeShift.id,
    type: 'expense',
    category: 'Compras',
    amount: parseFloat(paymentAmount),
    payment_method: paymentMethod,
    description: `Pago factura ${selectedInvoice.invoice_number} - ${selectedInvoice.supplier}`
  }

PASO 4: Actualizar turno
- newExpenses = (activeShift.total_expenses || 0) + amount
- UPDATE shifts WHERE id = activeShift.id:
  { total_expenses: newExpenses }

PASO 5: Recargar
- loadActiveShift()
- loadInvoices()
- loadInvoiceDetail(selectedInvoice.id)
- Limpiar modal: setShowPaymentModal(false), setPaymentAmount(''), setPaymentMethod('efectivo')
- alert('Pago registrado exitosamente en caja')
```

#### handleDeleteInvoice() - ELIMINAR FACTURA CON REVERSIÓN
```
PASO 1: Validar contraseña
- Si deletePassword !== '842114': alert('Contraseña incorrecta') y return
- Si invoiceToDelete vacío: return

PASO 2: Obtener datos de factura
- invoiceToDelete es el ID
- Buscar en array invoices para obtener los datos

PASO 3: Verificación - NO permitir si hay pagos
- Si invoice.paid_amount > 0:
  - alert('No se puede eliminar una factura con pagos registrados')
  - Limpiar modal y return

PASO 4: LOOP - Revertir stock
- SELECT purchase_invoice_items WHERE invoice_id = invoiceToDelete
- Para cada item:
  - SELECT product WHERE id = item.product_id
  - UPDATE products SET stock = product.stock - item.quantity

PASO 5: Eliminar movimientos de auditoría
- DELETE inventory_movements WHERE reference = invoice.invoice_number

PASO 6: Eliminar datos
- DELETE purchase_invoice_items WHERE invoice_id = invoiceToDelete
- DELETE purchase_invoices WHERE id = invoiceToDelete

PASO 7: Limpiar y recargar
- setSelectedInvoice(null)
- setShowDeleteModal(false)
- setDeletePassword('')
- setInvoiceToDelete(null)
- loadProducts()
- loadInvoices()
- alert('Factura eliminada exitosamente')
```

### useEffect
```
useEffect(() => {
  loadProducts();
  loadInvoices();
  loadCurrentUser();
  loadActiveShift();
}, []);
```

---

## INTERFAZ DE USUARIO - TAILWINDCSS

### Layout Principal
- Grid 2 columnas (lg:grid-cols-2)
- Cada columna: bg-white rounded-xl shadow-lg p-6

### PANEL IZQUIERDO: Nueva Compra
```
Heading: "Nueva Compra" + Package icon

Input Proveedor
  - placeholder: "Nombre del proveedor"

Grid 2 columnas (gap-3):
  Col 1:
    - Select Producto (con opción "new")
    - Input Cantidad (number, step=0.01)
  
  Col 2:
    - Input Precio Compra (number, step=0.01)
    - Input Precio Venta (number, step=0.01)

Button "Agregar Item" (blue-500)

CONDICIONAL - Si purchaseItems.length > 0:
  - Heading "Items de la Compra"
  - Lista items:
    - bg-slate-50 p-3 rounded-lg
    - Flex: [producto info] [cantidad x precio = subtotal] [botón X rojo]
  
  - Total box (bg-blue-50):
    - Bold: "Total Compra: $XX.XX"
  
  - Button "Guardar Factura de Compra" (green-500, bold)
```

### PANEL DERECHO: Facturas
```
Heading: "Facturas de Compra" + FileText icon

Div max-h-600 overflow-y-auto:
  Para cada invoice:
    - border border-slate-200 rounded-lg p-4 hover:shadow-md cursor-pointer
    - Flex justify-between:
      - [Número factura bold, Proveedor text-sm]
      - [Badge con status]
    - Flex justify-between text-sm:
      - Fecha
      - Monto total bold
    - Si paid_amount > 0:
      - text-xs: "Pagado: $X | Pendiente: $Y"
```

---

## MODALES

### Modal Nuevo Producto (fixed inset-0 overlay)
```
Heading: "Agregar Nuevo Producto"
Texto: "El producto no existe en el sistema. ¿Desea agregarlo?"

Input Nombre Producto
  - autoFocus

Flex gap-3:
  - Button "Cancelar" (slate-200)
  - Button "Agregar" (blue-500)
```

### Modal Detalles Factura (fixed inset-0 overlay, max-w-2xl)
```
Header:
  - Número factura bold (xl)
  - Proveedor
  - Fecha formateada
  - Button X cerrar (top right)

Section "Items":
  Para cada item:
    - bg-slate-50 p-3 rounded-lg
    - Producto bold
    - Text: "Cantidad: X | Precio Compra: $X | Precio Venta: $X"
    - Subtotal bold right

Border-top pt-4:
  - Flex justify-between: "Total:" "$XX.XX" (xl bold)
  - Flex justify-between: "Pagado:" "$XX.XX" (lg bold, emerald-600)
  - Flex justify-between: "Pendiente:" "$XX.XX" (lg bold, red-600)

Buttons space-y-2:
  - Si status !== 'paid':
    - "Registrar Pago" (emerald-500, DollarSign icon)
  - "Eliminar Factura" (red-500, Trash2 icon)
```

### Modal Registrar Pago
```
Heading: "Registrar Pago"
Text: "Saldo pendiente: ${saldo}"

Input Monto a Pagar
  - type number, step=0.01
  - autoFocus

Select Método de Pago:
  - efectivo
  - transferencia
  - qr
  - expensas

Flex gap-3:
  - "Cancelar" (slate-200)
  - "Confirmar Pago" (emerald-500)
```

### Modal Eliminar Factura
```
Heading rojo: "Eliminar Factura" + Trash2 icon
Text rojo: "Esta acción eliminará la factura y revertirá los cambios en el inventario. Esta acción no se puede deshacer."

Input Password
  - type password
  - placeholder: "Ingrese la contraseña"
  - autoFocus

Flex gap-3:
  - "Cancelar" (slate-200)
  - "Eliminar" (red-500)
```

---

## INTEGRACIONES CRÍTICAS

### Con tabla products:
- stock aumenta al crear factura
- cost y price se actualizan al crear factura
- supplier se registra

### Con tabla cash_transactions:
- Cada pago crea un EGRESO (type='expense')
- category='Compras'
- Afecta balance del turno

### Con tabla shifts:
- total_expenses aumenta con cada pago
- Crítico para cierre de turno

### Con tabla inventory_movements:
- Cada compra registra movimiento type='purchase'
- Reference es el número de factura
- Permite auditoría completa

---

## ELEMENTOS CLAVE A RECORDAR

1. **Todos los iconos** vienen de lucide-react
2. **Sin comentarios** en el código
3. **Validaciones** en cada paso crítico
4. **Los modales** son fixed con overlay
5. **Tailwindcss** para todos los estilos
6. **maybeSingle()** cuando se espera 0 o 1 resultado
7. **Contraseña de eliminación**: '842114' (hardcoded, no de BD)
8. **tempId**: usa Date.now().toString() para items antes de guardar
9. **Fechas**: formatea con toLocaleDateString('es-AR')
10. **La reversión** debe ser simétrica: crear = +stock, eliminar = -stock

---

## CHECKLIST FINAL

- [ ] Tablas creadas en Supabase (purchase_invoices, purchase_invoice_items, purchase_payments)
- [ ] Funciones RPC funcionando (generate_purchase_invoice_number)
- [ ] Triggers activos (update_purchase_invoice_status)
- [ ] Componente Compras.tsx importado en App.tsx
- [ ] Al crear factura: stock aumenta
- [ ] Al pagar: aparece en cash_transactions como egreso
- [ ] Al eliminar sin pagos: stock vuelve a valor anterior
- [ ] inventory_movements registra cada movimiento
- [ ] Status de factura se actualiza automáticamente con pagos
- [ ] El sistema está sincronizado: Compras → Stock → Caja → Reportes
