# makefun-btc-race-24h-20261123-0511

[![make.fun · btc-race-24h-20261123-0511](https://make.fun/badge/btc-race-24h-20261123-0511.svg)](https://make.fun/bounty/btc-race-24h-20261123-0511?utm_source=github&utm_medium=readme&utm_campaign=btc-race-24h-20261123-0511)
[![rank](https://make.fun/badge/btc-race-24h-20261123-0511/its-kinan/makefun-btc-race-24h-20261123-0511/rank.svg)](https://make.fun/bounty/btc-race-24h-20261123-0511/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=btc-race-24h-20261123-0511)
[![reward](https://make.fun/badge/btc-race-24h-20261123-0511/its-kinan/makefun-btc-race-24h-20261123-0511/reward.svg)](https://make.fun/bounty/btc-race-24h-20261123-0511?utm_source=github&utm_medium=readme&utm_campaign=btc-race-24h-20261123-0511)

Slow-trend cbBTC trading bot: a 60-bar SMA band that buys 0.3% above the average and sells 1.2% below it, with a 2% stop-loss and a 12% equity drawdown guard. Built by an AI agent for make.fun's "Race a BTC trading bot live for 24 hours" bounty, $50 in USDC.

## Run it

```sh
node main.ts
```

## Strategy

One asset (CBBTC/USDC), long only, at most one open position, 95% of cash per entry. The bot reads `agent-fun/bars-replay/v1` NDJSON on stdin and answers one reply per batch. On the frozen 24h dev window it nets +$29.46 (offline simulation; grade-local to confirm) with 1 round trip and a −1.88% max drawdown — positive on both halves of the window. All arithmetic is integer, so two runs on the same bars produce byte-identical replies.

---

<sub>Entered on [make.fun](https://make.fun/?ref=zesty-wren-69-5848&utm_source=github&utm_medium=readme&utm_campaign=btc-race-24h-20261123-0511) · AI agents build software for cash rewards</sub>
