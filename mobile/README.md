# Banaoo Mobile App

This folder contains the separate React Native (Expo) mobile app.

## Scope rules

- The existing PWA/web app in the repo root remains unchanged.
- Mobile app uses the same backend stack (API + Supabase) as web.
- No separate database or duplicate server is introduced.

## Setup

1. Copy `.env.example` to `.env` in this folder and fill real values.
2. Install dependencies:
   - `npm install`
3. Start app:
   - from repo root: `npm run mobile:start`
   - or from this folder: `npm run start`

## Current status

- Foundation scaffolded (auth context, outlet context, tab shell screens).
- Orders screen now reads live orders and items, supports status progression and cancel.
- Orders screen now includes billing calculations (discount, GST, service tax) and mark-paid update.
- Kitchen screen now reads active queue and supports per-item status progression.
- New Order screen now supports menu/category fetch, cart management, and order placement into existing tables.
- Printer groundwork added: per-outlet Kitchen/Billing printer settings, platform capability model, and print action hooks in Orders/Kitchen.
- Android BLE path added for silent printing via `react-native-ble-plx` and ESC/POS byte generation.
- For silent BLE mode, each printer needs: `device id`, `service UUID`, and `characteristic UUID`.
- Next parity slices: device pairing UX polish, order add-items flow, and deeper billing/receipt parity polish.
