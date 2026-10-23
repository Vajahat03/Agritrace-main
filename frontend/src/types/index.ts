export type UserRole = 'CUSTOMER' | 'FARMER' | 'VENDOR' | 'BUYER' | 'TRANSPORTER' | 'ADMIN';
export type CropStatus = 'PLANNING' | 'GROWING' | 'READY_FOR_HARVEST' | 'HARVESTED' | 'ARCHIVED';
export type BatchStatus = 'HARVESTED' | 'STORED' | 'LISTED' | 'SOLD' | 'IN_TRANSIT' | 'RECEIVED' | 'DELIVERED' | 'PROCESSED' | 'COMPLETED';
export type OrderStatus = 'PLACED' | 'CONFIRMED' | 'PROCESSING' | 'READY' | 'SHIPPED' | 'IN_TRANSIT' | 'DELIVERED' | 'CANCELLED';
export type BagStatus = 'ACTIVE' | 'CONSUMED' | 'DISCARDED';
export type ListingStatus = 'DRAFT' | 'ACTIVE' | 'PAUSED' | 'SOLD_OUT';
export type Language = 'en' | 'hi' | 'mr' | 'ta' | 'hinglish';

export interface UserProfile {
  id: string;
  email: string;
  full_name: string;
  phone?: string;
  role: UserRole;
  language_preference: Language;
  avatar_url?: string;
  address?: string;
  onboarding_completed?: boolean;
}


export interface Farm {
  id: string;
  farmer_id: string;
  name: string;
  location_name: string;
  address?: string;
  latitude?: number;
  longitude?: number;
  total_area: number;
  area_unit: string;
  soil_info?: string;
  notes?: string;
  created_at: string;
  updated_at?: string;
}

export interface Plot {
  id: string;
  farm_id: string;
  name: string;
  area: number;
  area_unit: string;
  soil_type?: string;
  irrigation_source?: string;
  notes?: string;
  created_at?: string;
  updated_at?: string;
}

export interface Crop {
  id: string;
  farmer_id: string;
  farm_id: string;
  plot_id: string;
  crop_type: string;
  variety: string;
  area: number;
  area_unit: string;
  planting_date: string;
  expected_harvest_date?: string;
  plantingDate?: string;
  expectedHarvestDate?: string;
  status: CropStatus;
  notes?: string;
  image_url?: string;
  created_at: string;
  updated_at?: string;
  farm?: {
    id?: string;
    name: string;
    location_name: string;
  };
  plot?: {
    id?: string;
    name: string;
    area?: number;
    soil_type?: string;
  };
}

export interface FertilizerApplication {
  id: string;
  crop_id: string;
  farmer_id: string;
  fertilizer_name: string;
  fertilizer_type: string;
  application_date: string;
  quantity: number;
  unit: string;
  method: string;
  n_value?: number;
  p_value?: number;
  k_value?: number;
  cost?: number;
  supplier?: string;
  notes?: string;
  crop_name?: string;
  created_at: string;
  updated_at?: string;
}

export interface IrrigationRecord {
  id: string;
  crop_id: string;
  farmer_id: string;
  date: string;
  method: string;
  duration_minutes?: number;
  water_quantity?: number;
  unit?: string;
  source?: string;
  notes?: string;
  created_at: string;
}

export interface CropInput {
  id: string;
  crop_id: string;
  farmer_id: string;
  input_type: string;
  name: string;
  quantity: number;
  unit: string;
  application_date: string;
  purpose?: string;
  notes?: string;
  created_at: string;
}

export interface CropObservation {
  id: string;
  crop_id: string;
  farmer_id: string;
  observation_type: string;
  description: string;
  severity: string;
  image_url?: string;
  recorded_at: string;
}

export interface Harvest {
  id: string;
  crop_id: string;
  farmer_id: string;
  harvest_date: string;
  quantity: number;
  unit: string;
  quality_grade?: string;
  storage_location?: string;
  batch_id?: string;
  created_at: string;
}

export interface ProduceBatch {
  id: string;
  batch_code: string;
  farmer_id: string;
  farm_id: string;
  plot_id: string;
  crop_id: string;
  crop_type: string;
  variety: string;
  harvest_date: string;
  initial_quantity: number;
  current_quantity: number;
  unit: string;
  quality_grade: string;
  current_status: BatchStatus;
  current_location?: string;
  qr_code_url?: string;
  created_at: string;
  updated_at?: string;
}

