-- ==============================================================================
-- AgriTrace Complete Database Schema, Functions, RLS Policies & Storage Setup
-- Project: AgriTrace (Decentralized Smart Agriculture & Traceability Platform)
-- Database: PostgreSQL / Supabase
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 0. ENABLE EXTENSIONS
-- ------------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ------------------------------------------------------------------------------
-- 1. CUSTOM ENUM TYPES
-- ------------------------------------------------------------------------------
DO $$ BEGIN
    CREATE TYPE user_role AS ENUM ('CUSTOMER', 'FARMER', 'VENDOR', 'BUYER', 'TRANSPORTER', 'ADMIN');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE crop_status AS ENUM ('PLANNING', 'GROWING', 'READY_FOR_HARVEST', 'HARVESTED', 'ARCHIVED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE batch_status AS ENUM ('HARVESTED', 'STORED', 'LISTED', 'SOLD', 'IN_TRANSIT', 'RECEIVED', 'DELIVERED', 'PROCESSED', 'COMPLETED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE order_status AS ENUM ('PLACED', 'CONFIRMED', 'PROCESSING', 'READY', 'SHIPPED', 'IN_TRANSIT', 'DELIVERED', 'CANCELLED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE bag_status AS ENUM ('ACTIVE', 'CONSUMED', 'DISCARDED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE listing_status AS ENUM ('DRAFT', 'ACTIVE', 'PAUSED', 'SOLD_OUT');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- ------------------------------------------------------------------------------
-- 2. DATABASE TABLES & INDEXES
-- ------------------------------------------------------------------------------

-- 2.1 Users Profile Table (Extends auth.users)
CREATE TABLE IF NOT EXISTS public.users (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT UNIQUE NOT NULL,
    full_name TEXT NOT NULL,
    phone TEXT,
    role user_role NOT NULL DEFAULT 'CUSTOMER',
    language_preference TEXT NOT NULL DEFAULT 'en',
    avatar_url TEXT,
    address TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2.2 Farms Table
CREATE TABLE IF NOT EXISTS public.farms (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    farmer_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    location_name TEXT NOT NULL,
    address TEXT,
    latitude DOUBLE PRECISION,
    longitude DOUBLE PRECISION,
    total_area NUMERIC(10, 2) NOT NULL,
    area_unit TEXT NOT NULL DEFAULT 'acre',
    soil_info TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_farms_farmer ON public.farms(farmer_id);

-- 2.3 Plots Table
CREATE TABLE IF NOT EXISTS public.plots (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    farm_id UUID NOT NULL REFERENCES public.farms(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    area NUMERIC(10, 2) NOT NULL,
    area_unit TEXT NOT NULL DEFAULT 'acre',
    soil_type TEXT,
    irrigation_source TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_plots_farm ON public.plots(farm_id);

-- 2.4 Crops Table
CREATE TABLE IF NOT EXISTS public.crops (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    farmer_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    farm_id UUID NOT NULL REFERENCES public.farms(id) ON DELETE CASCADE,
    plot_id UUID NOT NULL REFERENCES public.plots(id) ON DELETE CASCADE,
    crop_type TEXT NOT NULL,
    variety TEXT NOT NULL,
    area NUMERIC(10, 2) NOT NULL,
    area_unit TEXT NOT NULL DEFAULT 'acre',
    planting_date DATE NOT NULL,
    expected_harvest_date DATE,
    status crop_status NOT NULL DEFAULT 'GROWING',
    notes TEXT,
    image_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_crops_farmer ON public.crops(farmer_id);
CREATE INDEX IF NOT EXISTS idx_crops_plot ON public.crops(plot_id);
CREATE INDEX IF NOT EXISTS idx_crops_status ON public.crops(status);

-- 2.5 Fertilizer Applications
CREATE TABLE IF NOT EXISTS public.fertilizer_applications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    crop_id UUID NOT NULL REFERENCES public.crops(id) ON DELETE CASCADE,
    farmer_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    fertilizer_name TEXT NOT NULL,
    fertilizer_type TEXT NOT NULL,
    application_date DATE NOT NULL,
    quantity NUMERIC(10, 2) NOT NULL,
    unit TEXT NOT NULL DEFAULT 'kg',
    method TEXT NOT NULL DEFAULT 'SOIL',
    n_value NUMERIC(5, 2),
    p_value NUMERIC(5, 2),
    k_value NUMERIC(5, 2),
    cost NUMERIC(10, 2) DEFAULT 0,
    supplier TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_fertilizer_crop ON public.fertilizer_applications(crop_id);
CREATE INDEX IF NOT EXISTS idx_fertilizer_date ON public.fertilizer_applications(application_date);

-- 2.6 Irrigation Records
CREATE TABLE IF NOT EXISTS public.irrigation_records (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    crop_id UUID NOT NULL REFERENCES public.crops(id) ON DELETE CASCADE,
    farmer_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    method TEXT NOT NULL DEFAULT 'DRIP',
    duration_minutes INTEGER,
    water_quantity NUMERIC(10, 2),
    unit TEXT DEFAULT 'liters',
    source TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_irrigation_crop ON public.irrigation_records(crop_id);

-- 2.7 Crop Inputs
CREATE TABLE IF NOT EXISTS public.crop_inputs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    crop_id UUID NOT NULL REFERENCES public.crops(id) ON DELETE CASCADE,
    farmer_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    input_type TEXT NOT NULL,
    name TEXT NOT NULL,
    quantity NUMERIC(10, 2) NOT NULL,
    unit TEXT NOT NULL,
    application_date DATE NOT NULL,
    purpose TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_crop_inputs_crop ON public.crop_inputs(crop_id);

-- 2.8 Crop Observations
CREATE TABLE IF NOT EXISTS public.crop_observations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    crop_id UUID NOT NULL REFERENCES public.crops(id) ON DELETE CASCADE,
    farmer_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    observation_type TEXT NOT NULL,
    description TEXT NOT NULL,
    severity TEXT DEFAULT 'LOW',
    image_url TEXT,
    recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_observations_crop ON public.crop_observations(crop_id);

-- 2.9 Harvests Table
CREATE TABLE IF NOT EXISTS public.harvests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    crop_id UUID NOT NULL REFERENCES public.crops(id) ON DELETE CASCADE,
    farmer_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    harvest_date DATE NOT NULL,
    quantity NUMERIC(10, 2) NOT NULL,
    unit TEXT NOT NULL DEFAULT 'kg',
    quality_grade TEXT DEFAULT 'Grade A',
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_harvests_crop ON public.harvests(crop_id);

-- 2.10 Produce Batches Table
CREATE TABLE IF NOT EXISTS public.produce_batches (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    batch_code TEXT UNIQUE NOT NULL,
    farmer_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    farm_id UUID NOT NULL REFERENCES public.farms(id) ON DELETE CASCADE,
    plot_id UUID NOT NULL REFERENCES public.plots(id) ON DELETE CASCADE,
    crop_id UUID NOT NULL REFERENCES public.crops(id) ON DELETE CASCADE,
    harvest_id UUID NOT NULL REFERENCES public.harvests(id) ON DELETE CASCADE,
    crop_type TEXT NOT NULL,
    variety TEXT NOT NULL,
    harvest_date DATE NOT NULL,
    initial_quantity NUMERIC(10, 2) NOT NULL,
    current_quantity NUMERIC(10, 2) NOT NULL,
    unit TEXT NOT NULL DEFAULT 'kg',
    quality_grade TEXT DEFAULT 'Grade A',
    current_status batch_status NOT NULL DEFAULT 'HARVESTED',
    current_owner_id UUID NOT NULL REFERENCES public.users(id),
    current_location TEXT,
    qr_code_url TEXT,
    blockchain_hash TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_batches_code ON public.produce_batches(batch_code);
CREATE INDEX IF NOT EXISTS idx_batches_farmer ON public.produce_batches(farmer_id);
CREATE INDEX IF NOT EXISTS idx_batches_owner ON public.produce_batches(current_owner_id);

-- 2.11 Traceability Events Table (Append-only immutable ledger)
CREATE TABLE IF NOT EXISTS public.traceability_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    batch_id UUID NOT NULL REFERENCES public.produce_batches(id) ON DELETE CASCADE,
    event_type TEXT NOT NULL,
    actor_id UUID NOT NULL REFERENCES public.users(id),
    actor_role user_role NOT NULL,
    location TEXT NOT NULL,
    notes TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_trace_batch ON public.traceability_events(batch_id);
CREATE INDEX IF NOT EXISTS idx_trace_created ON public.traceability_events(created_at);

-- Trigger to block UPDATE or DELETE on traceability_events to guarantee immutability
CREATE OR REPLACE FUNCTION fn_prevent_traceability_mutation()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'Traceability events are immutable and cannot be updated or deleted.';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_prevent_traceability_update ON public.traceability_events;
CREATE TRIGGER trg_prevent_traceability_update
BEFORE UPDATE OR DELETE ON public.traceability_events
FOR EACH ROW EXECUTE FUNCTION fn_prevent_traceability_mutation();

-- 2.12 Vendor Procurement Table
CREATE TABLE IF NOT EXISTS public.vendor_procurement (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    vendor_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    batch_id UUID NOT NULL REFERENCES public.produce_batches(id) ON DELETE CASCADE,
    farmer_id UUID NOT NULL REFERENCES public.users(id),
    quantity NUMERIC(10, 2) NOT NULL,
    unit TEXT NOT NULL DEFAULT 'kg',
    purchase_price NUMERIC(10, 2) NOT NULL,
    purchase_date DATE NOT NULL,
    quality_grade TEXT DEFAULT 'Grade A',
    transport_details TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_procurement_vendor ON public.vendor_procurement(vendor_id);

-- 2.13 Vendor Inventory Table
CREATE TABLE IF NOT EXISTS public.vendor_inventory (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    vendor_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    batch_id UUID NOT NULL REFERENCES public.produce_batches(id) ON DELETE CASCADE,
    product_name TEXT NOT NULL,
    crop_type TEXT NOT NULL,
    quantity NUMERIC(10, 2) NOT NULL,
    unit TEXT NOT NULL DEFAULT 'kg',
    location TEXT,
    status TEXT NOT NULL DEFAULT 'IN_STOCK',
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_inventory_vendor ON public.vendor_inventory(vendor_id);

-- 2.14 Inventory Adjustments Table
CREATE TABLE IF NOT EXISTS public.inventory_adjustments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    inventory_id UUID NOT NULL REFERENCES public.vendor_inventory(id) ON DELETE CASCADE,
    vendor_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    adjustment_type TEXT NOT NULL,
    quantity_change NUMERIC(10, 2) NOT NULL,
    reason TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2.15 Products & Marketplace Listings
CREATE TABLE IF NOT EXISTS public.products (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    vendor_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    batch_id UUID REFERENCES public.produce_batches(id),
    name TEXT NOT NULL,
    crop_type TEXT NOT NULL,
    variety TEXT,
    description TEXT,
    price_per_unit NUMERIC(10, 2) NOT NULL,
    unit TEXT NOT NULL DEFAULT 'kg',
    available_quantity NUMERIC(10, 2) NOT NULL,
    images TEXT[] DEFAULT ARRAY[]::TEXT[],
    quality_grade TEXT DEFAULT 'Grade A',
    location TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_products_vendor ON public.products(vendor_id);
CREATE INDEX IF NOT EXISTS idx_products_crop ON public.products(crop_type);

CREATE TABLE IF NOT EXISTS public.marketplace_listings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
    vendor_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    listing_status listing_status NOT NULL DEFAULT 'ACTIVE',
    min_order_quantity NUMERIC(10, 2) DEFAULT 1,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_listings_status ON public.marketplace_listings(listing_status);

-- 2.16 Carts and Cart Items
CREATE TABLE IF NOT EXISTS public.carts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    customer_id UUID UNIQUE NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.cart_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    cart_id UUID NOT NULL REFERENCES public.carts(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
    quantity NUMERIC(10, 2) NOT NULL,
    unit_price_snapshot NUMERIC(10, 2) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(cart_id, product_id)
);
CREATE INDEX IF NOT EXISTS idx_cart_items_cart ON public.cart_items(cart_id);

-- 2.17 Orders and Order Items
CREATE TABLE IF NOT EXISTS public.orders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_code TEXT UNIQUE NOT NULL,
    customer_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    vendor_id UUID NOT NULL REFERENCES public.users(id),
    status order_status NOT NULL DEFAULT 'PLACED',
    subtotal NUMERIC(10, 2) NOT NULL,
    delivery_fee NUMERIC(10, 2) NOT NULL DEFAULT 0,
    total_amount NUMERIC(10, 2) NOT NULL,
    delivery_address TEXT NOT NULL,
    contact_phone TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_orders_customer ON public.orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_orders_vendor ON public.orders(vendor_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON public.orders(status);

CREATE TABLE IF NOT EXISTS public.order_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES public.products(id),
    batch_id UUID REFERENCES public.produce_batches(id),
    product_name_snapshot TEXT NOT NULL,
    unit_price NUMERIC(10, 2) NOT NULL,
    quantity NUMERIC(10, 2) NOT NULL,
    subtotal NUMERIC(10, 2) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_order_items_order ON public.order_items(order_id);

-- 2.18 Customer Favorites
CREATE TABLE IF NOT EXISTS public.favorites (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    customer_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(customer_id, product_id)
);

-- 2.19 Freshness Bags & Scans
CREATE TABLE IF NOT EXISTS public.freshness_bags (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    customer_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    produce_name TEXT NOT NULL,
    crop_type TEXT NOT NULL,
    current_status bag_status NOT NULL DEFAULT 'ACTIVE',
    storage_recommendation TEXT,
    latest_scan_id UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_bag_customer ON public.freshness_bags(customer_id);

CREATE TABLE IF NOT EXISTS public.freshness_scans (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    bag_id UUID NOT NULL REFERENCES public.freshness_bags(id) ON DELETE CASCADE,
    customer_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    image_url TEXT NOT NULL,
    scan_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    freshness_score NUMERIC(5, 2) NOT NULL,
    remaining_shelf_life_days INTEGER NOT NULL,
    predicted_use_by_date DATE NOT NULL,
    prediction_interval_lower_days INTEGER NOT NULL,
    prediction_interval_upper_days INTEGER NOT NULL,
    model_name TEXT NOT NULL DEFAULT 'agritrace-multimodal-shelf-v1',
    model_version TEXT NOT NULL DEFAULT '1.0.0',
    prediction_timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_scans_bag ON public.freshness_scans(bag_id);

ALTER TABLE public.freshness_bags
ADD CONSTRAINT fk_bag_latest_scan
FOREIGN KEY (latest_scan_id)
REFERENCES public.freshness_scans(id)
ON DELETE SET NULL;

-- 2.20 Weather Observations & Cache
CREATE TABLE IF NOT EXISTS public.weather_observations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    farm_id UUID REFERENCES public.farms(id) ON DELETE SET NULL,
    location_key TEXT NOT NULL,
    latitude DOUBLE PRECISION NOT NULL,
    longitude DOUBLE PRECISION NOT NULL,
    observation_time TIMESTAMPTZ NOT NULL,
    temperature NUMERIC(5, 2) NOT NULL,
    humidity NUMERIC(5, 2) NOT NULL,
    rainfall_mm NUMERIC(6, 2) DEFAULT 0,
    wind_speed_kmh NUMERIC(5, 2) DEFAULT 0,
    weather_condition TEXT NOT NULL,
    raw_data JSONB DEFAULT '{}'::jsonb,
    is_forecast BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_weather_location ON public.weather_observations(location_key, observation_time);

CREATE TABLE IF NOT EXISTS public.weather_cache (
    location_key TEXT PRIMARY KEY,
    latitude DOUBLE PRECISION NOT NULL,
    longitude DOUBLE PRECISION NOT NULL,
    current_data JSONB NOT NULL,
    forecast_data JSONB NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2.21 Notifications Table
CREATE TABLE IF NOT EXISTS public.notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    type TEXT NOT NULL,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    severity TEXT NOT NULL DEFAULT 'INFO',
    read BOOLEAN NOT NULL DEFAULT FALSE,
    scheduled_for TIMESTAMPTZ DEFAULT NOW(),
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON public.notifications(user_id, read);

-- 2.22 AI Predictions & Provenance Ledger
CREATE TABLE IF NOT EXISTS public.ai_predictions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    task_type TEXT NOT NULL,
    model_name TEXT NOT NULL,
    model_version TEXT NOT NULL,
    input_reference TEXT NOT NULL,
    prediction JSONB NOT NULL,
    uncertainty JSONB NOT NULL,
    dataset_source TEXT,
    dataset_version TEXT,
    weather_data_source TEXT,
    feature_version TEXT,
    prediction_timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_ai_task ON public.ai_predictions(task_type, created_at);

-- 2.23 Audit Logs Table
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
    role user_role,
    action TEXT NOT NULL,
    resource_type TEXT NOT NULL,
    resource_id TEXT,
    ip_address TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_audit_user ON public.audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_created ON public.audit_logs(created_at);

-- ------------------------------------------------------------------------------
-- 3. ROW LEVEL SECURITY (RLS) POLICIES
-- ------------------------------------------------------------------------------
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.farms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.plots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crops ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fertilizer_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.irrigation_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crop_inputs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crop_observations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.harvests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.produce_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.traceability_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vendor_procurement ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vendor_inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketplace_listings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.carts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cart_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.favorites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.freshness_bags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.freshness_scans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.weather_observations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.weather_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_predictions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Clean existing policies to ensure idempotence
DO $$ BEGIN
    -- Users
    DROP POLICY IF EXISTS "Users can view own profile" ON public.users;
    DROP POLICY IF EXISTS "Users can update own profile" ON public.users;
    DROP POLICY IF EXISTS "Users can insert own profile" ON public.users;
    DROP POLICY IF EXISTS "Public profiles can be viewed for vendor/farmer display" ON public.users;
    
    -- Farms & Plots
    DROP POLICY IF EXISTS "Farmers can manage own farms" ON public.farms;
    DROP POLICY IF EXISTS "Farmers can manage own plots" ON public.plots;
    
    -- Crops & Field Logs
    DROP POLICY IF EXISTS "Farmers can manage own crops" ON public.crops;
    DROP POLICY IF EXISTS "Farmers can manage own fertilizer logs" ON public.fertilizer_applications;
    DROP POLICY IF EXISTS "Farmers can manage own irrigation" ON public.irrigation_records;
    DROP POLICY IF EXISTS "Farmers can manage own crop inputs" ON public.crop_inputs;
    DROP POLICY IF EXISTS "Farmers can manage own crop observations" ON public.crop_observations;
    DROP POLICY IF EXISTS "Farmers can manage own harvests" ON public.harvests;
    
    -- Batches & Traceability
    DROP POLICY IF EXISTS "Farmers can manage own batches" ON public.produce_batches;
    DROP POLICY IF EXISTS "Anyone can view batches for public traceability" ON public.produce_batches;
    DROP POLICY IF EXISTS "Public read for traceability events" ON public.traceability_events;
    DROP POLICY IF EXISTS "Authenticated users can insert traceability events" ON public.traceability_events;
    
    -- Vendor
    DROP POLICY IF EXISTS "Vendors can manage own procurement" ON public.vendor_procurement;
    DROP POLICY IF EXISTS "Vendors can manage own inventory" ON public.vendor_inventory;
    
    -- Marketplace
    DROP POLICY IF EXISTS "Public can view products" ON public.products;
    DROP POLICY IF EXISTS "Vendors manage own products" ON public.products;
    DROP POLICY IF EXISTS "Public can view active marketplace listings" ON public.marketplace_listings;
    DROP POLICY IF EXISTS "Vendors manage own listings" ON public.marketplace_listings;
    
    -- Cart & Orders
    DROP POLICY IF EXISTS "Customers manage own cart" ON public.carts;
    DROP POLICY IF EXISTS "Customers manage own cart items" ON public.cart_items;
    DROP POLICY IF EXISTS "Customers view own orders" ON public.orders;
    DROP POLICY IF EXISTS "Vendors view assigned orders" ON public.orders;
    DROP POLICY IF EXISTS "Vendors can update assigned order status" ON public.orders;
    DROP POLICY IF EXISTS "Customers create orders" ON public.orders;
    DROP POLICY IF EXISTS "Order items viewable by customer and vendor" ON public.order_items;
    
    -- Favorites & Freshness
    DROP POLICY IF EXISTS "Customers manage own favorites" ON public.favorites;
    DROP POLICY IF EXISTS "Customers manage own freshness bags" ON public.freshness_bags;
    DROP POLICY IF EXISTS "Customers manage own freshness scans" ON public.freshness_scans;
    DROP POLICY IF EXISTS "Users view own notifications" ON public.notifications;
    DROP POLICY IF EXISTS "Users update own notifications" ON public.notifications;
    
    -- Weather & AI
    DROP POLICY IF EXISTS "Allow read weather cache" ON public.weather_cache;
    DROP POLICY IF EXISTS "Allow read weather observations" ON public.weather_observations;
    DROP POLICY IF EXISTS "Allow read AI predictions" ON public.ai_predictions;
EXCEPTION
    WHEN OTHERS THEN null;
END $$;

-- Define Policies
CREATE POLICY "Users can view own profile" ON public.users FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON public.users FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users can insert own profile" ON public.users FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "Public profiles can be viewed for vendor/farmer display" ON public.users FOR SELECT USING (role IN ('FARMER', 'VENDOR'));

CREATE POLICY "Farmers can manage own farms" ON public.farms FOR ALL USING (auth.uid() = farmer_id);
CREATE POLICY "Farmers can manage own plots" ON public.plots FOR ALL USING (
    EXISTS (SELECT 1 FROM public.farms WHERE farms.id = plots.farm_id AND farms.farmer_id = auth.uid())
);

CREATE POLICY "Farmers can manage own crops" ON public.crops FOR ALL USING (auth.uid() = farmer_id);
CREATE POLICY "Farmers can manage own fertilizer logs" ON public.fertilizer_applications FOR ALL USING (auth.uid() = farmer_id);
CREATE POLICY "Farmers can manage own irrigation" ON public.irrigation_records FOR ALL USING (auth.uid() = farmer_id);
CREATE POLICY "Farmers can manage own crop inputs" ON public.crop_inputs FOR ALL USING (auth.uid() = farmer_id);
CREATE POLICY "Farmers can manage own crop observations" ON public.crop_observations FOR ALL USING (auth.uid() = farmer_id);
CREATE POLICY "Farmers can manage own harvests" ON public.harvests FOR ALL USING (auth.uid() = farmer_id);

CREATE POLICY "Farmers can manage own batches" ON public.produce_batches FOR ALL USING (auth.uid() = farmer_id OR auth.uid() = current_owner_id);
CREATE POLICY "Anyone can view batches for public traceability" ON public.produce_batches FOR SELECT USING (true);

CREATE POLICY "Public read for traceability events" ON public.traceability_events FOR SELECT USING (true);
CREATE POLICY "Authenticated users can insert traceability events" ON public.traceability_events FOR INSERT WITH CHECK (auth.uid() = actor_id);

CREATE POLICY "Vendors can manage own procurement" ON public.vendor_procurement FOR ALL USING (auth.uid() = vendor_id);
CREATE POLICY "Vendors can manage own inventory" ON public.vendor_inventory FOR ALL USING (auth.uid() = vendor_id);

CREATE POLICY "Public can view products" ON public.products FOR SELECT USING (true);
CREATE POLICY "Vendors manage own products" ON public.products FOR ALL USING (auth.uid() = vendor_id);
CREATE POLICY "Public can view active marketplace listings" ON public.marketplace_listings FOR SELECT USING (listing_status = 'ACTIVE');
CREATE POLICY "Vendors manage own listings" ON public.marketplace_listings FOR ALL USING (auth.uid() = vendor_id);

CREATE POLICY "Customers manage own cart" ON public.carts FOR ALL USING (auth.uid() = customer_id);
CREATE POLICY "Customers manage own cart items" ON public.cart_items FOR ALL USING (
    EXISTS (SELECT 1 FROM public.carts WHERE carts.id = cart_items.cart_id AND carts.customer_id = auth.uid())
);

CREATE POLICY "Customers view own orders" ON public.orders FOR SELECT USING (auth.uid() = customer_id);
CREATE POLICY "Vendors view assigned orders" ON public.orders FOR SELECT USING (auth.uid() = vendor_id);
CREATE POLICY "Vendors can update assigned order status" ON public.orders FOR UPDATE USING (auth.uid() = vendor_id);
CREATE POLICY "Customers create orders" ON public.orders FOR INSERT WITH CHECK (auth.uid() = customer_id);

CREATE POLICY "Order items viewable by customer and vendor" ON public.order_items FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.orders WHERE orders.id = order_items.order_id AND (orders.customer_id = auth.uid() OR orders.vendor_id = auth.uid()))
);

CREATE POLICY "Customers manage own favorites" ON public.favorites FOR ALL USING (auth.uid() = customer_id);
CREATE POLICY "Customers manage own freshness bags" ON public.freshness_bags FOR ALL USING (auth.uid() = customer_id);
CREATE POLICY "Customers manage own freshness scans" ON public.freshness_scans FOR ALL USING (auth.uid() = customer_id);

CREATE POLICY "Users view own notifications" ON public.notifications FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users update own notifications" ON public.notifications FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Allow read weather cache" ON public.weather_cache FOR SELECT USING (true);
CREATE POLICY "Allow read weather observations" ON public.weather_observations FOR SELECT USING (true);
CREATE POLICY "Allow read AI predictions" ON public.ai_predictions FOR SELECT USING (true);

-- ------------------------------------------------------------------------------
-- 4. ATOMIC TRANSACTION RPC FUNCTIONS
-- ------------------------------------------------------------------------------

-- 4.1 Harvest & Produce Batch Minting
CREATE OR REPLACE FUNCTION public.fn_create_harvest_and_batch(
    p_crop_id UUID,
    p_farmer_id UUID,
    p_harvest_date DATE,
    p_quantity NUMERIC,
    p_unit TEXT,
    p_quality_grade TEXT,
    p_notes TEXT,
    p_batch_code TEXT,
    p_location TEXT
)
RETURNS JSONB AS $$
DECLARE
    v_crop RECORD;
    v_harvest_id UUID;
    v_batch_id UUID;
    v_event_id UUID;
BEGIN
    SELECT * INTO v_crop FROM public.crops WHERE id = p_crop_id AND farmer_id = p_farmer_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Crop not found or unauthorized for farmer %', p_farmer_id;
    END IF;

    INSERT INTO public.harvests (
        crop_id, farmer_id, harvest_date, quantity, unit, quality_grade, notes
    ) VALUES (
        p_crop_id, p_farmer_id, p_harvest_date, p_quantity, p_unit, p_quality_grade, p_notes
    ) RETURNING id INTO v_harvest_id;

    INSERT INTO public.produce_batches (
        batch_code, farmer_id, farm_id, plot_id, crop_id, harvest_id,
        crop_type, variety, harvest_date, initial_quantity, current_quantity,
        unit, quality_grade, current_status, current_owner_id, current_location
    ) VALUES (
        p_batch_code, p_farmer_id, v_crop.farm_id, v_crop.plot_id, p_crop_id, v_harvest_id,
        v_crop.crop_type, v_crop.variety, p_harvest_date, p_quantity, p_quantity,
        p_unit, p_quality_grade, 'HARVESTED', p_farmer_id, p_location
    ) RETURNING id INTO v_batch_id;

    INSERT INTO public.traceability_events (
        batch_id, event_type, actor_id, actor_role, location, notes, metadata
    ) VALUES (
        v_batch_id, 'HARVESTED', p_farmer_id, 'FARMER', p_location,
        'Harvest completed and produce batch minted.',
        jsonb_build_object(
            'quantity', p_quantity,
            'unit', p_unit,
            'quality_grade', p_quality_grade,
            'harvest_id', v_harvest_id
        )
    ) RETURNING id INTO v_event_id;

    RETURN jsonb_build_object(
        'harvest_id', v_harvest_id,
        'batch_id', v_batch_id,
        'batch_code', p_batch_code,
        'event_id', v_event_id,
        'status', 'HARVESTED'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4.2 Vendor Procurement
CREATE OR REPLACE FUNCTION public.fn_vendor_procure_batch(
    p_vendor_id UUID,
    p_batch_id UUID,
    p_quantity NUMERIC,
    p_purchase_price NUMERIC,
    p_purchase_date DATE,
    p_transport_details TEXT,
    p_location TEXT,
    p_notes TEXT
)
RETURNS JSONB AS $$
DECLARE
    v_batch RECORD;
    v_procurement_id UUID;
    v_inventory_id UUID;
    v_event_id UUID;
BEGIN
    SELECT * INTO v_batch FROM public.produce_batches WHERE id = p_batch_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Produce batch not found: %', p_batch_id;
    END IF;

    IF v_batch.current_quantity < p_quantity THEN
        RAISE EXCEPTION 'Insufficient batch quantity. Available: %, Requested: %', v_batch.current_quantity, p_quantity;
    END IF;

    INSERT INTO public.vendor_procurement (
        vendor_id, batch_id, farmer_id, quantity, unit, purchase_price,
        purchase_date, quality_grade, transport_details, notes
    ) VALUES (
        p_vendor_id, p_batch_id, v_batch.farmer_id, p_quantity, v_batch.unit,
        p_purchase_price, p_purchase_date, v_batch.quality_grade, p_transport_details, p_notes
    ) RETURNING id INTO v_procurement_id;

    UPDATE public.produce_batches
    SET current_quantity = current_quantity - p_quantity,
        current_owner_id = p_vendor_id,
        current_status = CASE WHEN (current_quantity - p_quantity) = 0 THEN 'SOLD'::batch_status ELSE 'RECEIVED'::batch_status END,
        current_location = p_location,
        updated_at = NOW()
    WHERE id = p_batch_id;

    INSERT INTO public.vendor_inventory (
        vendor_id, batch_id, product_name, crop_type, quantity, unit, location, status, notes
    ) VALUES (
        p_vendor_id, p_batch_id, v_batch.crop_type || ' (' || v_batch.variety || ')',
        v_batch.crop_type, p_quantity, v_batch.unit, p_location, 'IN_STOCK', p_notes
    ) RETURNING id INTO v_inventory_id;

    INSERT INTO public.traceability_events (
        batch_id, event_type, actor_id, actor_role, location, notes, metadata
    ) VALUES (
        p_batch_id, 'RECEIVED', p_vendor_id, 'VENDOR', p_location,
        'Produce batch procured and transferred to vendor inventory.',
        jsonb_build_object(
            'procured_quantity', p_quantity,
            'unit', v_batch.unit,
            'purchase_price', p_purchase_price,
            'procurement_id', v_procurement_id,
            'transport_details', p_transport_details
        )
    ) RETURNING id INTO v_event_id;

    RETURN jsonb_build_object(
        'procurement_id', v_procurement_id,
        'inventory_id', v_inventory_id,
        'batch_id', p_batch_id,
        'remaining_batch_quantity', (v_batch.current_quantity - p_quantity),
        'event_id', v_event_id
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4.3 Process Cart Checkout
CREATE OR REPLACE FUNCTION public.fn_process_checkout(
    p_customer_id UUID,
    p_order_code TEXT,
    p_vendor_id UUID,
    p_delivery_address TEXT,
    p_contact_phone TEXT,
    p_notes TEXT,
    p_delivery_fee NUMERIC
)
RETURNS JSONB AS $$
DECLARE
    v_cart RECORD;
    v_item RECORD;
    v_product RECORD;
    v_subtotal NUMERIC(10, 2) := 0;
    v_total NUMERIC(10, 2) := 0;
    v_order_id UUID;
    v_item_count INTEGER := 0;
BEGIN
    SELECT * INTO v_cart FROM public.carts WHERE customer_id = p_customer_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Cart not found for customer %', p_customer_id;
    END IF;

    FOR v_item IN 
        SELECT ci.*, p.name as product_name, p.available_quantity, p.price_per_unit, p.batch_id
        FROM public.cart_items ci
        JOIN public.products p ON p.id = ci.product_id
        WHERE ci.cart_id = v_cart.id
        FOR UPDATE OF p
    LOOP
        IF v_item.available_quantity < v_item.quantity THEN
            RAISE EXCEPTION 'Insufficient stock for product "%". Available: %, Requested: %',
                v_item.product_name, v_item.available_quantity, v_item.quantity;
        END IF;

        v_subtotal := v_subtotal + (v_item.unit_price_snapshot * v_item.quantity);
        v_item_count := v_item_count + 1;
    END LOOP;

    IF v_item_count = 0 THEN
        RAISE EXCEPTION 'Cart is empty. Cannot checkout.';
    END IF;

    v_total := v_subtotal + COALESCE(p_delivery_fee, 0);

    INSERT INTO public.orders (
        order_code, customer_id, vendor_id, status, subtotal,
        delivery_fee, total_amount, delivery_address, contact_phone, notes
    ) VALUES (
        p_order_code, p_customer_id, p_vendor_id, 'PLACED', v_subtotal,
        COALESCE(p_delivery_fee, 0), v_total, p_delivery_address, p_contact_phone, p_notes
    ) RETURNING id INTO v_order_id;

    FOR v_item IN 
        SELECT ci.*, p.name as product_name, p.batch_id
        FROM public.cart_items ci
        JOIN public.products p ON p.id = ci.product_id
        WHERE ci.cart_id = v_cart.id
    LOOP
        INSERT INTO public.order_items (
            order_id, product_id, batch_id, product_name_snapshot,
            unit_price, quantity, subtotal
        ) VALUES (
            v_order_id, v_item.product_id, v_item.batch_id, v_item.product_name,
            v_item.unit_price_snapshot, v_item.quantity, (v_item.unit_price_snapshot * v_item.quantity)
        );

        UPDATE public.products
        SET available_quantity = available_quantity - v_item.quantity,
            updated_at = NOW()
        WHERE id = v_item.product_id;

        IF v_item.batch_id IS NOT NULL THEN
            INSERT INTO public.traceability_events (
                batch_id, event_type, actor_id, actor_role, location, notes, metadata
            ) VALUES (
                v_item.batch_id, 'SOLD', p_customer_id, 'CUSTOMER', p_delivery_address,
                'Produce purchased in order ' || p_order_code,
                jsonb_build_object(
                    'order_id', v_order_id,
                    'order_code', p_order_code,
                    'quantity', v_item.quantity
                )
            );
        END IF;
    END LOOP;

    DELETE FROM public.cart_items WHERE cart_id = v_cart.id;

    RETURN jsonb_build_object(
        'order_id', v_order_id,
        'order_code', p_order_code,
        'subtotal', v_subtotal,
        'delivery_fee', p_delivery_fee,
        'total_amount', v_total,
        'status', 'PLACED'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4.4 Freshness Bag Re-Scan Record
CREATE OR REPLACE FUNCTION public.fn_rescan_freshness_bag(
    p_bag_id UUID,
    p_customer_id UUID,
    p_image_url TEXT,
    p_freshness_score NUMERIC,
    p_remaining_shelf_life_days INTEGER,
    p_predicted_use_by_date DATE,
    p_lower_interval_days INTEGER,
    p_upper_interval_days INTEGER,
    p_model_name TEXT,
    p_model_version TEXT,
    p_storage_recommendation TEXT,
    p_metadata JSONB
)
RETURNS JSONB AS $$
DECLARE
    v_scan_id UUID;
BEGIN
    INSERT INTO public.freshness_scans (
        bag_id, customer_id, image_url, scan_date, freshness_score,
        remaining_shelf_life_days, predicted_use_by_date,
        prediction_interval_lower_days, prediction_interval_upper_days,
        model_name, model_version, prediction_timestamp, metadata
    ) VALUES (
        p_bag_id, p_customer_id, p_image_url, NOW(), p_freshness_score,
        p_remaining_shelf_life_days, p_predicted_use_by_date,
        p_lower_interval_days, p_upper_interval_days,
        p_model_name, p_model_version, NOW(), COALESCE(p_metadata, '{}'::jsonb)
    ) RETURNING id INTO v_scan_id;

    UPDATE public.freshness_bags
    SET latest_scan_id = v_scan_id,
        storage_recommendation = COALESCE(p_storage_recommendation, storage_recommendation),
        updated_at = NOW()
    WHERE id = p_bag_id AND customer_id = p_customer_id;

    RETURN jsonb_build_object(
        'bag_id', p_bag_id,
        'scan_id', v_scan_id,
        'freshness_score', p_freshness_score,
        'remaining_shelf_life_days', p_remaining_shelf_life_days,
        'predicted_use_by_date', p_predicted_use_by_date,
        'prediction_interval_lower_days', p_lower_interval_days,
        'prediction_interval_upper_days', p_upper_interval_days,
        'model_name', p_model_name,
        'model_version', p_model_version
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ------------------------------------------------------------------------------
-- 5. STORAGE BUCKET INITIALIZATION (Public Buckets)
-- ------------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public)
VALUES 
    ('crop-observations', 'crop-observations', true),
    ('freshness-scans', 'freshness-scans', true),
    ('produce-images', 'produce-images', true),
    ('user-profiles', 'user-profiles', true),
    ('batch-labels', 'batch-labels', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Storage RLS: Public read access
DO $$ BEGIN
    DROP POLICY IF EXISTS "Public Storage Read" ON storage.objects;
    DROP POLICY IF EXISTS "Authenticated Upload" ON storage.objects;
EXCEPTION
    WHEN OTHERS THEN null;
END $$;

CREATE POLICY "Public Storage Read" ON storage.objects FOR SELECT USING (bucket_id IN ('crop-observations', 'freshness-scans', 'produce-images', 'user-profiles', 'batch-labels'));
CREATE POLICY "Authenticated Upload" ON storage.objects FOR INSERT WITH CHECK (auth.role() = 'authenticated');
