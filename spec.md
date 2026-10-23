# AgriTrace — Full Frontend & Backend Implementation Specification

## 1. Project Scope

AgriTrace is an AI-powered multimodal food freshness, shelf-life, agricultural intelligence, inventory, marketplace, and farm-to-consumer traceability platform.

### Current phase

The existing AI agents/models have already been developed separately.

**Do not rebuild or duplicate the AI agents in this phase.**

Build the complete frontend and backend foundation for:

- Farmer Dashboard
- Vendor Dashboard
- Customer Dashboard
- Authentication and role-based authorization
- Farms, plots, and multiple crop management
- Crop detail pages
- Fertilizer and agricultural activity history
- Harvest and produce batches
- Vendor inventory and procurement
- Marketplace, cart, favorites, and orders
- Weather integration
- Notifications foundation
- Traceability and QR foundation
- Analytics foundation
- Audit logging
- Multilingual-ready architecture
- Clean AI integration interfaces for later integration

AI integration is the final phase.

---

## 2. Core Product Identity

> **AI-powered fruit and vegetable freshness detection and shelf-life management with a personalized digital Freshness Bag, agricultural intelligence, and farm-to-consumer traceability.**

The platform must not be presented primarily as a generic farmer chatbot.

---

## 3. Technology Stack

### Frontend

- Next.js
- React
- TypeScript
- Tailwind CSS
- shadcn/ui
- React Hook Form
- Zod
- TanStack Query
- Recharts
- Lucide icons
- i18next / react-i18next

### Backend

- Node.js
- Express.js
- TypeScript
- REST API
- Zod or equivalent validation
- JWT authentication
- bcrypt or Argon2
- HTTP-only refresh-token strategy
- Centralized error handling
- Structured logging
- Rate limiting
- Helmet/security headers

### Database

- MongoDB Atlas
- Mongoose or MongoDB native driver

### Storage

Use cloud object storage for crop images, produce images, product images, profile images, documents, and reports. Store references and metadata in MongoDB.

### Weather

Use the supplied weather-provider API key only on the backend.

Environment variable:

```env
WEATHER_API_KEY=YOUR_WEATHER_API_KEY
```

**Never expose the key in frontend code, browser requests, GitHub, logs, screenshots, or API responses.**

Because the key was exposed in the project conversation, rotate/reissue it before production use.

### Deployment

- Frontend: Vercel or equivalent
- Backend: AWS, Render, Railway, Azure, or equivalent
- Database: MongoDB Atlas
- AI: GPU/cloud deployment where required
- Blockchain: EVM-compatible testnet initially

---

## 4. User Roles

Support:

- CUSTOMER
- FARMER
- VENDOR
- BUYER
- TRANSPORTER
- ADMIN

Required dashboards now:

- Farmer
- Vendor
- Customer

Create role and authorization foundations for BUYER, TRANSPORTER, and ADMIN even if their complete dashboards are implemented later.

A user may have multiple roles if multi-role accounts are enabled.

---

# 5. High-Level Architecture

```text
                         AGRITRACE
                             |
            +----------------+----------------+
            |                |                |
         FARMER           VENDOR          CUSTOMER
            |                |                |
            +----------------+----------------+
                             |
                         Next.js UI
                             |
                        HTTPS / REST
                             |
                       Express Backend
                             |
       +---------------------+---------------------+
       |                     |                     |
  Auth Service       Business Services       AI Adapter
       |                     |                     |
       |          +----------+----------+          |
       |          |          |          |          |
       |        Farms      Market     Weather       |
       |        Crops      Orders     Inventory     |
       |        Harvest   Products   Traceability   |
       |        Batches              Notifications  |
       |                                           |
       +---------------------+---------------------+
                             |
                        MongoDB Atlas
                             |
             +---------------+----------------+
             |               |                |
        Application DB  Vector Search     Audit Logs
                             |
                            RAG
                             |
                     Existing AI Systems
                             |
        +----------+---------+---------+----------+
        |          |                   |          |
      Vision   Freshness          Shelf-Life     Price
        AI        AI                  AI          AI
                             |
                         AI Results
                             |
                    Application / UI
                             |
                  +----------+----------+
                  |                     |
             Notifications         Traceability
                                        |
                                       QR
                                        |
                                   Blockchain
```

---

# 6. Frontend Structure

Recommended:

