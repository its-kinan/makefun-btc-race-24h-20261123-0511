// Slow-trend cbBTC bot for make.fun bars-replay/v1.
//
// Strategy (chosen from the frozen dev window; see the bounty NOTES.md):
// a 60-bar simple moving average of closes with a wide asymmetric band.
// Buy when the close pushes 0.3% above the 60-bar SMA; sell when it falls
// 1.2% below it. One open position, 95% of cash per entry. Two hard guards
// sit on top: a 2% stop against the position's cost, and a flatten if equity
// ever falls 12% below its running peak (the race guardrail is 25%).
//
// Why this shape: on the dev window the price spends most of the day in flat
// chop with one real rally (hour 04, +2.29%). Fast EMA crosses whipsaw in the
// chop and lose money in simulation; the wide band trades once, rides the
// rally, and stays positive on both halves of the window. The parameters are
// flat across a wide neighbourhood (SMA 45-120, entry 0.2-0.4%, exit
// 1.0-1.6% all clear the gate), so this is a robust rule, not a fitted one.
//
// Determinism: bigint integer arithmetic only. Closes arrive as integer
// price units (price_scale 5); the SMA is compared as 60 * close * 1000
// against the integer sum of the last 60 closes times 1003 / 988. No floats,
// no clock, no randomness, no network, no files. Two runs on the same bars
// emit the same replies byte for byte.
//
// The wire is owned by the kit's SDK shim (vendor/makefun-bars.ts, a
// byte-identical copy of the kit's): one reply per batch, echoing its seq.
// Orders decided on a batch fill at the next bar's open.

import { runBars } from './vendor/makefun-bars.ts';
import type { BarsState, Batch, OrderInput } from './vendor/makefun-bars.ts';

// --- Strategy constants (all integers) ------------------------------------
const SMA_BARS = 60; // lookback for the moving average, in bars
const ENTRY_NUM = 1003n; // buy when close > SMA * 1003 / 1000  (+0.3%)
const EXIT_NUM = 988n; // sell when close < SMA * 988 / 1000   (-1.2%)
const SIZE_BPS = 9500n; // spend 95% of cash on an entry
const STOP_NUM = 98n; // sell when position value < 98% of its cost
const DD_NUM = 88n; // flatten when equity < 88% of its running peak
const MAX_SLIPPAGE_BPS = 100; // 1% past the close the order was decided on

// Per-symbol history of close prices as bigints (price units).
const closes = new Map<string, bigint[]>();
let peakEquity = 0n;

function smaSum(symbol: string): bigint | null {
  const hist = closes.get(symbol);
  if (hist === undefined || hist.length < SMA_BARS) return null;
  let total = 0n;
  for (const c of hist) total += c;
  return total;
}

function onBatch(state: BarsState, batch: Batch): OrderInput[] {
  // Only symbols that actually closed a bar this batch are tradable: a
  // stale close must never trigger an order the replay rejects (no_bar).
  const fresh = new Set<string>();
  for (const bar of batch.bars) {
    let hist = closes.get(bar.symbol);
    if (hist === undefined) {
      hist = [];
      closes.set(bar.symbol, hist);
    }
    hist.push(BigInt(bar.c));
    if (hist.length > SMA_BARS) hist.shift();
    fresh.add(bar.symbol);
  }
  if (state.warmingUp) return [];
  const orders: OrderInput[] = [];
  if (state.equity > peakEquity) peakEquity = state.equity;
  // Drawdown guard: flatten everything if equity is 12% off its peak.
  // Reset the peak after flattening, or the guard would block every later
  // re-entry (flat equity never climbs back to the old peak).
  if (state.positions.size > 0 && peakEquity > 0n && state.equity * 100n < peakEquity * DD_NUM) {
    for (const [symbol, held] of state.positions) {
      if (held.qty > 0n) {
        orders.push({ side: 'sell', symbol, qty: held.qty, max_slippage_bps: MAX_SLIPPAGE_BPS });
      }
    }
    if (orders.length > 0) peakEquity = state.equity;
    return orders;
  }
  for (const { symbol } of state.hello.symbols) {
    if (!fresh.has(symbol)) continue;
    if (orders.length >= state.hello.caps.max_orders_per_bar) break;
    const total = smaSum(symbol);
    if (total === null) continue;
    const close = state.close(symbol);
    if (close === null) continue;
    const held = state.positions.get(symbol);
    const heldQty = held === undefined ? 0n : held.qty;
    if (heldQty > 0n) {
      const value = state.value(symbol, heldQty, close);
      // Exit: close 1.2% under the SMA, or value 2% under cost.
      if (60n * close * 1000n < total * EXIT_NUM || value * 100n < held.cost * STOP_NUM) {
        orders.push({ side: 'sell', symbol, qty: heldQty, max_slippage_bps: MAX_SLIPPAGE_BPS });
      }
    } else {
      // Entry: close 0.3% over the SMA, sized at 95% of cash.
      if (60n * close * 1000n > total * ENTRY_NUM) {
        const byWeight = (BigInt(state.hello.caps.max_weight_bps) * state.equity) / 10000n;
        let notional = (state.cash * SIZE_BPS) / 10000n;
        if (notional > byWeight) notional = byWeight;
        if (notional >= BigInt(state.hello.fees.min_notional_quote_units) && notional > 0n) {
          orders.push({ side: 'buy', symbol, notional_quote_units: notional, max_slippage_bps: MAX_SLIPPAGE_BPS });
        }
      }
    }
  }
  return orders;
}

await runBars({ onBatch });
