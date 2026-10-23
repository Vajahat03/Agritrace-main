# Phase 4 intelligence and waste reduction

Phase 4 extends the existing authenticated farmer workflow. It does not use an LLM for the agricultural recommendation. Vision condition, the optional Shelf-Life V1 development estimate, entered inventory, and an optional normalized market snapshot are combined by the deterministic policy in `backend/intelligence.py`.

## Market data status

The repository has no configured real market feed. The legacy `MarketAgent` contains hard-coded benchmark prices and simulated trends, so Phase 4 intentionally does not use it as evidence. `UnavailableMarketProvider` is the safe default. A real provider can implement `MarketDataProvider.get_market_data(produce_type, location)` and return `price`, `unit`, `currency`, `observed_at`, `source`, and optional metadata. Provider failures and unknown/malformed units yield `price_status=unavailable`; no fallback price is supplied.

Prices are normalized to price per kilogram using deterministic conversions for kg, quintal (100 kg), and tonne (1000 kg). Currency is carried unchanged; no currency exchange is performed. Successful normalized snapshots are cached in additive Supabase PostgreSQL storage by workspace, produce, location, day, and provider for `MARKET_DATA_CACHE_TTL_SECONDS` (default 900 seconds). Snapshots are attached to the scan result so frontend refreshes do not trigger market lookups.

## Inventory and decision policy

Inventory quantity must be finite, non-negative, and use `kg`, `g`, `quintal`, `tonne`, `crate`, or `box`. Original quantity/unit remain visible; mass units also receive a canonical kg value. Crates and boxes have no inferred mass.

Thresholds are centralized in `backend/intelligence.py`. Precedence is: missing core vision data, high defect inspection, urgent shelf life (at most 2 days), short shelf life (at most 5 days, with low quality prioritized first), healthy condition, then reduced-quality recovery or ordinary handling when the shelf-life estimate is absent. The API returns action, priority, reason, action guidance, urgency, data completeness, market availability, and supporting factors. A market quote is shown as context only; without an established historical or source-defined market signal, price does not alter the condition-based action.

These rules are decision support, not food-safety guarantees. Shelf-Life V1 remains a development model and has not been externally validated. Market and price data are absent until a real provider is configured.