```text
frontend/
├── app/
│   ├── (auth)/
│   │   ├── login/
│   │   ├── signup/
│   │   ├── forgot-password/
│   │   └── reset-password/
│   ├── farmer/
│   │   ├── dashboard/
│   │   ├── farms/
│   │   ├── farms/[farmId]/
│   │   ├── plots/
│   │   ├── crops/
│   │   ├── crops/[cropId]/
│   │   ├── crops/[cropId]/fertilizer/
│   │   ├── crops/[cropId]/irrigation/
│   │   ├── crops/[cropId]/harvest/
│   │   ├── batches/
│   │   ├── weather/
│   │   ├── notifications/
│   │   └── profile/
│   ├── vendor/
│   │   ├── dashboard/
│   │   ├── inventory/
│   │   ├── inventory/[itemId]/
│   │   ├── procurement/
│   │   ├── products/
│   │   ├── orders/
│   │   ├── customers/
│   │   ├── traceability/
│   │   ├── weather/
│   │   ├── notifications/
│   │   └── profile/
│   ├── customer/
│   │   ├── dashboard/
│   │   ├── marketplace/
│   │   ├── marketplace/[productId]/
│   │   ├── cart/
│   │   ├── orders/
│   │   ├── orders/[orderId]/
│   │   ├── favorites/
│   │   ├── freshness-bag/
│   │   ├── traceability/
│   │   ├── notifications/
│   │   └── profile/
│   └── trace/
│       └── batch/[batchId]/
├── components/
├── hooks/
├── services/
├── lib/
├── types/
└── locales/
```

---

# 7. Authentication

## Sign Up

Fields:

- Full name
- Email
- Phone
- Password
- Confirm password
- Role
- Terms acceptance

Optional:

- Profile image

## Login

- Email/phone
- Password

Features:

- Email verification
- Forgot password
- Reset password
- Secure logout
- Refresh session
- Role-based redirect

Optional future:

- Google authentication
- Phone OTP

---

# 8. Authorization

Every protected API request must verify:

1. Authentication
2. User identity
3. Role
4. Resource ownership/permission

A farmer must never be able to access another farmer's farms, plots, crops, fertilizer records, or batches by changing an ID.

---

# 9. Farmer Dashboard

Dashboard cards:

- Total farms
- Total plots
- Active crops
- Crops nearing harvest
- Recent fertilizer applications
- Recent irrigation
- Active batches
- Weather
- Notifications

Quick actions:

- Add Farm
- Add Plot
- Add Crop
- Add Fertilizer
- Add Irrigation
- Add Harvest
- Create Batch

Navigation:

```text
Dashboard
My Farms
Plots
My Crops
Fertilizer & Inputs
Irrigation
Harvests
Produce Batches
Weather
Notifications
Profile
Settings
```

---

# 10. Farm and Plot Management

Hierarchy:

```text
Farmer
  |
  +-- Farm
       |
       +-- Plot
            |
            +-- Crop
```

A farmer can have multiple farms.

A farm can have multiple plots.

A plot can have multiple crop records where applicable.

Fields for Farm:

- Farm name
- Location
- Address
- Latitude
- Longitude
- Total area
- Area unit
- Soil information
- Notes

Fields for Plot:

- Farm
- Plot name/number
- Area
- Area unit
- Soil type
- Irrigation source
- Location
- Notes

---

# 11. Multiple Crop Requirement

This is mandatory.

A farmer may plant 2, 3, or many crops at the same time.

Example:

```text
My Crops

+-------------+  +-------------+  +-------------+
| Tomato      |  | Onion       |  | Potato      |
| Plot A      |  | Plot B      |  | Plot C      |
| Growing     |  | Growing     |  | Growing     |
+-------------+  +-------------+  +-------------+
```

Every crop must have a unique ID.

Clicking a crop card opens:

```text
/farmer/crops/[cropId]
```

The farmer can edit that crop independently.

---

# 12. Crop Card

Display:

- Crop image
- Crop name
- Variety
- Farm
- Plot
- Area
- Planting date
- Expected harvest date
- Status
- Last activity
- Weather summary
- Quick actions

Actions:

- View Details
- Edit
- Add Fertilizer
- Add Irrigation
- Add Input
- Add Harvest
- Create Batch

---

# 13. Crop Detail Page

The crop detail page must contain:

## Overview

