# Goal
Resolve the "Fetch Everything" bottleneck by migrating away from loading all historical data into memory on startup, and implement Supabase Real-Time subscriptions to keep data synchronized across multiple devices.

## Open Questions
- To fix the data fetching bottleneck, I will change the application so that it only loads active (running/paused) sessions and a limited number of recent sessions (e.g., last 100) into global memory. Historical views (like the Sessions page and Cafe Log) will query the database directly. Does this sound good?

## Proposed Changes

### `src/lib/store.tsx`
- **Real-Time Sync**: Add a `supabase.channel('public:sessions')` subscription inside a `useEffect` in `AppProvider`. This will listen for `INSERT`, `UPDATE`, and `DELETE` events on `sessions`, `club_tables`, and `inventory_items` and seamlessly update the React state.
- **Stop Fetching Everything**: Modify `loadAll()` to stop using `fetchPaginated` for all tables.
  - `sessions`: Only fetch `status IN ('running', 'paused')` and perhaps the last 100 ended sessions.
  - `expenses`: Only fetch the current month's expenses.
  - `customer_transactions`: Only fetch recent transactions.
- **Customer Balance Fix**: Currently, the app dynamically recalculates every customer's Udhari balance by looping through *all* sessions in memory. Since we won't have all sessions in memory anymore, we will remove this calculation and strictly rely on the `balance` column in the `customers` database table (which is already incrementally updated when transactions happen).

### `src/routes/_app.sessions.tsx`
- Rewrite the data fetching logic. Instead of reading the entire historical `sessions` array from `useApp()`, use `@tanstack/react-query` (or standard `useEffect`) to query Supabase directly with server-side pagination, filtering, and date ranges.

### `src/routes/_app.cafe.tsx`
- Similar to the Sessions page, fetch historical log data directly from Supabase via API queries rather than relying on the globally loaded `sessions` array.

### `src/routes/_app.expenses.tsx`
- Update to fetch paginated historical expenses directly from the database if the user views older expenses.

## Verification Plan
1. Start a session on one browser tab and ensure it automatically appears on another browser tab without refreshing (Real-Time sync).
2. Verify that the initial network payload on load is vastly reduced.
3. Ensure the Sessions and Cafe Log pages still successfully search and paginate through historical records by hitting the database.
