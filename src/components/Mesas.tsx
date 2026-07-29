import { useState, useEffect } from 'react';
import { supabase, Product, SaleItem, Shift } from '../lib/supabase';
import {
  Search,
  Minus,
  Plus,
  Trash2,
  ShoppingCart,
  CreditCard,
  PlusCircle,
  Utensils,
  ChevronDown,
  X,
} from 'lucide-react';

interface Mesa {
  id: string;
  table_number: string;
  status: string;
  items: SaleItem[];
  customer_name: string;
  customer_lot: string;
  shift_id: string;
  user_id: string;
  user_name: string;
  created_at: string;
}

interface MesasProps {
  shift: Shift | null;
}

export default function Mesas({ shift }: MesasProps) {
  const [products, setProducts] = useState<Product[]>([]);
  const [mesas, setMesas] = useState<Mesa[]>([]);
  const [activeMesaId, setActiveMesaId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('todas');
  const [showNewMesaModal, setShowNewMesaModal] = useState(false);
  const [newMesaNumber, setNewMesaNumber] = useState('');
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [cashAmount, setCashAmount] = useState(0);
  const [transferAmount, setTransferAmount] = useState(0);
  const [qrAmount, setQrAmount] = useState(0);
  const [expensasAmount, setExpensasAmount] = useState(0);
  const [showClosedList, setShowClosedList] = useState(false);

  const activeMesa = mesas.find((m) => m.id === activeMesaId) || null;
  const cart = activeMesa ? activeMesa.items : [];
  const total = cart.reduce((sum, i) => sum + i.subtotal, 0);

  useEffect(() => {
    loadMesas();
    loadProducts();
  }, [selectedCategory]);

  useEffect(() => {
    const timer = setTimeout(() => {
      loadProducts();
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    const sum = cashAmount + transferAmount + qrAmount + expensasAmount;
    if (total > 0 && sum === 0) {
      setCashAmount(total);
    }
    if (total === 0 && sum !== 0) {
      setCashAmount(0);
      setTransferAmount(0);
      setQrAmount(0);
      setExpensasAmount(0);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [total]);

  const loadMesas = async () => {
    if (!shift) {
      setMesas([]);
      return;
    }
    const { data } = await supabase
      .from('mesas')
      .select('*')
      .eq('shift_id', shift.id)
      .order('created_at', { ascending: true });
    setMesas((data || []) as Mesa[]);
  };

  const loadProducts = async () => {
    let query = supabase
      .from('products')
      .select('id, code, name, category, price, stock')
      .eq('active', true)
      .gt('stock', 0)
      .order('name', { ascending: true })
      .limit(100);

    if (selectedCategory !== 'todas') {
      query = query.eq('category', selectedCategory);
    }

    if (search.trim()) {
      query = query.ilike('name', `%${search.trim()}%`);
    }

    const { data } = await query;
    setProducts(data || []);
  };

  const handleCreateMesa = async () => {
    if (!shift) {
      alert('No hay turno activo');
      return;
    }
    if (!newMesaNumber.trim()) {
      alert('Ingresá el número de mesa');
      return;
    }

    const existing = mesas.find(
      (m) =>
        m.table_number === newMesaNumber.trim() && m.status === 'open'
    );
    if (existing) {
      alert('Ya existe una mesa abierta con ese número');
      return;
    }

    const { data, error } = await supabase
      .from('mesas')
      .insert([
        {
          table_number: newMesaNumber.trim(),
          status: 'open',
          items: [],
          customer_name: '',
          customer_lot: '',
          shift_id: shift.id,
          user_id: shift.user_id,
          user_name: shift.user_name,
        },
      ])
      .select()
      .single();

    if (error) {
      alert('Error al abrir la mesa: ' + error.message);
      return;
    }

    await loadMesas();
    setActiveMesaId((data as Mesa).id);
    setShowNewMesaModal(false);
    setNewMesaNumber('');
  };

  const persistMesaItems = async (mesaId: string, items: SaleItem[]) => {
    await supabase
      .from('mesas')
      .update({
        items,
        updated_at: new Date().toISOString(),
      })
      .eq('id', mesaId);
  };

  const addToCart = (product: Product) => {
    if (!activeMesa) return;
    const existing = cart.find((i) => i.product_id === product.id);
    let newCart: SaleItem[];
    if (existing) {
      if (existing.quantity >= product.stock) {
        return alert('Stock insuficiente');
      }
      newCart = cart.map((i) =>
        i.product_id === product.id
          ? {
              ...i,
              quantity: i.quantity + 1,
              subtotal: (i.quantity + 1) * i.price,
            }
          : i
      );
    } else {
      newCart = [
        ...cart,
        {
          product_id: product.id,
          product_name: product.name,
          quantity: 1,
          price: product.price,
          subtotal: product.price,
        },
      ];
    }
    persistMesaItems(activeMesa.id, newCart);
    setMesas(
      mesas.map((m) => (m.id === activeMesa.id ? { ...m, items: newCart } : m))
    );
  };

  const updateQuantity = (id: string, qty: number) => {
    if (!activeMesa) return;
    let newCart: SaleItem[];
    if (qty <= 0) {
      newCart = cart.filter((i) => i.product_id !== id);
    } else {
      newCart = cart.map((i) =>
        i.product_id === id
          ? { ...i, quantity: qty, subtotal: qty * i.price }
          : i
      );
    }
    persistMesaItems(activeMesa.id, newCart);
    setMesas(
      mesas.map((m) => (m.id === activeMesa.id ? { ...m, items: newCart } : m))
    );
  };

  const updatePrice = (id: string, newPrice: number) => {
    if (!activeMesa || newPrice < 0) return;
    const newCart = cart.map((i) =>
      i.product_id === id
        ? { ...i, price: newPrice, subtotal: i.quantity * newPrice }
        : i
    );
    persistMesaItems(activeMesa.id, newCart);
    setMesas(
      mesas.map((m) => (m.id === activeMesa.id ? { ...m, items: newCart } : m))
    );
  };

  const updateCustomer = (field: 'customer_name' | 'customer_lot', value: string) => {
    if (!activeMesa) return;
    setMesas(
      mesas.map((m) =>
        m.id === activeMesa.id ? { ...m, [field]: value } : m
      )
    );
    supabase
      .from('mesas')
      .update({ [field]: value, updated_at: new Date().toISOString() })
      .eq('id', activeMesa.id);
  };

  const parseAmount = (value: string) => {
    if (!value) return 0;
    const n = parseFloat(value.replace(',', '.'));
    return isNaN(n) ? 0 : n;
  };

  const handleCompleteSale = async () => {
    if (!cart.length || !shift || !activeMesa) {
      return alert('Carrito vacío o sin turno activo');
    }

    let payments = [
      { method: 'efectivo', amount: cashAmount },
      { method: 'transferencia', amount: transferAmount },
      { method: 'qr', amount: qrAmount },
      { method: 'expensas', amount: expensasAmount },
    ].filter((p) => p.amount > 0.009);

    if (payments.length === 0) {
      payments = [{ method: 'efectivo', amount: total }];
      setCashAmount(total);
    }

    const paymentsTotal = payments.reduce((sum, p) => sum + p.amount, 0);
    if (Math.abs(paymentsTotal - total) > 0.01) {
      return alert(
        `La suma de los montos de pago (${paymentsTotal.toFixed(
          2
        )}) no coincide con el total (${total.toFixed(2)}).`
      );
    }

    const hasNonCash = payments.some((p) => p.method !== 'efectivo');
    if (hasNonCash && (!activeMesa.customer_name.trim() || !activeMesa.customer_lot.trim())) {
      return alert(
        'Para pagos que no son en efectivo debés completar el nombre y el lote del cliente.'
      );
    }

    let storedPaymentMethod = payments[0].method;
    if (payments.some((p) => p.method === 'efectivo')) {
      storedPaymentMethod = 'efectivo';
    }

    const saleData = {
      sale_number: `M-${Date.now()}`,
      user_id: shift.user_id,
      user_name: shift.user_name,
      shift_id: shift.id,
      items: cart,
      subtotal: total,
      discount: 0,
      total,
      payment_method: storedPaymentMethod,
      customer_name: activeMesa.customer_name.trim() || null,
      customer_lot: activeMesa.customer_lot.trim() || null,
      payments: payments,
    };

    const { error: saleError } = await supabase.from('sales').insert([saleData]);
    if (saleError) {
      console.error('Error insertando venta:', saleError);
      alert(`Error al registrar la venta: ${saleError.message}`);
      return;
    }

    for (const item of cart) {
      const prod = products.find((p) => p.id === item.product_id);
      if (prod) {
        const { error: stockError } = await supabase
          .from('products')
          .update({ stock: prod.stock - item.quantity })
          .eq('id', item.product_id);
        if (stockError) {
          console.error('Error actualizando stock:', stockError);
        }
      } else {
        const { data: freshProd } = await supabase
          .from('products')
          .select('stock')
          .eq('id', item.product_id)
          .single();
        if (freshProd) {
          await supabase
            .from('products')
            .update({ stock: freshProd.stock - item.quantity })
            .eq('id', item.product_id);
        }
      }
    }

    const cashRows = payments.map((p) => ({
      shift_id: shift.id,
      type: 'income',
      category: 'venta',
      amount: p.amount,
      payment_method: p.method,
      description: `Mesa ${activeMesa.table_number} - ${saleData.sale_number}${
        activeMesa.customer_name.trim() || activeMesa.customer_lot.trim()
          ? ` - ${activeMesa.customer_name.trim()} (Lote ${activeMesa.customer_lot.trim() || '-'})`
          : ''
      }`,
    }));

    const { error: cashError } = await supabase
      .from('cash_transactions')
      .insert(cashRows);

    if (cashError) {
      console.error('Error insertando caja:', cashError);
      alert(
        'La venta se registró, pero hubo un error al registrar el movimiento en caja.'
      );
    } else {
      alert('Mesa cobrada con éxito');
    }

    await supabase.from('mesas').delete().eq('id', activeMesa.id);

    setShowPaymentModal(false);
    setCashAmount(0);
    setTransferAmount(0);
    setQrAmount(0);
    setExpensasAmount(0);
    setActiveMesaId(null);
    await loadMesas();
    await loadProducts();
  };

  const handleCancelMesa = async () => {
    if (!activeMesa) return;
    if (!confirm('¿Cancelar esta mesa? Se eliminará el ticket sin cobrar.')) return;
    await supabase.from('mesas').delete().eq('id', activeMesa.id);
    setActiveMesaId(null);
    await loadMesas();
  };

  const baseCategories = ['Bebida', 'Comida', 'Artículos de Deporte'];
  const categories = Array.from(
    new Set([
      ...baseCategories,
      ...products
        .map((p) => p.category)
        .filter((c): c is string => !!c && c.trim() !== ''),
    ])
  );

  return (
    <div className="space-y-4">
      {/* BARRA SUPERIOR: mesas abiertas + abrir mesa */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          {mesas
            .filter((m) => m.status === 'open')
            .map((m) => {
              const mesaTotal = m.items.reduce((s, i) => s + i.subtotal, 0);
              const isActive = m.id === activeMesaId;
              return (
                <button
                  key={m.id}
                  onClick={() => setActiveMesaId(m.id)}
                  className={`px-4 py-2.5 rounded-xl font-semibold flex items-center gap-2 transition-all ${
                    isActive
                      ? 'bg-gradient-to-r from-rose-500 to-pink-600 text-white shadow-lg scale-105'
                      : 'bg-white border-2 border-slate-200 text-slate-700 hover:border-rose-400'
                  }`}
                >
                  <Utensils size={18} />
                  Mesa {m.table_number}
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full ${
                      isActive
                        ? 'bg-white/20 text-white'
                        : 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    ${mesaTotal.toFixed(2)}
                  </span>
                </button>
              );
            })}
        </div>

        <button
          onClick={() => setShowNewMesaModal(true)}
          className="bg-gradient-to-r from-rose-500 to-pink-600 hover:from-rose-600 hover:to-pink-700 text-white px-4 py-2.5 rounded-xl flex items-center gap-2 shadow-lg transition-all"
        >
          <PlusCircle size={20} />
          Abrir Mesa
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* LISTA DE PRODUCTOS */}
        <div className="lg:col-span-2 space-y-4">
          {!activeMesa ? (
            <div className="bg-white rounded-xl shadow-lg p-8 text-center border-2 border-dashed border-slate-200">
              <Utensils className="mx-auto text-slate-300 mb-3" size={48} />
              <p className="text-slate-500">
                Abrí o seleccioná una mesa para empezar a cargar productos.
              </p>
            </div>
          ) : (
            <>
              <div className="flex flex-col md:flex-row gap-3">
                <div className="relative flex-1">
                  <Search
                    className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400"
                    size={20}
                  />
                  <input
                    type="text"
                    placeholder="Buscar productos por nombre..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-rose-500 transition"
                  />
                </div>

                <div className="flex items-center">
                  <select
                    value={selectedCategory}
                    onChange={(e) => setSelectedCategory(e.target.value)}
                    className="w-full md:w-56 px-3 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-rose-500"
                  >
                    <option value="todas">Todas las categorías</option>
                    {categories.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-3 gap-3 max-h-[500px] overflow-y-auto">
                {products.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => addToCart(p)}
                    className="bg-gradient-to-br from-white to-slate-50 border-2 border-slate-200 hover:border-rose-500 rounded-xl p-4 text-left transition-all hover:shadow-lg"
                  >
                    <h3 className="font-bold text-slate-800 mb-1">{p.name}</h3>
                    {p.category && (
                      <p className="text-xs text-slate-500 mb-1">{p.category}</p>
                    )}
                    <p className="text-2xl font-bold text-rose-600">
                      ${p.price.toFixed(2)}
                    </p>
                    <p className="text-xs text-slate-500 mt-1">Stock: {p.stock}</p>
                  </button>
                ))}
              </div>
            </>
          )}
        </div>

        {/* CARRITO DE LA MESA ACTIVA */}
        <div className="space-y-4">
          <div className="bg-gradient-to-br from-white to-slate-50 rounded-xl shadow-lg p-4 border-2 border-slate-200">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <ShoppingCart className="text-rose-600" size={24} />
                <h3 className="text-lg font-bold text-slate-800">
                  {activeMesa
                    ? `Mesa ${activeMesa.table_number}`
                    : 'Sin mesa seleccionada'}
                </h3>
              </div>
              {activeMesa && (
                <button
                  onClick={handleCancelMesa}
                  className="text-red-500 hover:text-red-700 text-sm font-medium"
                >
                  Cancelar
                </button>
              )}
            </div>

            <div className="space-y-2 mb-4 max-h-[220px] overflow-y-auto">
              {cart.map((item) => (
                <div
                  key={item.product_id}
                  className="bg-white rounded-lg p-3 border border-slate-200"
                >
                  <div className="flex justify-between items-start mb-2">
                    <span className="font-medium text-sm">
                      {item.product_name}
                    </span>
                    <button
                      onClick={() => updateQuantity(item.product_id, 0)}
                      className="text-red-600"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() =>
                          updateQuantity(item.product_id, item.quantity - 1)
                        }
                        className="w-8 h-8 bg-slate-100 rounded-lg flex items-center justify-center"
                      >
                        <Minus size={16} />
                      </button>
                      <span className="w-8 text-center font-bold">
                        {item.quantity}
                      </span>
                      <button
                        onClick={() =>
                          updateQuantity(item.product_id, item.quantity + 1)
                        }
                        className="w-8 h-8 bg-slate-100 rounded-lg flex items-center justify-center"
                      >
                        <Plus size={16} />
                      </button>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-slate-600">$</span>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={item.price}
                        onChange={(e) =>
                          updatePrice(
                            item.product_id,
                            parseFloat(e.target.value) || 0
                          )
                        }
                        className="w-20 px-2 py-1 text-sm border border-slate-300 rounded-lg text-right"
                      />
                    </div>
                  </div>
                  <div className="flex justify-end">
                    <span className="font-bold text-rose-600">
                      ${item.subtotal.toFixed(2)}
                    </span>
                  </div>
                </div>
              ))}
              {cart.length === 0 && activeMesa && (
                <p className="text-center text-slate-400 text-sm py-4">
                  Todavía no hay productos cargados en esta mesa.
                </p>
              )}
            </div>

            {activeMesa && (
              <>
                <div className="space-y-2 mb-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <input
                      type="text"
                      placeholder="Nombre del cliente"
                      value={activeMesa.customer_name}
                      onChange={(e) => updateCustomer('customer_name', e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm"
                    />
                    <input
                      type="text"
                      placeholder="Lote"
                      value={activeMesa.customer_lot}
                      onChange={(e) => updateCustomer('customer_lot', e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm"
                    />
                  </div>
                </div>

                <div className="border-t-2 border-slate-200 pt-4 space-y-3">
                  <div className="flex justify-between items-center text-2xl font-bold">
                    <span>Total:</span>
                    <span className="text-rose-600">${total.toFixed(2)}</span>
                  </div>

                  <button
                    onClick={() => {
                      setCashAmount(total);
                      setTransferAmount(0);
                      setQrAmount(0);
                      setExpensasAmount(0);
                      setShowPaymentModal(true);
                    }}
                    disabled={!cart.length}
                    className="w-full bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 disabled:from-slate-300 disabled:to-slate-400 text-white font-bold py-4 rounded-xl flex items-center justify-center gap-2 shadow-lg transition-all"
                  >
                    <CreditCard size={24} />
                    Cobrar Mesa
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* MODAL ABRIR MESA */}
      {showNewMesaModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl overflow-hidden">
            <div className="bg-gradient-to-r from-rose-500 to-pink-600 p-6 text-center">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-white/20 backdrop-blur-sm rounded-2xl mb-3">
                <Utensils className="text-white" size={32} />
              </div>
              <h2 className="text-2xl font-bold text-white">Abrir Mesa</h2>
              <p className="text-rose-100 text-sm">Ingresá el número de la mesa</p>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleCreateMesa();
              }}
              className="p-6 space-y-4"
            >
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Número de Mesa *
                </label>
                <input
                  type="text"
                  required
                  autoFocus
                  value={newMesaNumber}
                  onChange={(e) => setNewMesaNumber(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-200 rounded-xl focus:ring-2 focus:ring-rose-500 focus:border-transparent transition-all"
                  placeholder="Ej: 5"
                />
              </div>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setShowNewMesaModal(false);
                    setNewMesaNumber('');
                  }}
                  className="flex-1 px-6 py-3 border-2 border-slate-300 text-slate-700 font-semibold rounded-xl hover:bg-slate-50 transition-all"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 px-6 py-3 bg-gradient-to-r from-rose-500 to-pink-600 hover:from-rose-600 hover:to-pink-700 text-white font-semibold rounded-xl shadow-lg transition-all"
                >
                  Abrir
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL DE PAGO */}
      {showPaymentModal && activeMesa && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl overflow-hidden">
            <div className="bg-gradient-to-r from-emerald-500 to-teal-600 p-6 flex justify-between items-center">
              <div>
                <h2 className="text-2xl font-bold text-white">Cobrar Mesa {activeMesa.table_number}</h2>
                <p className="text-emerald-100 text-sm">Total: ${total.toFixed(2)}</p>
              </div>
              <button
                onClick={() => setShowPaymentModal(false)}
                className="text-white/80 hover:text-white"
              >
                <X size={24} />
              </button>
            </div>

            <div className="p-6 space-y-3">
              <div className="space-y-2">
                <div className="flex items-center justify-between bg-slate-50 border border-slate-200 rounded-xl px-3 py-2">
                  <span className="text-sm font-medium text-slate-700">Efectivo</span>
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    value={cashAmount || ''}
                    onChange={(e) => setCashAmount(parseAmount(e.target.value))}
                    className="w-28 px-2 py-1 bg-white border border-slate-200 rounded-lg text-sm text-right"
                    placeholder="0"
                  />
                </div>
                <div className="flex items-center justify-between bg-slate-50 border border-slate-200 rounded-xl px-3 py-2">
                  <span className="text-sm font-medium text-slate-700">Transferencia</span>
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    value={transferAmount || ''}
                    onChange={(e) => setTransferAmount(parseAmount(e.target.value))}
                    className="w-28 px-2 py-1 bg-white border border-slate-200 rounded-lg text-sm text-right"
                    placeholder="0"
                  />
                </div>
                <div className="flex items-center justify-between bg-slate-50 border border-slate-200 rounded-xl px-3 py-2">
                  <span className="text-sm font-medium text-slate-700">QR</span>
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    value={qrAmount || ''}
                    onChange={(e) => setQrAmount(parseAmount(e.target.value))}
                    className="w-28 px-2 py-1 bg-white border border-slate-200 rounded-lg text-sm text-right"
                    placeholder="0"
                  />
                </div>
                <div className="flex items-center justify-between bg-slate-50 border border-slate-200 rounded-xl px-3 py-2">
                  <span className="text-sm font-medium text-slate-700">Expensas</span>
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    value={expensasAmount || ''}
                    onChange={(e) => setExpensasAmount(parseAmount(e.target.value))}
                    className="w-28 px-2 py-1 bg-white border border-slate-200 rounded-lg text-sm text-right"
                    placeholder="0"
                  />
                </div>
              </div>

              <div className="flex justify-between items-center text-xl font-bold pt-2">
                <span>Suma:</span>
                <span
                  className={
                    Math.abs(
                      cashAmount +
                        transferAmount +
                        qrAmount +
                        expensasAmount -
                        total
                    ) < 0.01
                      ? 'text-emerald-600'
                      : 'text-red-600'
                  }
                >
                  ${(cashAmount + transferAmount + qrAmount + expensasAmount).toFixed(2)}
                </span>
              </div>

              <button
                onClick={handleCompleteSale}
                className="w-full bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2 shadow-lg transition-all"
              >
                <CreditCard size={22} />
                Confirmar Pago
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