- Crop
- Variety
- Farm
- Plot
- Area
- Planting date
- Expected harvest date
- Current status
- Notes

## Fertilizer History

Table:

| Date | Fertilizer | Type | Quantity | Unit | Method | Cost | Notes | Actions |
|---|---|---|---:|---|---|---:|---|---|

## Irrigation History

| Date | Method | Duration | Water Quantity | Unit | Source | Notes | Actions |
|---|---|---:|---:|---|---|---|---|

## Other Inputs

| Date | Input | Quantity | Unit | Purpose | Notes | Actions |
|---|---|---:|---|---|---|---|

## Harvest History

| Date | Quantity | Unit | Quality | Batch | Notes | Actions |
|---|---:|---|---|---|---|---|

## Weather

Weather associated with the crop's farm/plot.

## Activity Timeline

Chronological activity feed.

---

# 14. Fertilizer Management — Critical Requirement

**Every fertilizer application is a new historical record.**

Example:

```text
10 Aug 2026 -> Urea -> 25 kg
17 Aug 2026 -> Urea -> 20 kg
25 Aug 2026 -> NPK  -> 15 kg
```

These must be three separate records.

Adding another application must never overwrite the previous one.

The farmer can:

- Add
- View
- Edit a specific historical application
- Archive/delete where permitted
- Filter by date
- Filter by fertilizer
- View total quantity/cost

## Add Fertilizer Form

Fields:

- Fertilizer name
- Fertilizer type
- Application date
- Quantity
- Unit
- Application method
- N value if known
- P value if known
- K value if known
- Cost
- Supplier
- Notes
- Optional attachment/photo

Editing must modify only the selected record.

---

# 15. Irrigation Management

Each irrigation event is a separate record.

Fields:

- Date
- Method
- Duration
- Water quantity
- Unit
- Source
- Notes

Methods:

- Drip
- Sprinkler
- Flood
- Manual
- Other

---

# 16. Crop Inputs

Support:

- Fertilizer
- Compost
- Pesticide
- Herbicide
- Fungicide
- Growth input
- Other

Each event is timestamped and stored separately.

---

# 17. Crop Observations

Allow optional records for:

- Pest observation
- Disease observation
- Crop condition
- Damage
- Manual notes
- Photos

AI analysis can be connected later.

---

# 18. Harvest Management

Fields:

- Crop
- Harvest date
- Quantity
- Unit
- Quality grade
- Notes

A harvest may generate a produce batch.

Example:

```text
Tomato
Harvest: 500 kg
Batch: TOM-2026-0001
```

---

# 19. Produce Batches

Fields:

- Batch ID
- Farmer
- Farm
- Plot
- Crop
- Variety
- Harvest date
- Quantity
- Unit
- Quality
- Current owner
- Current location
- Status
- Created timestamp

Statuses:

```text
HARVESTED
STORED
LISTED
SOLD
IN_TRANSIT
RECEIVED
DELIVERED
PROCESSED
COMPLETED
```

---

# 20. Vendor Dashboard

Dashboard:

- Inventory count
- Low-stock items
- Inventory needing attention
- Today's orders
- Pending orders
- Procurement
- Sales summary
- Customers
- Weather
- Notifications

Navigation:

```text
Dashboard
Inventory
Procurement
Products
Marketplace Listings
Orders
Customers
Traceability
Weather
Notifications
Profile
Settings
```

---

# 21. Vendor Inventory

Table:

| Product | Batch | Quantity | Unit | Source | Harvest Date | Status | Actions |
|---|---|---:|---|---|---|---|---|

Actions:

- Add
- Edit
- Adjust quantity
- Move stock
- Mark sold
- Mark damaged
- Mark discarded
- View batch
- View traceability

AI freshness/shelf-life fields will be connected later.

---

# 22. Vendor Procurement

Fields:

- Farmer
- Farm
- Crop
- Batch
- Quantity
- Unit
- Purchase price
- Purchase date
- Quality grade
- Transport details
- Notes

Relationship:

```text
Farmer -> Batch -> Vendor
```

---

# 23. Vendor Products and Listings

Product fields:

- Product name
- Crop
- Variety
- Description
- Price
- Unit
- Available quantity
- Images
- Batch
- Quality
- Location
- Availability
- Delivery options

Listing statuses:

```text
DRAFT
ACTIVE
OUT_OF_STOCK
PAUSED
SOLD_OUT
```