export interface TraceabilityEvent {
  id: string;
  batch_id?: string;
  event_type: string;
  actor_id?: string;
  actor_role?: string;
  actor_name?: string;
  location?: string;
  details?: string;
  notes?: string;
  created_at?: string;
  updated_at?: string;
  timestamp?: string;
  tx_hash?: string;
  actor?: {
    full_name?: string;
    role?: string;
  };
}

export interface VendorInventory {
  id: string;
  vendor_id: string;
  batch_id: string;
  product_name: string;
  crop_type: string;
  quantity: number;
  unit: string;
  location?: string;
  status: string;
  notes?: string;
  created_at: string;
  updated_at?: string;
  batch?: {
    batch_code: string;
    quality_grade: string;
    harvest_date: string;
  };
}

export interface VendorProcurement {
  id: string;
  vendor_id: string;
  batch_id: string;
  farmer_id: string;
  quantity: number;
  unit: string;
  purchase_price: number;
  purchase_date: string;
  quality_grade?: string;
  transport_details?: string;
  notes?: string;
  created_at: string;
  updated_at?: string;
  batch?: {
    batch_code: string;
    crop_type: string;
    variety: string;
  };
  farmer?: {
    full_name: string;
    phone: string;
  };
}

export interface Product {
  id: string;
  vendor_id: string;
  batch_id?: string;
  name: string;
  crop_type: string;
  variety?: string;
  description?: string;
  price_per_unit: number;
  unit: string;
  available_quantity: number;
  images: string[];
  quality_grade: string;
  location: string;
  created_at: string;
  updated_at?: string;
  vendor?: {
    id: string;
    full_name: string;
  };
  listing?: {
    listing_status: ListingStatus;
  };
}

export interface CartItem {
  id: string;
  cart_id: string;
  product_id: string;
  quantity: number;
  unit_price_snapshot: number;
  product?: Product;
}

export interface Cart {
  id: string;
  customer_id: string;
  items: CartItem[];
  subtotal: number;
}

export interface OrderItem {
  id: string;
  order_id: string;
  product_id: string;
  batch_id?: string;
  product_name_snapshot: string;
  unit_price: number;
  quantity: number;
  subtotal: number;
}

export interface Order {
  id: string;
  order_code: string;
  customer_id: string;
  vendor_id: string;
  status: OrderStatus;
  subtotal: number;
  delivery_fee: number;
  total_amount: number;
  delivery_address: string;
  contact_phone?: string;
  created_at: string;
  updated_at?: string;
  items?: OrderItem[];
  vendor?: {
    full_name: string;
    phone?: string;
  };
  customer?: {
    full_name: string;
    phone?: string;
  };
}

export interface FreshnessScan {
  id: string;
  bag_id: string;
  customer_id: string;
  image_url: string;
  scan_date: string;
  freshness_score: number;
  remaining_shelf_life_days: number;
  predicted_use_by_date: string;
  prediction_interval_lower_days: number;
  prediction_interval_upper_days: number;
  model_name: string;
  model_version: string;
}

export interface FreshnessBagItem {
  id: string;
  customer_id: string;
  produce_name: string;
  crop_type: string;
  current_status: BagStatus;
  storage_recommendation?: string;
  latest_scan_id?: string;
  created_at: string;
  updated_at?: string;
  latest_scan?: FreshnessScan;
  scan_history?: FreshnessScan[];
}

export interface WeatherInfo {
  locationKey: string;
  temperature: number;
  humidity: number;
  rainfallMm: number;
  windSpeedKmh: number;
  condition: string;
  forecast: Array<{
    date: string;
    maxTemp: number;
    minTemp: number;
    condition: string;
    precipitationProbability: number;
  }>;
  observationTime: string;
  dataSource: string;
}

export interface NotificationItem {
  id: string;
  type: string;
  title: string;
  message: string;
  severity: 'INFO' | 'SUCCESS' | 'WARNING' | 'CRITICAL';
  read: boolean;
  created_at: string;
}
