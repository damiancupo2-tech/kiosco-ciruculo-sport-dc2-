import React, { useState, useEffect } from 'react';
import { ShoppingCart, Plus, X, Save, DollarSign, Package, FileText, Eye } from 'lucide-react';
import { supabase } from '../lib/supabase';

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
    products: {
      name: string;
    };
  }>;
}

export default function Compras() {
  const [products, setProducts] = useState<Product[]>([]);
  const [invoices, setInvoices] = useState<PurchaseInvoice[]>([]);
  const [selectedInvoice, setSelectedInvoice] = useState<InvoiceDetail | null>(null);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('efectivo');

  const [purchaseItems, setPurchaseItems] = useState<PurchaseItem[]>([]);
  const [currentItem, setCurrentItem] = useState({
    product_id: '',
    product_name: '',
    quantity: '',
    purchase_price: '',
    sale_price: '',
  });
  const [supplier, setSupplier] = useState('');
  const [showNewProductModal, setShowNewProductModal] = useState(false);
  const [newProductName, setNewProductName] = useState('');

  useEffect(() => {
    loadProducts();
    loadInvoices();
  }, []);

  const loadProducts = async () => {
    const { data } = await supabase
      .from('products')
      .select('*')
      .order('name');
    if (data) setProducts(data);
  };

  const loadInvoices = async () => {
    const { data } = await supabase
      .from('purchase_invoices')
      .select('*')
      .order('created_at', { ascending: false });
    if (data) setInvoices(data);
  };

  const loadInvoiceDetail = async (invoiceId: string) => {
    const { data } = await supabase
      .from('purchase_invoices')
      .select(`
        *,
        items:purchase_invoice_items(
          id,
          product_id,
          quantity,
          purchase_price,
          sale_price,
          subtotal,
          products(name)
        )
      `)
      .eq('id', invoiceId)
      .single();

    if (data) {
      setSelectedInvoice(data as InvoiceDetail);
    }
  };

  const handleProductChange = (value: string) => {
    if (value === 'new') {
      setShowNewProductModal(true);
      return;
    }

    const product = products.find(p => p.id === value);
    if (product) {
      setCurrentItem({
        ...currentItem,
        product_id: product.id,
        product_name: product.name,
        sale_price: product.price.toString(),
        purchase_price: product.cost?.toString() || '',
      });
    }
  };

  const handleAddNewProduct = async () => {
    if (!newProductName.trim()) return;

    const { data, error } = await supabase
      .from('products')
      .insert({
        name: newProductName,
        price: parseFloat(currentItem.sale_price) || 0,
        cost: parseFloat(currentItem.purchase_price) || 0,
        stock: 0,
        supplier: supplier,
      })
      .select()
      .single();

    if (data && !error) {
      await loadProducts();
      setCurrentItem({
        ...currentItem,
        product_id: data.id,
        product_name: data.name,
      });
      setShowNewProductModal(false);
      setNewProductName('');
    }
  };

  const addItemToPurchase = () => {
    if (!currentItem.product_id || !currentItem.quantity || !currentItem.purchase_price || !currentItem.sale_price) {
      alert('Por favor complete todos los campos');
      return;
    }

    const quantity = parseFloat(currentItem.quantity);
    const purchasePrice = parseFloat(currentItem.purchase_price);
    const salePrice = parseFloat(currentItem.sale_price);
    const subtotal = quantity * purchasePrice;

    const newItem: PurchaseItem = {
      tempId: Date.now().toString(),
      product_id: currentItem.product_id,
      product_name: currentItem.product_name,
      quantity,
      purchase_price: purchasePrice,
      sale_price: salePrice,
      subtotal,
    };

    setPurchaseItems([...purchaseItems, newItem]);
    setCurrentItem({
      product_id: '',
      product_name: '',
      quantity: '',
      purchase_price: '',
      sale_price: '',
    });
  };

  const removeItem = (tempId: string) => {
    setPurchaseItems(purchaseItems.filter(item => item.tempId !== tempId));
  };

  const getTotalPurchase = () => {
    return purchaseItems.reduce((sum, item) => sum + item.subtotal, 0);
  };

  const savePurchaseInvoice = async () => {
    if (purchaseItems.length === 0) {
      alert('Agregue al menos un producto a la compra');
      return;
    }

    if (!supplier.trim()) {
      alert('Ingrese el proveedor');
      return;
    }

    const { data: invoiceNumberData } = await supabase.rpc('generate_purchase_invoice_number');
    const invoiceNumber = invoiceNumberData || `FC-${Date.now()}`;

    const { data: invoice, error: invoiceError } = await supabase
      .from('purchase_invoices')
      .insert({
        invoice_number: invoiceNumber,
        supplier: supplier,
        total: getTotalPurchase(),
        paid_amount: 0,
        status: 'pending',
      })
      .select()
      .single();

    if (invoiceError || !invoice) {
      alert('Error al crear la factura de compra');
      return;
    }

    const itemsToInsert = purchaseItems.map(item => ({
      invoice_id: invoice.id,
      product_id: item.product_id,
      quantity: item.quantity,
      purchase_price: item.purchase_price,
      sale_price: item.sale_price,
      subtotal: item.subtotal,
    }));

    const { error: itemsError } = await supabase
      .from('purchase_invoice_items')
      .insert(itemsToInsert);

    if (itemsError) {
      alert('Error al guardar los items de la compra');
      return;
    }

    for (const item of purchaseItems) {
      const product = products.find(p => p.id === item.product_id);
      if (product) {
        await supabase
          .from('products')
          .update({
            stock: product.stock + item.quantity,
            cost: item.purchase_price,
            price: item.sale_price,
            supplier: supplier,
          })
          .eq('id', item.product_id);

        await supabase
          .from('inventory_movements')
          .insert({
            product_id: item.product_id,
            type: 'entrada',
            quantity: item.quantity,
            reason: `Compra ${invoiceNumber}`,
          });
      }
    }

    alert(`Factura ${invoiceNumber} creada exitosamente`);
    setPurchaseItems([]);
    setSupplier('');
    await loadProducts();
    await loadInvoices();
  };

  const handlePayInvoice = async () => {
    if (!selectedInvoice) return;

    const amount = parseFloat(paymentAmount);
    if (isNaN(amount) || amount <= 0) {
      alert('Ingrese un monto válido');
      return;
    }

    const remaining = selectedInvoice.total - selectedInvoice.paid_amount;
    if (amount > remaining) {
      alert(`El monto no puede ser mayor al saldo pendiente ($${remaining.toFixed(2)})`);
      return;
    }

    const { error: paymentError } = await supabase
      .from('purchase_payments')
      .insert({
        invoice_id: selectedInvoice.id,
        amount: amount,
        payment_method: paymentMethod,
      });

    if (paymentError) {
      alert('Error al registrar el pago');
      return;
    }

    await supabase
      .from('cash_transactions')
      .insert({
        type: 'egreso',
        amount: amount,
        payment_method: paymentMethod,
        description: `Pago compra ${selectedInvoice.invoice_number}`,
      });

    alert('Pago registrado exitosamente');
    setShowPaymentModal(false);
    setPaymentAmount('');
    setPaymentMethod('efectivo');
    await loadInvoices();
    if (selectedInvoice) {
      await loadInvoiceDetail(selectedInvoice.id);
    }
  };

  return (
    <div className="p-6">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-slate-800 mb-2 flex items-center gap-2">
          <ShoppingCart className="w-7 h-7" />
          Compras
        </h2>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl shadow-lg p-6">
          <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
            <Package className="w-5 h-5" />
            Nueva Compra
          </h3>

          <div className="mb-4">
            <label className="block text-sm font-semibold text-slate-700 mb-2">
              Proveedor
            </label>
            <input
              type="text"
              value={supplier}
              onChange={(e) => setSupplier(e.target.value)}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Nombre del proveedor"
            />
          </div>

          <div className="space-y-3 mb-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Producto
                </label>
                <select
                  value={currentItem.product_id}
                  onChange={(e) => handleProductChange(e.target.value)}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Seleccionar...</option>
                  {products.map(product => (
                    <option key={product.id} value={product.id}>
                      {product.name}
                    </option>
                  ))}
                  <option value="new">+ Agregar Nuevo Producto</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Cantidad
                </label>
                <input
                  type="number"
                  value={currentItem.quantity}
                  onChange={(e) => setCurrentItem({ ...currentItem, quantity: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="0"
                  step="0.01"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Precio Compra
                </label>
                <input
                  type="number"
                  value={currentItem.purchase_price}
                  onChange={(e) => setCurrentItem({ ...currentItem, purchase_price: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="0.00"
                  step="0.01"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Precio Venta
                </label>
                <input
                  type="number"
                  value={currentItem.sale_price}
                  onChange={(e) => setCurrentItem({ ...currentItem, sale_price: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="0.00"
                  step="0.01"
                />
              </div>
            </div>

            <button
              onClick={addItemToPurchase}
              className="w-full bg-blue-500 hover:bg-blue-600 text-white py-2 rounded-lg font-semibold flex items-center justify-center gap-2 transition-colors"
            >
              <Plus className="w-5 h-5" />
              Agregar Item
            </button>
          </div>

          {purchaseItems.length > 0 && (
            <div className="border-t pt-4">
              <h4 className="font-semibold text-slate-800 mb-3">Items de la Compra</h4>
              <div className="space-y-2 mb-4">
                {purchaseItems.map(item => (
                  <div key={item.tempId} className="flex justify-between items-center bg-slate-50 p-3 rounded-lg">
                    <div className="flex-1">
                      <p className="font-semibold text-slate-800">{item.product_name}</p>
                      <p className="text-sm text-slate-600">
                        {item.quantity} x ${item.purchase_price.toFixed(2)} = ${item.subtotal.toFixed(2)}
                      </p>
                    </div>
                    <button
                      onClick={() => removeItem(item.tempId)}
                      className="text-red-500 hover:text-red-700"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                ))}
              </div>

              <div className="bg-blue-50 p-4 rounded-lg mb-4">
                <div className="flex justify-between items-center">
                  <span className="font-bold text-slate-800">Total Compra:</span>
                  <span className="text-2xl font-bold text-blue-600">
                    ${getTotalPurchase().toFixed(2)}
                  </span>
                </div>
              </div>

              <button
                onClick={savePurchaseInvoice}
                className="w-full bg-emerald-500 hover:bg-emerald-600 text-white py-3 rounded-lg font-bold flex items-center justify-center gap-2 transition-colors"
              >
                <Save className="w-5 h-5" />
                Guardar Factura de Compra
              </button>
            </div>
          )}
        </div>

        <div className="bg-white rounded-xl shadow-lg p-6">
          <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
            <FileText className="w-5 h-5" />
            Facturas de Compra
          </h3>

          <div className="space-y-2 max-h-[600px] overflow-y-auto">
            {invoices.map(invoice => (
              <div
                key={invoice.id}
                className="border border-slate-200 rounded-lg p-4 hover:shadow-md transition-shadow cursor-pointer"
                onClick={() => loadInvoiceDetail(invoice.id)}
              >
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <p className="font-bold text-slate-800">{invoice.invoice_number}</p>
                    <p className="text-sm text-slate-600">{invoice.supplier}</p>
                  </div>
                  <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                    invoice.status === 'paid' ? 'bg-emerald-100 text-emerald-700' :
                    invoice.status === 'partial' ? 'bg-amber-100 text-amber-700' :
                    'bg-red-100 text-red-700'
                  }`}>
                    {invoice.status === 'paid' ? 'Pagada' : invoice.status === 'partial' ? 'Parcial' : 'Pendiente'}
                  </span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-slate-600">
                    {new Date(invoice.created_at).toLocaleDateString('es-AR')}
                  </span>
                  <span className="font-bold text-slate-800">
                    ${invoice.total.toFixed(2)}
                  </span>
                </div>
                {invoice.paid_amount > 0 && (
                  <div className="mt-2 text-xs text-slate-600">
                    Pagado: ${invoice.paid_amount.toFixed(2)} | Pendiente: ${(invoice.total - invoice.paid_amount).toFixed(2)}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {showNewProductModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-96">
            <h3 className="text-lg font-bold text-slate-800 mb-4">
              Agregar Nuevo Producto
            </h3>
            <p className="text-sm text-slate-600 mb-4">
              El producto no existe en el sistema. ¿Desea agregarlo?
            </p>
            <div className="mb-4">
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                Nombre del Producto
              </label>
              <input
                type="text"
                value={newProductName}
                onChange={(e) => setNewProductName(e.target.value)}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                placeholder="Nombre del producto"
                autoFocus
              />
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowNewProductModal(false);
                  setNewProductName('');
                }}
                className="flex-1 bg-slate-200 hover:bg-slate-300 text-slate-800 py-2 rounded-lg font-semibold"
              >
                Cancelar
              </button>
              <button
                onClick={handleAddNewProduct}
                className="flex-1 bg-blue-500 hover:bg-blue-600 text-white py-2 rounded-lg font-semibold"
              >
                Agregar
              </button>
            </div>
          </div>
        </div>
      )}

      {selectedInvoice && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h3 className="text-xl font-bold text-slate-800">
                  {selectedInvoice.invoice_number}
                </h3>
                <p className="text-slate-600">{selectedInvoice.supplier}</p>
                <p className="text-sm text-slate-500">
                  {new Date(selectedInvoice.created_at).toLocaleDateString('es-AR', {
                    day: '2-digit',
                    month: '2-digit',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                  })}
                </p>
              </div>
              <button
                onClick={() => setSelectedInvoice(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="mb-4">
              <h4 className="font-semibold text-slate-800 mb-3">Items</h4>
              <div className="space-y-2">
                {selectedInvoice.items?.map(item => (
                  <div key={item.id} className="bg-slate-50 p-3 rounded-lg">
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <p className="font-semibold text-slate-800">{item.products.name}</p>
                        <p className="text-sm text-slate-600">
                          Cantidad: {item.quantity} | Precio Compra: ${item.purchase_price.toFixed(2)} | Precio Venta: ${item.sale_price.toFixed(2)}
                        </p>
                      </div>
                      <p className="font-bold text-slate-800">
                        ${item.subtotal.toFixed(2)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="border-t pt-4 mb-4">
              <div className="flex justify-between items-center mb-2">
                <span className="font-semibold text-slate-700">Total:</span>
                <span className="text-xl font-bold text-slate-800">
                  ${selectedInvoice.total.toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between items-center mb-2">
                <span className="font-semibold text-slate-700">Pagado:</span>
                <span className="text-lg font-bold text-emerald-600">
                  ${selectedInvoice.paid_amount.toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="font-semibold text-slate-700">Pendiente:</span>
                <span className="text-lg font-bold text-red-600">
                  ${(selectedInvoice.total - selectedInvoice.paid_amount).toFixed(2)}
                </span>
              </div>
            </div>

            {selectedInvoice.status !== 'paid' && (
              <button
                onClick={() => setShowPaymentModal(true)}
                className="w-full bg-emerald-500 hover:bg-emerald-600 text-white py-3 rounded-lg font-bold flex items-center justify-center gap-2"
              >
                <DollarSign className="w-5 h-5" />
                Registrar Pago
              </button>
            )}
          </div>
        </div>
      )}

      {showPaymentModal && selectedInvoice && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-96">
            <h3 className="text-lg font-bold text-slate-800 mb-4">
              Registrar Pago
            </h3>
            <p className="text-sm text-slate-600 mb-4">
              Saldo pendiente: ${(selectedInvoice.total - selectedInvoice.paid_amount).toFixed(2)}
            </p>

            <div className="mb-4">
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                Monto a Pagar
              </label>
              <input
                type="number"
                value={paymentAmount}
                onChange={(e) => setPaymentAmount(e.target.value)}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                placeholder="0.00"
                step="0.01"
                autoFocus
              />
            </div>

            <div className="mb-4">
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                Método de Pago
              </label>
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="efectivo">Efectivo</option>
                <option value="transferencia">Transferencia</option>
                <option value="qr">QR</option>
                <option value="expensas">Expensas</option>
              </select>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowPaymentModal(false);
                  setPaymentAmount('');
                  setPaymentMethod('efectivo');
                }}
                className="flex-1 bg-slate-200 hover:bg-slate-300 text-slate-800 py-2 rounded-lg font-semibold"
              >
                Cancelar
              </button>
              <button
                onClick={handlePayInvoice}
                className="flex-1 bg-emerald-500 hover:bg-emerald-600 text-white py-2 rounded-lg font-semibold"
              >
                Confirmar Pago
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