---

# 24. Customer Dashboard

Display:

- Marketplace
- Recent orders
- Freshness Bag summary
- Items nearing predicted shelf-life window
- Favorites
- Notifications

Quick actions:

- Browse Marketplace
- Scan Produce
- Upload Image
- Open Freshness Bag

AI scanning is integrated later.

Navigation:

```text
Dashboard
Marketplace
Freshness Bag
Orders
Favorites
Traceability
Notifications
Profile
Settings
```

---

# 25. Marketplace

Features:

- Search
- Crop/category filter
- Location filter
- Price filter
- Vendor filter
- Quality filter
- Availability filter
- Sort

Product cards:

- Image
- Product name
- Vendor
- Price
- Unit
- Availability
- Quality
- Traceability availability

---

# 26. Product Detail

Display:

- Product image
- Product
- Vendor
- Price
- Unit
- Quantity
- Quality
- Batch
- Harvest information where available
- Traceability
- Location
- Description
- Add to cart
- Favorite

---

# 27. Cart

Features:

- Add item
- Remove item
- Change quantity
- Subtotal
- Delivery fee
- Total
- Checkout

---

# 28. Orders

Statuses:

```text
PLACED
CONFIRMED
PROCESSING
READY
SHIPPED
IN_TRANSIT
DELIVERED
CANCELLED
```

Customer:

- View
- Track
- Cancel where permitted
- View vendor
- View batch traceability

Vendor:

- Accept/reject
- Process
- Mark ready
- Ship
- Update status

---

# 29. Freshness Bag

Core feature for Customer.

Each saved item:

- Produce
- Scan ID
- Image
- Freshness prediction
- Remaining shelf-life prediction
- Estimated use-by window
- Storage recommendation
- Added date
- Status

Statuses:

```text
ACTIVE
CONSUMED
DISCARDED
```

Existing AI system will populate prediction fields later.

---

# 30. Weather Service

Create a backend weather service.

Endpoints:

```text
GET /api/weather/current
GET /api/weather/forecast
GET /api/weather/historical
```

Inputs:

```text
latitude
longitude
startDate
endDate
```

The backend calls the external weather provider.

Requirements:

- API key stays server-side
- Cache repeated requests
- Timeout and retry policy
- Provider failure handling
- Provider/timestamp metadata
- Store historical observations where required
- Associate farm/plot weather with date and location

Weather fields may include:

- Temperature
- Humidity
- Rainfall/precipitation
- Wind
- Weather condition
- Forecast
- Observation time

---

# 31. Weather and Future Price Model Integration

Weather shown in the UI does not automatically make the price model weather-aware.

When the existing price model is integrated later:

```text
AGMARKNET
   +
Weather
   +
Market features
   +
Historical causal features
       |
Feature engineering
       |
Trained model
       |
T+1 / T+3 / T+7
```

Historical weather must be joined to market data using appropriate location/date relationships.

Only features actually used during model training may be claimed as model inputs.

Never fabricate missing weather values.

---

# 32. Multilingual Architecture

Supported UI/input languages:

- English
- Hindi
- Marathi
- Tamil
- Hinglish

Users should be able to:

- Select UI language
- Type in regional language
- Type in mixed language
- Receive responses in selected/input language

Use localization files:

```text
locales/
├── en/
├── hi/
├── mr/
├── ta/
└── hinglish/
```

Internal database values should use canonical IDs.

Example:

```text
Tomato
टमाटर
टोमॅटो
தக்காளி
tamatar
```

all map to:

```text
commodity_id = TOMATO
```

Do not create separate commodities solely because the display language differs.

---

# 33. Notifications

Support:

- In-app
- Push foundation
- Email

Future:

- SMS
- WhatsApp

Notification fields:

```text
userId
type
title
message
severity
read
createdAt
scheduledFor
metadata
```

Examples:

- Weather alert
- Crop reminder
- Order update
- Inventory alert
- Freshness Bag reminder
- Shelf-life reminder

---

# 34. Traceability

Traceability chain:

```text
Farmer
  |
Farm
  |
Plot
  |
Crop
  |
Harvest
  |
Produce Batch
  |
Vendor
  |
Inventory
  |
Listing
  |
Order
  |
Customer
```

Every important ownership/location transition creates a traceability event.

---

# 35. QR Traceability

Generate QR codes for produce batches.

Public route:

