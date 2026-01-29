import { useState, useEffect } from 'react';
import { supabase, InventoryMovement, Product, Shift } from '../lib/supabase';
import { Package, Plus, Filter, TrendingUp, TrendingDown, Search, Lock } from 'lucide-react';

interface MovimientosProps {
  shift: Shift;
}

export default function Movimientos({ shift }: MovimientosProps) {
  const [movements, setMovements] = useState<InventoryMovement[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [password, setPassword] = useState('');

  const [filterType, setFilterType] = useState<'all' | 'sale' | 'purchase'>('all');
  const [filterDate, setFilterDate] = useState('today');
  const [filterProduct, setFilterProduct] = useState('');
  const [filterSupplier, setFilterSupplier] = useState('');
  const [filterCategory, setFilterCategory] = useState('');

  const [formData, setFormData] = useState({
    product_id: '',
    quantity: '',
    supplier: '',
    reference: '',
    notes: ''
  });

  useEffect(() => {
    loadData();
  }, [filterDate, filterType, filterProduct, filterSupplier, filterCategory]);

  const loadData = async () => {
    setLoading(true);

    let query = supabase
      .from('inventory_movements')
      .select('*')
      .order('created_at', { ascending: false });

    if (filterType !== 'all') {
      query = query.eq('type', filterType);
    }

    if (filterDate === 'today') {
      const hoursAgo24 = new Date();
      hoursAgo24.setHours(hoursAgo24.getHours() - 24);
      query = query.gte('created_at', hoursAgo24.toISOString());
    } else if (filterDate === 'week') {
      const daysAgo7 = new Date();
      daysAgo7.setDate(daysAgo7.getDate() - 7);
      query = query.gte('created_at', daysAgo7.toISOString());
    } else if (filterDate === 'month') {
      const daysAgo30 = new Date();
      daysAgo30.setDate(daysAgo30.getDate() - 30);
      query = query.gte('created_at', daysAgo30.toISOString());
    }

    if (filterProduct) {
      query = query.or(`product_name.ilike.%${filterProduct}%,product_code.ilike.%${filterProduct}%`);
    }

    if (filterSupplier) {
      query = query.ilike('supplier', `%${filterSupplier}%`);
    }

    if (filterCategory) {
      query = query.eq('category', filterCategory);
    }

    const [{ data: movementsData }, { data: productsData }] = await Promise.all([
      query,
      supabase.from('products').select('*').order('name')
    ]);

    setMovements(movementsData || []);
    setProducts(productsData || []);
    setLoading(false);
  };

  const handlePasswordSubmit = () => {
    if (password !== '842114') {
      alert('Contraseña incorrecta');
      return;
    }

    setShowPasswordModal(false);
    setPassword('');
    setShowAddModal(true);
  };

  const handleAddMovement = async (e: React.FormEvent) => {
    e.preventDefault();

    const product = products.find(p => p.id === formData.product_id);
    if (!product) {
      alert('Selecciona un producto válido');
      return;
    }

    const quantity = parseInt(formData.quantity) || 0;
    if (quantity <= 0) {
      alert('La cantidad debe ser mayor a 0');
      return;
    }

    const previousStock = product.stock;
    const newStock = previousStock + quantity;

    const { error: updateError } = await supabase.from('products').update({
      stock: newStock,
      updated_at: new Date().toISOString()
    }).eq('id', product.id);

    if (updateError) {
      console.error('Error actualizando stock:', updateError);
      alert('Error actualizando el stock del producto');
      return;
    }

    const { error: insertError } = await supabase.from('inventory_movements').insert([{
      product_id: product.id,
      product_code: product.code,
      product_name: product.name,
      category: product.category || '',
      type: 'purchase',
      quantity: quantity,
      previous_stock: previousStock,
      new_stock: newStock,
      supplier: formData.supplier || '',
      reference: formData.reference || '',
      user_name: shift.user_name,
      shift_id: shift.id,
      notes: formData.notes || ''
    }]);

    if (insertError) {
      console.error('Error registrando movimiento:', insertError);
      alert(`Error registrando el movimiento: ${insertError.message}\n\nPor favor, ejecuta el script SQL create_inventory_movements.sql en Supabase.`);
      return;
    }

    setFormData({
      product_id: '',
      quantity: '',
      supplier: '',
      reference: '',
      notes: ''
    });
    setShowAddModal(false);
    loadData();
  };

  const formatDateTime = (iso: string) => {
    const d = new Date(iso);
    const offset = -3;
    d.setHours(d.getHours() + offset);

    return d.toLocaleString('es-AR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    });
  };

  const allCategories = Array.from(new Set(movements.map(m => m.category).filter(Boolean)));
  const allSuppliers = Array.from(new Set(movements.filter(m => m.type === 'purchase').map(m => m.supplier).filter(Boolean)));

  const totalIngresos = movements.filter(m => m.type === 'purchase').reduce((sum, m) => sum + m.quantity, 0);
  const totalVentas = movements.filter(m => m.type === 'sale').reduce((sum, m) => sum + Math.abs(m.quantity), 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <Package className="text-blue-600" size={32} />
          <h3 className="text-xl font-bold text-slate-800">Movimientos de Inventario</h3>
        </div>

        <button
          onClick={() => setShowPasswordModal(true)}
          className="bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white px-6 py-2.5 rounded-xl flex items-center gap-2 shadow-lg transition-all duration-200 hover:scale-105"
        >
          <Plus size={20} />
          Cargar Mercadería
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-xl p-6 text-white shadow-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-emerald-100 text-sm">Total Ingresos</p>
              <p className="text-3xl font-bold mt-2">{totalIngresos} unidades</p>
            </div>
            <TrendingUp className="opacity-80" size={40} />
          </div>
        </div>

        <div className="bg-gradient-to-br from-orange-500 to-orange-600 rounded-xl p-6 text-white shadow-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-orange-100 text-sm">Total Ventas</p>
              <p className="text-3xl font-bold mt-2">{totalVentas} unidades</p>
            </div>
            <TrendingDown className="opacity-80" size={40} />
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-lg p-6">
        <div className="flex items-center gap-2 mb-4">
          <Filter size={20} className="text-slate-600" />
          <h4 className="text-lg font-bold text-slate-800">Filtros</h4>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Período</label>
            <select
              value={filterDate}
              onChange={(e) => setFilterDate(e.target.value)}
              className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500"
            >
              <option value="today">Hoy</option>
              <option value="week">Última Semana</option>
              <option value="month">Último Mes</option>
              <option value="all">Todo</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Tipo</label>
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value as any)}
              className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">Todos</option>
              <option value="purchase">Ingresos</option>
              <option value="sale">Ventas</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Producto</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" size={16} />
              <input
                type="text"
                placeholder="Buscar..."
                value={filterProduct}
                onChange={(e) => setFilterProduct(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Rubro</label>
            <select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Todos</option>
              {allCategories.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Proveedor</label>
            <select
              value={filterSupplier}
              onChange={(e) => setFilterSupplier(e.target.value)}
              className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Todos</option>
              {allSuppliers.map(sup => (
                <option key={sup} value={sup}>{sup}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-8">Cargando...</div>
      ) : (
        <div className="bg-white rounded-xl shadow-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Fecha/Hora</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Tipo</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Producto</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Código</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Rubro</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-slate-500 uppercase">Cantidad</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-slate-500 uppercase">Stock Ant.</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-slate-500 uppercase">Stock Nuevo</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Proveedor</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Referencia</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">Usuario</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-slate-200">
                {movements.map((movement) => (
                  <tr key={movement.id} className="hover:bg-slate-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">
                      {formatDateTime(movement.created_at)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      {movement.type === 'purchase' ? (
                        <span className="inline-flex items-center gap-1 bg-emerald-100 text-emerald-700 px-2 py-1 rounded-full text-xs font-medium">
                          <TrendingUp size={14} />
                          Ingreso
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 bg-orange-100 text-orange-700 px-2 py-1 rounded-full text-xs font-medium">
                          <TrendingDown size={14} />
                          Venta
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-sm font-medium text-slate-900">
                      {movement.product_name}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500 font-mono">
                      {movement.product_code}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">
                      {movement.category || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-medium">
                      <span className={movement.type === 'purchase' ? 'text-emerald-600' : 'text-orange-600'}>
                        {movement.type === 'purchase' ? '+' : ''}{movement.quantity}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-slate-500">
                      {movement.previous_stock}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-medium text-slate-900">
                      {movement.new_stock}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">
                      {movement.supplier || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">
                      {movement.reference || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">
                      {movement.user_name}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {movements.length === 0 && (
              <div className="text-center py-8 text-slate-500">
                No hay movimientos para mostrar
              </div>
            )}
          </div>
        </div>
      )}

      {showPasswordModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl p-6 w-96 shadow-2xl">
            <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
              <Lock className="w-5 h-5 text-amber-600" />
              Autorización Requerida
            </h3>
            <p className="text-sm text-slate-600 mb-4">
              Ingresa la contraseña de Super Administrador para cargar mercadería
            </p>

            <div className="mb-4">
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                Contraseña
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyPress={(e) => {
                  if (e.key === 'Enter') {
                    handlePasswordSubmit();
                  }
                }}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                placeholder="Ingrese la contraseña"
                autoFocus
              />
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowPasswordModal(false);
                  setPassword('');
                }}
                className="flex-1 bg-slate-200 hover:bg-slate-300 text-slate-800 py-2 rounded-lg font-semibold"
              >
                Cancelar
              </button>
              <button
                onClick={handlePasswordSubmit}
                className="flex-1 bg-emerald-500 hover:bg-emerald-600 text-white py-2 rounded-lg font-semibold"
              >
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}

      {showAddModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-2xl w-full shadow-2xl">
            <div className="bg-gradient-to-r from-emerald-500 to-teal-600 p-6 rounded-t-2xl">
              <h3 className="text-2xl font-bold text-white">Cargar Mercadería</h3>
              <p className="text-emerald-100 text-sm mt-1">Registra el ingreso de productos al inventario</p>
            </div>

            <form onSubmit={handleAddMovement} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">Producto *</label>
                <select
                  required
                  value={formData.product_id}
                  onChange={(e) => setFormData({ ...formData, product_id: e.target.value })}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="">Seleccionar producto...</option>
                  {products.map(product => (
                    <option key={product.id} value={product.id}>
                      {product.code} - {product.name} (Stock actual: {product.stock})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">Cantidad *</label>
                  <input
                    type="number"
                    required
                    min="1"
                    value={formData.quantity}
                    onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500"
                    placeholder="Ej: 50"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">Proveedor</label>
                  <input
                    type="text"
                    value={formData.supplier}
                    onChange={(e) => setFormData({ ...formData, supplier: e.target.value })}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500"
                    placeholder="Ej: Distribuidora XYZ"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">Referencia</label>
                <input
                  type="text"
                  value={formData.reference}
                  onChange={(e) => setFormData({ ...formData, reference: e.target.value })}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500"
                  placeholder="Ej: Factura N° 12345"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">Notas</label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500"
                  rows={3}
                  placeholder="Observaciones adicionales..."
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowAddModal(false);
                    setFormData({
                      product_id: '',
                      quantity: '',
                      supplier: '',
                      reference: '',
                      notes: ''
                    });
                  }}
                  className="flex-1 px-6 py-3 border-2 border-slate-300 text-slate-700 font-semibold rounded-xl hover:bg-slate-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 px-6 py-3 bg-gradient-to-r from-emerald-500 to-teal-600 text-white font-semibold rounded-xl hover:from-emerald-600 hover:to-teal-700 shadow-lg"
                >
                  Guardar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
