'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabaseClient';
import { 
  LayoutDashboard, Package, ShoppingCart, Users, BarChart3, Settings, 
  Search, Plus, Filter, Download, ChevronDown, AlertTriangle, 
  CheckCircle2, Clock, Truck, X, RefreshCw, MoreVertical, 
  Merge, Tags, Trash2, AlertCircle, Phone, MapPin, Edit3, ExternalLink
} from 'lucide-react';

// --- COMPONENTS ---

const NavItem = ({ icon: Icon, label, active, onClick }) => (
  <button
    onClick={onClick}
    className={`w-full flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-lg transition-all mb-1 ${
      active 
        ? 'bg-orange-600 text-white shadow-md shadow-orange-200' 
        : 'text-gray-600 hover:bg-orange-50 hover:text-orange-700'
    }`}
  >
    <Icon className="w-5 h-5" />
    {label}
  </button>
);

const Badge = ({ status }) => {
  const styles = {
    Good: 'bg-emerald-100 text-emerald-800 border-emerald-200',
    Low: 'bg-yellow-100 text-yellow-800 border-yellow-200',
    Critical: 'bg-red-100 text-red-800 border-red-200',
    Pending: 'bg-yellow-100 text-yellow-800',
    Processing: 'bg-blue-100 text-blue-800',
    Shipped: 'bg-purple-100 text-purple-800',
    Delivered: 'bg-green-100 text-green-800',
    Cancelled: 'bg-gray-100 text-gray-800',
    Partial: 'bg-orange-100 text-orange-800 border-orange-200'
  };
  return (
    <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold border ${styles[status] || 'bg-gray-100'}`}>
      {status || 'Pending'}
    </span>
  );
};

// --- MAIN APPLICATION ---

export default function Home() {
  const [activeTab, setActiveTab] = useState('overview');
  const [orders, setOrders] = useState([]);
  const [inventory, setInventory] = useState([]);
  const [categories, setCategories] = useState(['Pickles', 'Podis', 'Snacks', 'Sweets']);
  const [loading, setLoading] = useState(true);

  // Modals
  const [showProductionModal, setShowProductionModal] = useState(false);
  const [showOrderEditModal, setShowOrderEditModal] = useState(null);
  const [showAddProductModal, setShowAddProductModal] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState(null);

  // Forms
  const [prodBatchData, setProdBatchData] = useState({ productName: '', jarType: '', qty: 0 });
  const [newProductData, setNewProductData] = useState({ name: '', sku: '', category: 'Pickles', jarTypes: [], unit: 'Jars' });

  // --- DATA FETCHING ---

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      // 1. Fetch Products
      const { data: productsData, error: prodError } = await supabase
        .from('products')
        .select('*')
        .order('name');
      
      if (prodError) throw prodError;
      
      // Map DB columns to UI state
      const mappedInventory = productsData.map(p => ({
        ...p,
        stock: p.stock_quantity,
        jarType: p.jar_type
      }));
      setInventory(mappedInventory);

      // 2. Fetch Orders
      const { data: ordersData, error: ordError } = await supabase
        .from('orders')
        .select('*')
        .order('created_at', { ascending: false });

      if (ordError) throw ordError;

      // Map DB columns to UI state
      const mappedOrders = ordersData.map(o => ({
        id: o.id,
        source: o.source,
        customer: o.customer_name,
        phone: o.customer_phone,
        location: o.customer_location,
        total: o.total_amount,
        originalTotal: o.original_amount,
        status: o.status,
        edited: o.is_edited,
        notes: o.notes,
        date: new Date(o.created_at).toLocaleDateString()
      }));
      setOrders(mappedOrders);

    } catch (error) {
      console.error('Error fetching data:', error);
      // alert('Error connecting to Supabase. Check your .env.local file.');
    } finally {
      setLoading(false);
    }
  };

  // --- ACTIONS ---

  const handleAddProduct = async (e) => {
    e.preventDefault();
    if (newProductData.jarTypes.length === 0) {
      alert("Please select at least one packaging type.");
      return;
    }

    const newRows = newProductData.jarTypes.map(type => ({
      name: newProductData.name,
      sku: newProductData.sku ? `${newProductData.sku}-${type.substring(0,2).toUpperCase()}` : null,
      category: newProductData.category,
      jar_type: type,
      unit: newProductData.unit,
      stock_quantity: 0
    }));

    const { error } = await supabase.from('products').insert(newRows);
    
    if (error) {
      alert('Error adding product: ' + error.message);
    } else {
      setShowAddProductModal(false);
      setNewProductData({ name: '', sku: '', category: 'Pickles', jarTypes: [], unit: 'Jars' });
      fetchData(); // Refresh data
    }
  };

  const handleProductionSubmit = async (e) => {
    e.preventDefault();
    // Find the specific product ID based on Name + Jar Type
    const product = inventory.find(i => i.name === prodBatchData.productName && i.jarType === prodBatchData.jarType);
    
    if (!product) return;

    const newStock = (product.stock || 0) + parseInt(prodBatchData.qty);

    // Update Supabase
    const { error } = await supabase
      .from('products')
      .update({ stock_quantity: newStock })
      .eq('id', product.id);

    if (error) {
      alert('Error updating stock: ' + error.message);
    } else {
      setShowProductionModal(false);
      setProdBatchData({ productName: '', jarType: '', qty: 0 });
      fetchData(); // Refresh
    }
  };

  const handleOrderOverride = async (e) => {
    e.preventDefault();
    const newTotal = parseFloat(e.target.overrideTotal.value);
    const notes = e.target.notes.value;

    const { error } = await supabase
      .from('orders')
      .update({
        total_amount: newTotal,
        notes: notes,
        is_edited: true,
        // If it wasn't edited before, save the current total as original
        original_amount: showOrderEditModal.edited ? showOrderEditModal.originalTotal : showOrderEditModal.total
      })
      .eq('id', showOrderEditModal.id);

    if (error) {
      alert('Error updating order: ' + error.message);
    } else {
      setShowOrderEditModal(null);
      fetchData();
    }
  };

  const updateOrderStatus = async (id, newStatus) => {
    const { error } = await supabase
      .from('orders')
      .update({ status: newStatus })
      .eq('id', id);

    if (error) {
      console.error(error);
      alert("Failed to update status");
    } else {
      // Optimistic update for UI speed
      setOrders(orders.map(o => o.id === id ? { ...o, status: newStatus } : o));
    }
  };

  // --- HELPERS ---

  const uniqueProductNames = useMemo(() => [...new Set(inventory.map(i => i.name))], [inventory]);
  
  // Filter available jar types based on selected product name in production modal
  const availableJarTypes = useMemo(() => {
    if (!prodBatchData.productName) return [];
    return inventory
      .filter(i => i.name === prodBatchData.productName)
      .map(i => i.jarType);
  }, [inventory, prodBatchData.productName]);

  const openCustomerPanel = (customerName) => {
    const customerOrders = orders.filter(o => o.customer === customerName);
    const totalSpent = customerOrders.reduce((acc, curr) => acc + curr.total, 0);
    const lastOrder = customerOrders[0]; // Orders are sorted by date desc
    
    setSelectedCustomer({
      name: customerName,
      orders: customerOrders,
      totalSpent,
      lastOrder,
      phone: customerOrders[0]?.phone || 'N/A',
      location: customerOrders[0]?.location || 'N/A'
    });
  };

  // --- VIEWS ---

  if (loading) return <div className="flex h-screen items-center justify-center text-orange-600 font-bold bg-[#F8F7F4]">Loading Ooragai Dashboard...</div>;

  return (
    <div className="min-h-screen bg-[#F8F7F4] font-sans text-gray-900 flex">
      {/* SIDEBAR */}
      <aside className="w-64 bg-white border-r border-orange-100 fixed h-full z-20 flex flex-col">
        <div className="p-6 border-b border-orange-50">
          <div className="flex items-center gap-3">
             <div className="bg-orange-600 text-white p-2 rounded-lg"><Package className="w-6 h-6" /></div>
             <div><h1 className="font-bold text-lg leading-none">Ooragai</h1><span className="text-[10px] tracking-widest text-orange-600 font-semibold uppercase">Originals</span></div>
          </div>
        </div>
        <nav className="flex-1 p-4 overflow-y-auto">
          <NavItem icon={LayoutDashboard} label="Overview" active={activeTab === 'overview'} onClick={() => setActiveTab('overview')} />
          <NavItem icon={ShoppingCart} label="Orders" active={activeTab === 'orders'} onClick={() => setActiveTab('orders')} />
          <NavItem icon={Package} label="Inventory" active={activeTab === 'inventory'} onClick={() => setActiveTab('inventory')} />
          <NavItem icon={Settings} label="Admin" active={activeTab === 'settings'} onClick={() => setActiveTab('settings')} />
        </nav>
      </aside>

      {/* MAIN CONTENT */}
      <main className="flex-1 ml-64 p-8">
        <header className="flex justify-between items-center mb-8">
          <h1 className="text-2xl font-bold text-gray-900 capitalize">{activeTab}</h1>
          <button onClick={fetchData} className="flex items-center gap-2 px-4 py-2 bg-white border rounded-lg text-sm hover:bg-gray-50"><RefreshCw className="w-4 h-4" /> Sync</button>
        </header>

        {/* OVERVIEW TAB */}
        {activeTab === 'overview' && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-orange-600 rounded-xl p-6 text-white shadow-lg">
               <p className="text-orange-100 text-sm">Total Revenue</p>
               <h3 className="text-3xl font-bold mt-2">₹{orders.reduce((sum, o) => sum + (o.total || 0), 0).toLocaleString()}</h3>
            </div>
            <div onClick={() => setActiveTab('orders')} className="bg-white rounded-xl p-6 shadow-sm cursor-pointer hover:shadow-md transition-all">
               <div className="flex justify-between">
                 <p className="text-gray-500 text-sm">Active Orders</p>
                 <ShoppingCart className="w-5 h-5 text-orange-600" />
               </div>
               <h3 className="text-3xl font-bold mt-2">{orders.filter(o => o.status !== 'Delivered').length}</h3>
            </div>
            <div onClick={() => setActiveTab('inventory')} className="bg-white rounded-xl p-6 shadow-sm cursor-pointer hover:shadow-md transition-all">
               <div className="flex justify-between">
                 <p className="text-gray-500 text-sm">Low Stock Items</p>
                 <AlertTriangle className="w-5 h-5 text-red-600" />
               </div>
               <h3 className="text-3xl font-bold text-red-600 mt-2">{inventory.filter(i => i.stock < 10).length}</h3>
            </div>
          </div>
        )}

        {/* INVENTORY TAB */}
        {activeTab === 'inventory' && (
          <div className="space-y-6">
            <div className="flex justify-between items-center bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
              <h2 className="font-bold text-gray-800">Inventory Master</h2>
              <button onClick={() => setShowProductionModal(true)} className="bg-orange-600 text-white px-4 py-2 rounded-lg text-sm flex gap-2 items-center hover:bg-orange-700"><Plus className="w-4 h-4"/> Add Production</button>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
              <table className="w-full text-sm text-left">
                <thead className="bg-gray-50 text-gray-500 font-medium">
                  <tr><th className="px-6 py-4">Product</th><th className="px-6 py-4">Category</th><th className="px-6 py-4">Type</th><th className="px-6 py-4">Stock</th></tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {inventory.length === 0 ? (
                    <tr><td colSpan="4" className="px-6 py-8 text-center text-gray-500">No products found. Add one in Admin Settings.</td></tr>
                  ) : inventory.map(item => (
                    <tr key={item.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 font-medium text-gray-900">{item.name}</td>
                      <td className="px-6 py-4 text-gray-600">{item.category}</td>
                      <td className="px-6 py-4">
                        <span className="bg-orange-50 text-orange-800 text-xs px-2 py-1 rounded border border-orange-100">{item.jarType}</span>
                      </td>
                      <td className={`px-6 py-4 font-bold ${item.stock < 10 ? 'text-red-600' : 'text-gray-900'}`}>{item.stock} {item.unit}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ORDERS TAB */}
        {activeTab === 'orders' && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <table className="w-full text-sm text-left">
              <thead className="bg-gray-50 text-gray-500 font-medium">
                <tr>
                  <th className="px-6 py-4">ID</th>
                  <th className="px-6 py-4">Customer</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4 text-right">Total</th>
                  <th className="px-6 py-4 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {orders.length === 0 ? (
                    <tr><td colSpan="5" className="px-6 py-8 text-center text-gray-500">No orders yet. Waiting for Shopify/Amazon sync.</td></tr>
                  ) : orders.map(order => (
                  <tr key={order.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <div className="font-medium text-gray-900">{order.id}</div>
                      <div className="text-xs text-gray-400">{order.source}</div>
                      {order.edited && <span className="text-[10px] bg-orange-100 text-orange-800 px-1 rounded border border-orange-200">Edited</span>}
                    </td>
                    <td className="px-6 py-4 cursor-pointer hover:text-orange-600 group" onClick={() => openCustomerPanel(order.customer)}>
                      <div className="font-medium group-hover:underline">{order.customer}</div>
                      <div className="text-xs text-gray-400">{order.location}</div>
                    </td>
                    <td className="px-6 py-4">
                      <select value={order.status} onChange={(e) => updateOrderStatus(order.id, e.target.value)} className="bg-transparent border-none text-xs font-bold cursor-pointer outline-none">
                        <option>Pending</option><option>Processing</option><option>Shipped</option><option>Delivered</option>
                      </select>
                    </td>
                    <td className="px-6 py-4 text-right font-medium">₹{order.total}</td>
                    <td className="px-6 py-4 text-center">
                      <button onClick={() => setShowOrderEditModal(order)} className="p-1 hover:bg-gray-100 rounded"><Edit3 className="w-4 h-4 text-gray-400 hover:text-orange-600" /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* ADMIN TAB */}
        {activeTab === 'settings' && (
           <div className="space-y-6">
             <div className="p-6 bg-white rounded-xl border border-gray-200 shadow-sm">
               <h3 className="font-bold mb-4 text-lg">Product Management</h3>
               <p className="text-sm text-gray-500 mb-6">Add new items to your master inventory list. These will appear in production logs.</p>
               <button onClick={() => setShowAddProductModal(true)} className="bg-gray-900 text-white px-4 py-2 rounded-lg text-sm flex gap-2 items-center hover:bg-gray-800 shadow-lg"><Plus className="w-4 h-4"/> Add New Product to Master List</button>
             </div>
           </div>
        )}

      </main>

      {/* --- MODALS --- */}

      {/* 1. Add Product Modal (Multi-Select Fix) */}
      {showAddProductModal && (
        <div className="fixed inset-0 bg-gray-900/60 flex items-center justify-center p-4 z-50 backdrop-blur-sm">
          <div className="bg-white w-full max-w-md rounded-2xl p-6 shadow-xl">
            <h3 className="font-bold text-lg mb-4 text-gray-900">Add New Product</h3>
            <form onSubmit={handleAddProduct} className="space-y-4">
               <div>
                 <label className="text-sm font-medium mb-1 block">Product Name</label>
                 <input type="text" placeholder="e.g. Tomato Pickle" className="w-full border border-gray-300 p-2 rounded-lg" value={newProductData.name} onChange={e => setNewProductData({...newProductData, name: e.target.value})} required />
               </div>
               
               <div>
                 <label className="text-sm font-medium mb-2 block">Packaging Types</label>
                 <div className="space-y-2 bg-gray-50 p-3 rounded-lg border border-gray-200">
                   {['Glass', 'Plastic', 'Pouch'].map(type => (
                     <label key={type} className="flex items-center gap-2 text-sm cursor-pointer">
                       <input type="checkbox" className="accent-orange-600" checked={newProductData.jarTypes.includes(type)} onChange={(e) => {
                         const types = e.target.checked 
                           ? [...newProductData.jarTypes, type]
                           : newProductData.jarTypes.filter(t => t !== type);
                         setNewProductData({...newProductData, jarTypes: types});
                       }} />
                       {type}
                     </label>
                   ))}
                 </div>
               </div>

               <div className="flex gap-2">
                 <div className="flex-1">
                    <label className="text-sm font-medium mb-1 block">Category</label>
                    <select className="border border-gray-300 p-2 rounded-lg w-full" value={newProductData.category} onChange={e => setNewProductData({...newProductData, category: e.target.value})}>
                      {categories.map(c => <option key={c}>{c}</option>)}
                    </select>
                 </div>
                 <div className="w-1/3">
                    <label className="text-sm font-medium mb-1 block">Unit</label>
                    <input type="text" placeholder="e.g. Jars" className="border border-gray-300 p-2 rounded-lg w-full" value={newProductData.unit} onChange={e => setNewProductData({...newProductData, unit: e.target.value})} />
                 </div>
               </div>

               <div className="pt-2">
                  <button type="submit" className="w-full bg-gray-900 text-white py-2.5 rounded-lg font-medium hover:bg-gray-800">Save to Master List</button>
                  <button type="button" onClick={() => setShowAddProductModal(false)} className="w-full text-gray-500 text-sm mt-3 hover:text-gray-800">Cancel</button>
               </div>
            </form>
          </div>
        </div>
      )}

      {/* 2. Production Modal (Name -> Type Logic Fix) */}
      {showProductionModal && (
        <div className="fixed inset-0 bg-gray-900/60 flex items-center justify-center p-4 z-50 backdrop-blur-sm">
          <div className="bg-white w-full max-w-md rounded-2xl p-6 shadow-xl">
            <h3 className="font-bold text-lg mb-4 text-orange-600">Record Production</h3>
            <form onSubmit={handleProductionSubmit} className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-1 block">Product Name</label>
                <select className="w-full border border-gray-300 p-2 rounded-lg" value={prodBatchData.productName} onChange={e => setProdBatchData({...prodBatchData, productName: e.target.value, jarType: ''})} required>
                  <option value="">Select Product...</option>
                  {uniqueProductNames.map(name => <option key={name} value={name}>{name}</option>)}
                </select>
              </div>
              
              <div>
                <label className="text-sm font-medium mb-1 block">Packaging Type</label>
                <select className="w-full border border-gray-300 p-2 rounded-lg" value={prodBatchData.jarType} onChange={e => setProdBatchData({...prodBatchData, jarType: e.target.value})} required disabled={!prodBatchData.productName}>
                  <option value="">Select Packaging...</option>
                  {availableJarTypes.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>

              <div>
                <label className="text-sm font-medium mb-1 block">Quantity Produced</label>
                <input type="number" placeholder="0" className="w-full border border-gray-300 p-2 rounded-lg" value={prodBatchData.qty} onChange={e => setProdBatchData({...prodBatchData, qty: e.target.value})} required />
              </div>

              <div className="pt-2">
                 <button type="submit" className="w-full bg-orange-600 text-white py-2.5 rounded-lg font-medium hover:bg-orange-700">Update Stock</button>
                 <button type="button" onClick={() => setShowProductionModal(false)} className="w-full text-gray-500 text-sm mt-3 hover:text-gray-800">Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}
      
      {/* 3. Customer Slide-over */}
      {selectedCustomer && (
        <>
          <div className="fixed inset-0 bg-black/20 z-40 backdrop-blur-[1px]" onClick={() => setSelectedCustomer(null)}></div>
          <div className="fixed top-0 right-0 h-full w-80 bg-white z-50 shadow-2xl p-6 overflow-y-auto animate-in slide-in-from-right">
            <h2 className="font-bold text-xl text-gray-900">{selectedCustomer.name}</h2>
            <div className="text-sm text-gray-500 mb-4 flex flex-col gap-1 mt-1">
              <span className="flex items-center gap-2"><MapPin className="w-3 h-3"/> {selectedCustomer.location}</span>
              <span className="flex items-center gap-2"><Phone className="w-3 h-3"/> {selectedCustomer.phone}</span>
            </div>
            
            <div className="grid grid-cols-2 gap-2 mb-6">
              <div className="bg-gray-100 p-3 rounded-lg text-center">
                <div className="text-xs text-gray-500 uppercase font-bold">Total Spend</div>
                <div className="font-bold text-orange-600 text-lg">₹{selectedCustomer.totalSpent}</div>
              </div>
              <div className="bg-gray-100 p-3 rounded-lg text-center">
                <div className="text-xs text-gray-500 uppercase font-bold">Orders</div>
                <div className="font-bold text-gray-900 text-lg">{selectedCustomer.orders.length}</div>
              </div>
            </div>
            
            <h3 className="font-bold text-sm mb-3 text-gray-900">Order History</h3>
            <div className="space-y-2">
              {selectedCustomer.orders.map(o => (
                <div key={o.id} className="border border-gray-200 p-3 rounded-lg text-sm hover:bg-gray-50">
                  <div className="flex justify-between font-medium text-gray-900"><span>{o.id}</span><span>₹{o.total}</span></div>
                  <div className="text-xs text-gray-400 mt-1">{o.date} • <span className={o.status === 'Delivered' ? 'text-green-600' : 'text-orange-600'}>{o.status}</span></div>
                </div>
              ))}
            </div>
            <button onClick={() => setSelectedCustomer(null)} className="mt-6 w-full border border-gray-300 p-2 rounded-lg text-gray-600 hover:bg-gray-50">Close Panel</button>
          </div>
        </>
      )}

      {/* 4. Edit Order Override Modal */}
      {showOrderEditModal && (
        <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-xl overflow-hidden p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-4">Edit Order #{showOrderEditModal.id}</h3>
            <form onSubmit={handleOrderOverride} className="space-y-4">
              <div className="bg-yellow-50 p-3 rounded-lg border border-yellow-200 flex gap-3">
                 <AlertTriangle className="w-5 h-5 text-yellow-600 flex-shrink-0" />
                 <p className="text-xs text-yellow-800 leading-relaxed">
                   Overriding official data creates a local record visible only on this dashboard.
                 </p>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                 <div>
                   <label className="block text-xs font-medium text-gray-500 mb-1 uppercase">Original Total</label>
                   <div className="p-2.5 bg-gray-100 rounded-lg text-sm text-gray-500 font-mono">
                     ₹{showOrderEditModal.originalTotal || showOrderEditModal.total}
                   </div>
                 </div>
                 <div>
                   <label className="block text-xs font-medium text-gray-900 mb-1 uppercase">New Total (₹)</label>
                   <input 
                     name="overrideTotal"
                     type="number" 
                     className="w-full border border-gray-300 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-orange-500 outline-none font-bold text-gray-900"
                     defaultValue={showOrderEditModal.total}
                   />
                 </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Reason for Edit</label>
                <textarea 
                  name="notes"
                  className="w-full border border-gray-300 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-orange-500 outline-none h-24 resize-none"
                  placeholder="e.g. Discount applied offline..."
                  defaultValue={showOrderEditModal.notes}
                ></textarea>
              </div>

              <div className="pt-2 flex gap-3">
                <button type="submit" className="flex-1 py-2.5 bg-orange-600 text-white rounded-lg text-sm font-medium hover:bg-orange-700">Save Changes</button>
                <button type="button" onClick={() => setShowOrderEditModal(null)} className="flex-1 py-2.5 border border-gray-300 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-50">Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