```text
/trace/batch/[batchId]
```

Public page:

- Batch ID
- Crop
- Harvest date
- Origin information subject to privacy rules
- Current status
- Traceability events
- Vendor information where appropriate

Do not expose private user information.

---

# 36. Blockchain Foundation

Blockchain is optional for the initial application workflow and should remain modular.

Do not store:

- Images
- Private user data
- Large documents

on-chain.

Use hashes/verification references for important traceability records if blockchain is enabled.

---

# 37. MongoDB Collections

Create:

```text
users
roles
farms
plots
crops
fertilizer_applications
irrigation_records
crop_inputs
crop_observations
harvests
produce_batches
vendors
buyers
products
inventory
inventory_movements
marketplace_listings
carts
orders
order_items
favorites
freshness_bag
weather_observations
weather_cache
notifications
traceability_events
qr_records
ai_predictions
ai_scans
rag_documents
audit_logs
system_settings
```

---

# 38. Core Data Relationships

```text
USER
 |
 +-- FARMER
 |     |
 |     +-- FARM
 |           |
 |           +-- PLOT
 |                 |
 |                 +-- CROP
 |                       |
 |                       +-- FERTILIZER_APPLICATION
 |                       +-- IRRIGATION_RECORD
 |                       +-- CROP_INPUT
 |                       +-- CROP_OBSERVATION
 |                       +-- HARVEST
 |                              |
 |                              +-- PRODUCE_BATCH
 |
 +-- VENDOR
 |     +-- INVENTORY
 |     +-- PRODUCTS
 |     +-- LISTINGS
 |     +-- ORDERS
 |
 +-- CUSTOMER
       +-- CART
       +-- ORDERS
       +-- FAVORITES
       +-- FRESHNESS_BAG
```

---

# 39. Example Crop Document

```json
{
  "_id": "crop_id",
  "farmerId": "farmer_id",
  "farmId": "farm_id",
  "plotId": "plot_id",
  "cropType": "tomato",
  "variety": "variety_name",
  "area": 2.5,
  "areaUnit": "acre",
  "plantingDate": "2026-08-01",
  "expectedHarvestDate": "2026-11-15",
  "status": "GROWING",
  "notes": "",
  "createdAt": "...",
  "updatedAt": "..."
}
```

---

# 40. Example Fertilizer Document

```json
{
  "_id": "fertilizer_application_id",
  "cropId": "crop_id",
  "farmerId": "farmer_id",
  "fertilizerName": "NPK",
  "fertilizerType": "NPK",
  "applicationDate": "2026-09-06",
  "quantity": 25,
  "unit": "kg",
  "method": "SOIL",
  "cost": 1200,
  "supplier": "",
  "notes": "",
  "createdAt": "...",
  "updatedAt": "..."
}
```

A second application must create a different `_id`.

---

# 41. API Design

Base path:

```text
/api
```

## Authentication

```text
POST /api/auth/register
POST /api/auth/login
POST /api/auth/refresh
POST /api/auth/logout
POST /api/auth/verify-email
POST /api/auth/forgot-password
POST /api/auth/reset-password
GET  /api/auth/me
```

## Farmer

```text
GET    /api/farmer/dashboard

GET    /api/farmer/farms
POST   /api/farmer/farms
GET    /api/farmer/farms/:farmId
PATCH  /api/farmer/farms/:farmId
DELETE /api/farmer/farms/:farmId

GET    /api/farmer/plots
POST   /api/farmer/plots
GET    /api/farmer/plots/:plotId
PATCH  /api/farmer/plots/:plotId
DELETE /api/farmer/plots/:plotId

GET    /api/farmer/crops
POST   /api/farmer/crops
GET    /api/farmer/crops/:cropId
PATCH  /api/farmer/crops/:cropId
DELETE /api/farmer/crops/:cropId

GET    /api/farmer/crops/:cropId/fertilizers
POST   /api/farmer/crops/:cropId/fertilizers
PATCH  /api/farmer/crops/:cropId/fertilizers/:fertilizerId
DELETE /api/farmer/crops/:cropId/fertilizers/:fertilizerId

GET    /api/farmer/crops/:cropId/irrigation
POST   /api/farmer/crops/:cropId/irrigation
PATCH  /api/farmer/crops/:cropId/irrigation/:recordId
DELETE /api/farmer/crops/:cropId/irrigation/:recordId

GET    /api/farmer/crops/:cropId/inputs
POST   /api/farmer/crops/:cropId/inputs
PATCH  /api/farmer/crops/:cropId/inputs/:inputId
DELETE /api/farmer/crops/:cropId/inputs/:inputId

GET    /api/farmer/crops/:cropId/harvests
POST   /api/farmer/crops/:cropId/harvests

GET    /api/farmer/batches
POST   /api/farmer/batches
GET    /api/farmer/batches/:batchId
PATCH  /api/farmer/batches/:batchId

GET    /api/farmer/weather
GET    /api/farmer/notifications
```

