import { useState, useEffect } from 'react';
import { ShoppingCart, Package, Wallet, BarChart3, Settings, Store, TrendingUp, ShoppingBag } from 'lucide-react';
import { Shift, supabase, CashTransaction } from '../lib/supabase';
import Ventas from './Ventas';
import Stock from './Stock';
import Caja from './Caja';
import Reportes from './Reportes';
import Configuracion from './Configuracion';
import Movimientos from './Movimientos';
import Compras from './Compras';

type View = 'ventas' | 'stock' | 'movimientos' | 'caja' | 'reportes' | 'configuracion' | 'compras';

interface DashboardProps {
  shift: Shift | null;
  onCloseShift: (closingCash: number) => void;
}

export default function Dashboard({ shift, onCloseShift }: DashboardProps) {
  const [currentView, setCurrentView] = useState<View>('ventas');
  const [businessName, setBusinessName] = useState('Kiosco Damian');
  const [currentTime, setCurrentTime] = useState(new Date());

  const [cashInBox, setCashInBox] = useState(0);
  const [transferInBox, setTransferInBox] = useState(0);
  const [qrInBox, setQrInBox] = useState(0);
  const [expensasInBox, setExpensasInBox] = useState(0);

  const [monthlySales, setMonthlySales] = useState(0);
  const [monthlyTransactions, setMonthlyTransactions] = useState(0);
  const [monthlyProfit, setMonthlyProfit] = useState(0);

  useEffect(() => {
    loadBusinessName();
    loadMonthlyTotals();

    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    const monthlyTimer = setInterval(() => {
      loadMonthlyTotals();
    }, 30000);

    return () => {
      clearInterval(timer);
      clearInterval(monthlyTimer);
    };
  }, []);

  useEffect(() => {
    if (shift) {
      loadTotals();
    } else {
      setCashInBox(0);
      setTransferInBox(0);
      setQrInBox(0);
      setExpensasInBox(0);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shift]);

  useEffect(() => {
    if (currentView === 'ventas') {
      loadMonthlyTotals();
      if (shift) {
        loadTotals();
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentView]);

  const loadBusinessName = async () => {
    const { data } = await supabase
      .from('configuration')
      .select('business_name')
      .maybeSingle();
    if (data) {
      setBusinessName(data.business_name);
    }
  };

  const getCurrentTime = () => {
    return currentTime.toLocaleTimeString('es-AR', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    });
  };

  const loadMonthlyTotals = async () => {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

    const { data: sales } = await supabase
      .from('sales')
      .select('total, items')
      .gte('created_at', startOfMonth.toISOString())
      .lte('created_at', endOfMonth.toISOString());

    const totalSales = sales?.reduce((sum, s) => sum + Number(s.total), 0) || 0;
    const totalTransactions = sales?.length || 0;

    const { data: products } = await supabase
      .from('products')
      .select('cost');

    const totalCost = sales?.reduce((sum, sale) => {
      const items = sale.items as Array<{ product_id: string; quantity: number; price: number }>;
      return sum + items.reduce((itemSum, item) => {
        const product = products?.find((p: any) => p.id === item.product_id);
        const cost = product?.cost || 0;
        return itemSum + (cost * item.quantity);
      }, 0);
    }, 0) || 0;

    const profit = totalSales - totalCost;

    setMonthlySales(totalSales);
    setMonthlyTransactions(totalTransactions);
    setMonthlyProfit(profit);
  };

  const loadTotals = async () => {
    if (!shift) return;

    const { data } = await supabase
      .from('cash_transactions')
      .select('type, payment_method, amount')
      .eq('shift_id', shift.id)
      .order('created_at', { ascending: false });

    const transactions = (data || []) as CashTransaction[];

    const openingCash = Number(shift.opening_cash || 0);

    const totals = transactions.reduce((acc, t) => {
      const method = t.payment_method;
      const amount = Number(t.amount);

      if (!acc[method]) {
        acc[method] = { income: 0, expense: 0 };
      }

      if (t.type === 'income') {
        acc[method].income += amount;
      } else {
        acc[method].expense += amount;
      }

      return acc;
    }, {} as Record<string, { income: number; expense: number }>);

    const cash = openingCash + (totals.efectivo?.income || 0) - (totals.efectivo?.expense || 0);
    const transfer = (totals.transferencia?.income || 0) - (totals.transferencia?.expense || 0);
    const qr = (totals.qr?.income || 0) - (totals.qr?.expense || 0);
    const expensas = (totals.expensas?.income || 0) - (totals.expensas?.expense || 0);

    setCashInBox(cash);
    setTransferInBox(transfer);
    setQrInBox(qr);
    setExpensasInBox(expensas);
  };

  const menuItems = [
    { id: 'ventas' as View, label: 'Ventas', icon: ShoppingCart, color: 'from-emerald-500 to-teal-600' },
    { id: 'compras' as View, label: 'Compras', icon: ShoppingBag, color: 'from-rose-500 to-pink-600' },
    { id: 'stock' as View, label: 'Inventario', icon: Package, color: 'from-blue-500 to-cyan-600' },
    { id: 'movimientos' as View, label: 'Movimientos', icon: TrendingUp, color: 'from-amber-500 to-orange-600' },
    { id: 'caja' as View, label: 'Caja', icon: Wallet, color: 'from-violet-500 to-purple-600' },
    { id: 'reportes' as View, label: 'Reportes', icon: BarChart3, color: 'from-cyan-500 to-blue-600' },
    { id: 'configuracion' as View, label: 'Configuración', icon: Settings, color: 'from-gray-500 to-slate-600' },
  ];

  const currentItem = menuItems.find(item => item.id === currentView);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      <header className="bg-white shadow-lg border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="bg-gradient-to-br from-emerald-500 to-teal-600 p-3 rounded-xl shadow-lg">
                <Store className="text-white" size={28} />
              </div>
              <div>
                <h1 className="text-2xl font-bold bg-gradient-to-r from-slate-800 to-slate-600 bg-clip-text text-transparent">
                  {businessName}
                </h1>
                <p className="text-sm text-slate-600">Sistema de Gestión POS</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-right">
                <p className="text-sm font-semibold text-slate-700">
                  {shift ? `Turno Activo - ${getCurrentTime()}` : 'Sin turno activo'}
                </p>
                <p className="text-xs text-slate-500">
                  {shift ? `Usuario: ${shift.user_name}` : 'Usuario: -'}
                </p>
              </div>
              <div
                className={`w-3 h-3 rounded-full ${
                  shift ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'
                }`}
              ></div>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Resumen del Mes */}
        <div className="mb-6">
          <h3 className="text-lg font-bold text-slate-800 mb-3">Resumen del Mes</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl p-5 shadow-lg text-white">
              <p className="text-sm font-semibold opacity-90">Ventas Totales</p>
              <p className="text-3xl font-bold mt-2">
                ${monthlySales.toFixed(2)}
              </p>
              <p className="text-xs opacity-75 mt-2">
                Facturación total del mes
              </p>
            </div>
            <div className="bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-xl p-5 shadow-lg text-white">
              <p className="text-sm font-semibold opacity-90">Transacciones</p>
              <p className="text-3xl font-bold mt-2">
                {monthlyTransactions}
              </p>
              <p className="text-xs opacity-75 mt-2">
                Ventas realizadas este mes
              </p>
            </div>
            <div className="bg-gradient-to-br from-amber-500 to-amber-600 rounded-xl p-5 shadow-lg text-white">
              <p className="text-sm font-semibold opacity-90">Ganancia Estimada</p>
              <p className="text-3xl font-bold mt-2">
                ${monthlyProfit.toFixed(2)}
              </p>
              <p className="text-xs opacity-75 mt-2">
                Ventas - costos del mes
              </p>
            </div>
          </div>
        </div>

        {/* Turno Actual */}
        <div className="mb-6">
          <h3 className="text-lg font-bold text-slate-800 mb-3">Turno Actual - Caja por Método de Pago</h3>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-white rounded-xl p-4 shadow border border-slate-200">
              <p className="text-sm font-semibold text-slate-600">Caja Efectivo</p>
              <p className="text-2xl font-bold text-emerald-600">
                {shift ? `$${cashInBox.toFixed(2)}` : '--'}
              </p>
              <p className="text-xs text-slate-500 mt-1">
                Efectivo inicial + ingresos - egresos
              </p>
            </div>
            <div className="bg-white rounded-xl p-4 shadow border border-slate-200">
              <p className="text-sm font-semibold text-slate-600">Transferencias</p>
              <p className="text-2xl font-bold text-slate-800">
                {shift ? `$${transferInBox.toFixed(2)}` : '--'}
              </p>
              <p className="text-xs text-slate-500 mt-1">
                Ingresos - egresos por transferencia
              </p>
            </div>
            <div className="bg-white rounded-xl p-4 shadow border border-slate-200">
              <p className="text-sm font-semibold text-slate-600">QR</p>
              <p className="text-2xl font-bold text-slate-800">
                {shift ? `$${qrInBox.toFixed(2)}` : '--'}
              </p>
              <p className="text-xs text-slate-500 mt-1">
                Ingresos - egresos por QR
              </p>
            </div>
            <div className="bg-white rounded-xl p-4 shadow border border-slate-200">
              <p className="text-sm font-semibold text-slate-600">Expensas</p>
              <p className="text-2xl font-bold text-slate-800">
                {shift ? `$${expensasInBox.toFixed(2)}` : '--'}
              </p>
              <p className="text-xs text-slate-500 mt-1">
                Ingresos - egresos por expensas
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-12 gap-6">
          <aside className="col-span-12 lg:col-span-2">
            <div className="bg-white rounded-2xl shadow-xl p-4 space-y-2">
              {menuItems.map((item) => {
                const Icon = item.icon;
                const isActive = currentView === item.id;

                return (
                  <button
                    key={item.id}
                    onClick={() => setCurrentView(item.id)}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 ${
                      isActive
                        ? `bg-gradient-to-r ${item.color} text-white shadow-lg scale-105`
                        : 'text-slate-600 hover:bg-slate-50 hover:scale-102'
                    }`}
                  >
                    <Icon size={20} />
                    <span className="font-medium text-sm">{item.label}</span>
                  </button>
                );
              })}
            </div>
          </aside>

          <main className="col-span-12 lg:col-span-10">
            <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
              <div className={`bg-gradient-to-r ${currentItem?.color} p-6 text-white`}>
                <div className="flex items-center gap-3">
                  {currentItem && <currentItem.icon size={32} />}
                  <div>
                    <h2 className="text-2xl font-bold">{currentItem?.label}</h2>
                    <p className="text-white/80 text-sm">
                      Gestiona tus {currentItem?.label.toLowerCase()}
                    </p>
                  </div>
                </div>
              </div>

              <div className="p-6">
                {currentView === 'ventas' && <Ventas shift={shift} />}
                {currentView === 'compras' && <Compras />}
                {currentView === 'stock' && <Stock />}
                {currentView === 'movimientos' && shift && <Movimientos shift={shift} />}
                {currentView === 'caja' && <Caja shift={shift} onCloseShift={onCloseShift} />}
                {currentView === 'reportes' && <Reportes />}
                {currentView === 'configuracion' && <Configuracion />}
              </div>
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}
