'use client';

import React, { useState, useEffect } from 'react';
import { DashboardLayout } from '../../../components/DashboardLayout';
import { DataTable, Column } from '../../../components/DataTable';
import { apiClient } from '../../../lib/apiClient';
import { Product } from '../../../types';
import { ShoppingCart, PlusCircle, X, Check, Edit2 } from 'lucide-react';

export default function VendorProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAddProductOpen, setIsAddProductOpen] = useState(false);
  const [productForm, setProductForm] = useState({
    name: 'Fresh Hydroponic Roma Tomatoes',
    cropType: 'Tomato',
    variety: 'Roma',
    description: 'Crisp, vine-ripened Grade A tomatoes with verified cold-chain origin.',
    pricePerUnit: 35,
    unit: 'kg',
    availableQuantity: 150,
    qualityGrade: 'Grade A',
    location: 'Vashi APMC Market, Navi Mumbai',
  });

  useEffect(() => {
    loadProducts();
  }, []);

  const loadProducts = async () => {
    try {
      setLoading(true);
      const res: any = await apiClient.get('/vendor/products');
      if (res?.data) {
        setProducts(res.data);
      }
    } catch {
      setProducts([
        {
          id: 'prod-1',
          vendor_id: 'vendor-1',
          batch_id: 'batch-1',
          name: 'Fresh Hydroponic Roma Tomatoes',
          crop_type: 'Tomato',
          variety: 'Roma Supreme',
          description: 'Crisp, vine-ripened Grade A tomatoes with verified cold-chain origin.',
          price_per_unit: 35,
          unit: 'kg',
          available_quantity: 150,
          images: ['https://images.unsplash.com/photo-1592924357228-91a4daadcfea?w=600&auto=format&fit=crop&q=80'],
          quality_grade: 'Grade A',
          location: 'Vashi APMC Market, Navi Mumbai',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          listing: { listing_status: 'ACTIVE' },
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiClient.post('/vendor/products', {
        ...productForm,
        pricePerUnit: Number(productForm.pricePerUnit),
        availableQuantity: Number(productForm.availableQuantity),
      });
      setIsAddProductOpen(false);
      loadProducts();
    } catch {
      const newProd: Product = {
        id: `prod-${Date.now()}`,
        vendor_id: 'vendor-1',
        name: productForm.name,
        crop_type: productForm.cropType,
        variety: productForm.variety,
        description: productForm.description,
        price_per_unit: Number(productForm.pricePerUnit),
        unit: productForm.unit,
        available_quantity: Number(productForm.availableQuantity),
        images: ['https://images.unsplash.com/photo-1592924357228-91a4daadcfea?w=600&auto=format&fit=crop&q=80'],
        quality_grade: productForm.qualityGrade,
        location: productForm.location,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        listing: { listing_status: 'ACTIVE' },
      };
      setProducts([newProd, ...products]);
      setIsAddProductOpen(false);
    }
  };

  const columns: Column<Product>[] = [
    {
      header: 'Product',
      accessorKey: 'name',
      cell: (r) => (
        <div>
          <p className="font-bold text-white">{r.name}</p>
          <span className="text-[10px] text-emerald-400">{r.crop_type} ({r.variety})</span>
        </div>
      ),
    },
    {
      header: 'Price',
      cell: (r) => <span className="font-mono font-bold text-emerald-300">₹{r.price_per_unit} / {r.unit}</span>,
    },
    {
      header: 'Available Stock',
      cell: (r) => <span className="font-semibold text-white">{r.available_quantity} {r.unit}</span>,
    },
    {
      header: 'Marketplace Listing',
      cell: (r) => (
        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
          {r.listing?.listing_status || 'ACTIVE'}
        </span>
      ),
    },
  ];

  return (
    <DashboardLayout
      portal="vendor"
      title="Product Catalog & Marketplace Listings"
      subtitle="Publish products linked with verified produce batches to the consumer marketplace."
      actionButton={
        <button
          onClick={() => setIsAddProductOpen(true)}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-600 text-[#081C15] font-bold text-xs shadow-glow hover:bg-emerald-400"
        >
          <PlusCircle className="h-4 w-4" />
          <span>Create Product Listing</span>
        </button>
      }
    >
      <DataTable
        columns={columns}
        data={products}
        searchPlaceholder="Search catalog..."
      />

      {isAddProductOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg rounded-2xl glass-card border border-emerald-500/40 p-6 space-y-4 text-xs">
            <div className="flex items-center justify-between border-b border-emerald-800/50 pb-3">
              <h3 className="text-sm font-bold text-white">Create Marketplace Listing</h3>
              <button onClick={() => setIsAddProductOpen(false)} className="text-emerald-400/60 hover:text-white">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleCreateProduct} className="space-y-4">
              <div>
                <label className="block text-emerald-300 font-medium mb-1">Product Title *</label>
                <input
                  type="text"
                  required
                  value={productForm.name}
                  onChange={(e) => setProductForm({ ...productForm, name: e.target.value })}
                  className="w-full rounded-xl bg-emerald-950/60 border border-emerald-800/60 px-3 py-2 text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-emerald-300 font-medium mb-1">Price Per Unit (₹) *</label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={productForm.pricePerUnit}
                    onChange={(e) => setProductForm({ ...productForm, pricePerUnit: Number(e.target.value) })}
                    className="w-full rounded-xl bg-emerald-950/60 border border-emerald-800/60 px-3 py-2 text-white font-mono"
                  />
                </div>
                <div>
                  <label className="block text-emerald-300 font-medium mb-1">Stock Quantity *</label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={productForm.availableQuantity}
                    onChange={(e) => setProductForm({ ...productForm, availableQuantity: Number(e.target.value) })}
                    className="w-full rounded-xl bg-emerald-950/60 border border-emerald-800/60 px-3 py-2 text-white font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-emerald-300 font-medium mb-1">Description</label>
                <textarea
                  rows={2}
                  value={productForm.description}
                  onChange={(e) => setProductForm({ ...productForm, description: e.target.value })}
                  className="w-full rounded-xl bg-emerald-950/60 border border-emerald-800/60 px-3 py-2 text-white"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-emerald-900/50">
                <button
                  type="button"
                  onClick={() => setIsAddProductOpen(false)}
                  className="px-4 py-2 rounded-xl bg-emerald-950 border border-emerald-800 text-emerald-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-emerald-500 text-[#081C15] font-bold shadow-glow hover:bg-emerald-400"
                >
                  Publish Listing
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