## Vendor

```text
GET    /api/vendor/dashboard

GET    /api/vendor/inventory
POST   /api/vendor/inventory
GET    /api/vendor/inventory/:itemId
PATCH  /api/vendor/inventory/:itemId
POST   /api/vendor/inventory/:itemId/adjust

GET    /api/vendor/procurement
POST   /api/vendor/procurement

GET    /api/vendor/products
POST   /api/vendor/products
PATCH  /api/vendor/products/:productId
DELETE /api/vendor/products/:productId

GET    /api/vendor/listings
POST   /api/vendor/listings
PATCH  /api/vendor/listings/:listingId

GET    /api/vendor/orders
GET    /api/vendor/orders/:orderId
PATCH  /api/vendor/orders/:orderId/status

GET    /api/vendor/notifications
GET    /api/vendor/weather
```

## Customer

```text
GET    /api/customer/dashboard

GET    /api/customer/marketplace
GET    /api/customer/products/:productId

GET    /api/customer/cart
POST   /api/customer/cart/items
PATCH  /api/customer/cart/items/:itemId
DELETE /api/customer/cart/items/:itemId

POST   /api/customer/orders
GET    /api/customer/orders
GET    /api/customer/orders/:orderId
POST   /api/customer/orders/:orderId/cancel

GET    /api/customer/favorites
POST   /api/customer/favorites
DELETE /api/customer/favorites/:productId

GET    /api/customer/freshness-bag
POST   /api/customer/freshness-bag
PATCH  /api/customer/freshness-bag/:itemId/status

GET    /api/customer/notifications
```

## Weather

```text
GET /api/weather/current
GET /api/weather/forecast
GET /api/weather/historical
```

## Public Traceability

```text
GET /api/trace/batch/:batchId
GET /api/trace/batch/:batchId/qr
```

---

# 42. Backend Structure

```text
backend/
├── src/
│   ├── config/
│   ├── controllers/
│   ├── middleware/
│   ├── models/
│   ├── routes/
│   ├── services/
│   │   ├── weather/
│   │   ├── notifications/
│   │   ├── storage/
│   │   ├── traceability/
│   │   └── ai/
│   ├── validators/
│   ├── utils/
│   ├── types/
│   ├── app.ts
│   └── server.ts
├── tests/
├── .env.example
└── package.json
```

---

# 43. AI Integration Layer

Create:

```text
services/ai/
```

Adapters:

```text
visionService
freshnessService
shelfLifeService
pricePredictionService
ragService
agentService
```

Architecture:

```text
Frontend
   |
Backend
   |
AI Service Adapter
   |
Existing AI System
```

Do not load PyTorch models directly inside React/Next.js components.

Do not duplicate the already-built agents.

---

# 44. AI Prediction Data Contract

When integrated later, save:

```json
{
  "modelId": "model-id",
  "modelVersion": "version",
  "inputReference": "scan-or-record-id",
  "prediction": {},
  "uncertainty": {},
  "features": {},
  "createdAt": "..."
}
```

---

# 45. Data Integrity

Absolutely no fabricated:

- Market prices
- Weather
- Crop measurements
- Fertilizer records
- Harvest quantities
- AI metrics
- Prediction outputs

Demo data must be clearly marked as DEMO/TEST and never mixed with production data.

---

# 46. Historical Data Rule

These must remain historical event records:

- Fertilizer applications
- Irrigation
- Crop inputs
- Crop observations
- Harvests
- Inventory movements
- Traceability events

A new event creates a new record.

Only an explicit Edit operation modifies the selected historical record.

---

# 47. Forms

Use:

- React Hook Form
- Zod
- Server-side validation

Every form needs:

- Required validation
- Type validation
- Date validation
- Quantity validation
- Unit validation
- Loading state
- Error state
- Success state
- Server-side validation

