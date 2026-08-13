# Split Payments, Partial Payments, and Customer Credits Plan

This plan details the implementation to support:
1. **Split Payments**: Paying a single bill with a combination of Cash and Online payments.
2. **Partial Payments & Udhari**: Paying a portion of the bill now and putting the remaining balance on Udhari (credit).
3. **Overpayment & Customer Credits**: Paying more than the bill amount (e.g., due to no change) and crediting the remainder to the customer's account for future use.

---

## User Review Required

> [!IMPORTANT]
> **Database Changes Required**: Since you prefer to run database commands yourself, you will need to execute the following SQL migration in your Supabase SQL Editor:
> 
> ```sql
> -- Add columns to track cash and online split payments
> ALTER TABLE sessions ADD COLUMN cash_paid NUMERIC DEFAULT 0;
> ALTER TABLE sessions ADD COLUMN online_paid NUMERIC DEFAULT 0;
> 
> -- Migrate historical data: Set cash_paid equal to total for all fully paid sessions
> UPDATE sessions SET cash_paid = total WHERE payment = 'paid';
> ```
> Please confirm once you have executed this SQL script.

---

## Open Questions

> [!NOTE]
> 1. **How should customer credit be applied to future sessions?**
>    - *Proposed Approach*: If a customer has a negative balance (credit/advance), we will display a message during checkout: "Customer has X credit. Apply to this bill?" with a button to apply it, which reduces the amount they need to pay.
> 2. **Settle Udhari Flow**:
>    - When a customer wants to pay off their Udhari balance, they currently do it session-by-session. With split payments, they can pay off a session partially (e.g. paying 20 of a remaining 50). We will update the "Mark Paid" dialog in the Udhari ledger to allow entering a specific payment amount (Cash/Online) and it will deduct it from that session's outstanding balance.

---

## Proposed Changes

### Database & Types Layer

#### [MODIFY] [types.ts](file:///d:/green-table/src/lib/types.ts)
- Add `cashPaid: number` and `onlinePaid: number` fields to the `Session` interface.

#### [MODIFY] [store.tsx](file:///d:/green-table/src/lib/store.tsx)
- Update `DbSession` type to include `cash_paid: number` and `online_paid: number`.
- Update `mapSession` mapper to set `cashPaid: Number(r.cash_paid || 0)` and `onlinePaid: Number(r.online_paid || 0)`.
- Update `checkoutWalkIn`, `logPastSession`, `markPaid`, and `markUdhari` context functions to support custom cash and online payment arguments instead of binary paid/unpaid.
- Update the dynamic customer balance calculation:
  ```typescript
  // Balance is now the sum of (total - cashPaid - onlinePaid) for ALL sessions
  balance: sessions
    .filter(s => s.customerId === c.id)
    .reduce((acc, s) => acc + (s.total - (s.cashPaid || 0) - (s.onlinePaid || 0)), 0)
  ```

---

### UI Components & Dialogs

#### [MODIFY] [MarkPaidDialog.tsx](file:///d:/green-table/src/components/MarkPaidDialog.tsx)
- Redesign the dialog to show:
  - **Bill Total**: e.g., `180 PKR`
  - **Cash Paid**: Input field (defaulting to bill total)
  - **Online Paid**: Input field (defaulting to 0)
  - **Status Indicator**:
    - **Balanced**: If Cash + Online matches the total.
    - **Underpaid (Udhari)**: If the sum is less than total. Shows a notice: *"Remaining [X] will be added to Udhari ledger."* (Disable payment button if no customer is linked to the session).
    - **Overpaid (Credit)**: If the sum is greater than total. Shows a notice: *"Overpayment of [X] will be saved as customer credit."* (Disable payment button if no customer is linked).
- Update the save handler to call `markPaid(sessionId, cashAmount, onlineAmount)`.

#### [MODIFY] [WalkInPOSDialog.tsx](file:///d:/green-table/src/components/WalkInPOSDialog.tsx)
- Add Cash and Online split payment input fields to the walk-in checkout form when "Paid" is selected, allowing the user to split payments directly during walk-in sales.

#### [MODIFY] [_app.udhari.tsx](file:///d:/green-table/src/routes/_app.udhari.tsx)
- Update the customer balance logic to calculate balance using `s.total - s.cashPaid - s.onlinePaid`.
- Show partial payment progress on outstanding sessions (e.g. `Paid 80/100 · Remaining 20`).

#### [MODIFY] [_app.sessions.tsx](file:///d:/green-table/src/routes/_app.sessions.tsx)
- Display payment breakdown in the sessions table (e.g., "Cash: 100 | Online: 80" or "Paid: 80 | Udhari: 20").

---

## Verification Plan

### Automated Tests
- Build and compile check: `npm run build` to verify TypeScript typings.

### Manual Verification
1. **Split Payment Test**: End a session of 200 PKR. Mark paid with 120 Cash and 80 Online. Verify that the session is marked as paid and the breakdown is correctly logged.
2. **Partial Payment (Udhari) Test**: End a session of 150 PKR for a registered customer. Pay 100 Cash. Verify that the session goes to Udhari with 50 PKR remaining balance.
3. **Overpayment (Credit) Test**: End a session of 80 PKR. Pay 100 Cash. Verify the customer's balance shows `-20 PKR` (credit/advance).
4. **General Ledger Settlement**: Go to Udhari ledger and pay off the remaining balance on a session.