---

# 48. Tables

All major history tables should support:

- Pagination
- Search
- Sorting
- Filters
- Date filtering
- Responsive mobile presentation
- View
- Edit
- Archive/delete where permitted
- Loading state
- Empty state

Mobile should use cards/list layouts where a wide table is impractical.

---

# 49. File Upload Flow

```text
Frontend
   |
Backend upload endpoint
   |
Object storage
   |
MongoDB metadata/reference
```

Validate:

- File type
- File size
- Ownership
- Access permissions

---

# 50. Notifications

Use scheduled jobs/queue infrastructure for reminders where required.

Freshness Bag reminders should later be driven by the existing shelf-life prediction system.

Do not generate fake shelf-life values to trigger notifications.

---

# 51. Audit Logs

Track:

```text
LOGIN
LOGOUT
CREATE_FARM
UPDATE_FARM
CREATE_PLOT
UPDATE_PLOT
CREATE_CROP
UPDATE_CROP
CREATE_FERTILIZER
UPDATE_FERTILIZER
DELETE_FERTILIZER
CREATE_IRRIGATION
CREATE_HARVEST
CREATE_BATCH
CREATE_PRODUCT
UPDATE_PRODUCT
CREATE_ORDER
UPDATE_ORDER
INVENTORY_ADJUSTMENT
TRACEABILITY_EVENT
```

Fields:

```text
userId
role
action
resourceType
resourceId
timestamp
metadata
```

---

# 52. Error Response

Success:

```json
{
  "success": true,
  "data": {}
}
```

Error:

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Application date is required"
  }
}
```

Never expose production stack traces.

---

# 53. Environment Variables

Create `.env.example`:

```env
NODE_ENV=development
PORT=5000

MONGODB_URI=YOUR_MONGODB_URI

JWT_SECRET=YOUR_JWT_SECRET
JWT_REFRESH_SECRET=YOUR_REFRESH_SECRET

WEATHER_API_KEY=YOUR_WEATHER_API_KEY

STORAGE_BUCKET=YOUR_BUCKET
STORAGE_ACCESS_KEY=YOUR_ACCESS_KEY
STORAGE_SECRET_KEY=YOUR_STORAGE_SECRET

AI_SERVICE_URL=YOUR_AI_SERVICE_URL
```

`.env` must be in `.gitignore`.

---

# 54. Testing

## Unit tests

- Validators
- Services
- Utilities
- Business rules

## Integration tests

- Register/login
- Role authorization
- Farm creation
- Plot creation
- Multiple crop creation
- Crop editing
- Fertilizer creation
- Fertilizer editing
- Repeated fertilizer applications
- Irrigation
- Harvest
- Batch
- Inventory
- Procurement
- Product listing
- Orders
- Weather
- Traceability

## Critical fertilizer test

Submitting fertilizer twice must produce two records:

```text
Application 1
Application 2
```

The first must remain unchanged.

## Security tests

- Farmer A cannot access Farmer B data
- Customer cannot access farmer endpoints
- Vendor cannot edit another vendor's inventory
- Unauthorized users cannot access protected routes

---

# 55. Development Phases

## Phase 1 — Foundation

- Repository structure
- Next.js
- Express
- TypeScript
- MongoDB Atlas
- Environment configuration
- API client
- UI system

## Phase 2 — Authentication

- Signup
- Login
- Role selection
- JWT
- Refresh tokens
- Authorization

## Phase 3 — Farmer

- Dashboard
- Farms
- Plots
- Multiple crops
- Crop cards
- Crop detail pages

## Phase 4 — Farmer Records

- Fertilizer
- Irrigation
- Inputs
- Observations
- Harvest
- Batches

## Phase 5 — Weather

- Backend weather service
- Current weather
- Forecast
- Historical data
- Farm/plot location integration
- Caching

## Phase 6 — Vendor

- Dashboard
- Inventory
- Procurement
- Products
- Listings
- Orders

## Phase 7 — Customer

- Dashboard
- Marketplace
- Product detail
- Cart
- Orders
- Favorites
- Freshness Bag foundation

## Phase 8 — Traceability

- Batch history
- QR
- Public traceability page
- Blockchain adapter foundation

## Phase 9 — Notifications

- In-app
- Email
- Push foundation

## Phase 10 — Multilingual

- English
- Hindi
- Marathi
- Tamil
- Hinglish
- Canonical agricultural vocabulary

## Phase 11 — Testing/Security

- Unit tests
- Integration tests
- Authorization tests
- Security review
- Mobile testing

## Phase 12 — Existing AI Integration

Connect the already-built AI agents/models through the adapters.

---

# 56. UI Requirements

Design must be:

- Modern
- Clean
- Professional
- Agriculture-oriented
- Responsive
- Mobile-first for farmers
- Accessible
- Not excessively dark
- Easy to understand

Use:

- Cards
- Tables
- Charts
- Status badges
- Timelines
- Clear forms
- Empty states
- Confirmation dialogs
- Toast notifications

Avoid excessive decoration.

---

# 57. Farmer Experience Priority

The farmer workflow is critical:

```text
Farmer
  |
  +-- My Farms
        |
        +-- Plot A
        |     |
        |     +-- Tomato
        |     +-- Onion
        |
        +-- Plot B
              |
              +-- Potato
              +-- Chili
```

Selecting Tomato:

```text
Tomato Detail
  |
  +-- Overview
  +-- Fertilizer History
  +-- Irrigation
  +-- Inputs
  +-- Observations
  +-- Harvest
  +-- Batch
  +-- Weather
  +-- Activity Timeline
```

This must remain easy to update at any time.

---

# 58. Future AI Scan Workflow

```text
Customer
   |
Camera / Upload
   |
Backend
   |
Existing Vision AI
   |
Classification
   |
Freshness
   |
Shelf Life
   |
Storage Recommendation
   |
Freshness Bag
```

No fake AI output is permitted while the model is disconnected.

---

# 59. Future Farmer AI Workflow

```text
Farmer
   |
Crop context
+
Weather
+
Crop history
+
RAG
+
Vision
   |
Existing Agent System
   |
Evidence-based response
```

---

# 60. Future Price Intelligence Workflow

```text
Official AGMARKNET
        +
Historical market features
        +
Weather
        +
Other verified features
        |
Feature Engineering
        |
Existing trained price model
        |
T+1 / T+3 / T+7
        |
Prediction interval
        |
SHAP explanation
        |
Frontend
```

The language/LLM layer must never invent numerical predictions.

---

# 61. Definition of Done

The frontend/backend phase is complete when:

- Registration works.
- Login works.
- Role-based routing works.
- Farmer dashboard works.
- Vendor dashboard works.
- Customer dashboard works.
- Farmer can create multiple farms.
- Farmer can create multiple plots.
- Farmer can create unlimited crop records.
- Crops appear as individual cards.
- Clicking a crop opens its dedicated page.
- Farmer can edit crop details.
- Farmer can add fertilizer.
- Repeated fertilizer applications create separate historical records.
- Individual fertilizer records can be edited.
- Irrigation records work.
- Crop input records work.
- Harvest records work.
- Produce batches work.
- Weather service works through the backend.
- Vendor inventory works.
- Vendor procurement works.
- Vendor listings work.
- Vendor orders work.
- Customer marketplace works.
- Customer cart works.
- Customer orders work.
- Favorites work.
- Freshness Bag foundation works.
- Traceability records work.
- QR public traceability works.
- Notification foundation works.
- Multilingual architecture works.
- Responsive design works.
- Authorization prevents cross-user access.
- Tests cover critical workflows.
- Secrets are server-side.
- AI systems are integrated only through adapters.
- No fabricated agricultural or AI data is used.

---

# 62. Final Developer Instruction

Build the complete frontend and backend foundation according to this specification.

**Do not rebuild the existing AI agents.**

The existing AI files/modules are separate and will be integrated at the end.

Prioritize:

1. Correct database relationships
2. Historical agricultural records
3. Multiple simultaneous crops
4. Dedicated crop detail pages
5. Repeated fertilizer applications as separate records
6. Strong authorization
7. Mobile usability
8. Weather backend integration
9. Vendor/customer workflows
10. Traceability foundations
11. Multilingual-ready architecture
12. Clean AI integration contracts

The most important farmer data hierarchy is:

**Farmer → Farm → Plot → Multiple Crops → Crop Detail → Historical Activities**

Every repeated activity, especially fertilizer application, must be recorded as a new timestamped historical record.

The frontend/backend must be able to integrate the existing AI systems later without requiring a major architectural rewrite.
