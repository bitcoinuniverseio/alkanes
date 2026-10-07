# Alkanes protocol documentation

## Indexer recovery and freshness

Consumers must distinguish a running Alkanes API from a ready, current indexer.
During recovery, honor the readiness response and checkpoint: an upstream
behind the stored ledger waits for catch-up without rewinding that ledger.
The reader's height compatibility path uses only the configured Universe-owned
Alkanes runtime and preserves the shared Bitcoin RPC scope and all data guards.
Automated release checks use the primary Universe-owned self-hosted fleet;
a runner disconnect before tests run does not count as a verified release.

Authoritative documentation for **Alkanes**, a Bitcoin metaprotocol that runs WebAssembly smart contracts over
Bitcoin. Token balances are carried as protorunes inside protostones, and a protostone rides inside a runestone
in an `OP_RETURN` output.

**Live site: <https://bitcoinuniverseio.github.io/alkanes/>**

| | |
|---|---|
| Chain | Bitcoin |
| Network | mainnet, alkanes genesis height 880,000; regtest |
| Protocol tag | `1` |
| Carrier | `OP_RETURN` runestone, script begins `6a 5d` |
| Implementation | [bitcoinuniverseio/alkanes-rs](https://github.com/bitcoinuniverseio/alkanes-rs) 2.2.1-rc.4 |
| Lifecycle | experimental |
| Document version | 1.0.0 |
| Last verified | 2026-09-01 |

## The one thing to get right

An alkanes transfer payload is an **encoded protostone**, not JSON. The output script must begin `6a 5d`,
`OP_RETURN` followed by `OP_PUSHNUM_13`.

```
6a5d0dff7f818a80909080a0e1d7df04
```

That is the whole script for moving `100000000` base units of alkane `2:1` to output 1. It is what the ts-sdk
emits for:

```ts
encodeRunestoneProtostone({
  protostones: [
    ProtoStone.edicts({
      protocolTag: 1n,
      edicts: [{ id: new ProtoruneRuneId(2n, 1n), amount: 100000000n, output: 1 }],
    }),
  ],
});
```

A plain `6a` `OP_RETURN` carrying JSON is **not** a protostone. alkanes-rs never reads it, so the balance is
neither moved nor cleared: it stays recorded against an outpoint that has just been spent and is unreachable
from then on. A valid runestone whose only protostone carries a protocol tag other than `1` is worse, because
processing runs, nothing claims the balances, and every input balance sheet is cleared. See
[encoding.html](https://bitcoinuniverseio.github.io/alkanes/encoding.html).

## Pages

| Page | What it covers |
|---|---|
| [Overview](https://bitcoinuniverseio.github.io/alkanes/) | What Alkanes is, transaction anatomy, support state, entry points |
| [Encoding](https://bitcoinuniverseio.github.io/alkanes/encoding.html) | The exact byte layout, with worked byte-level examples |
| [Specification](https://bitcoinuniverseio.github.io/alkanes/specification.html) | Numbered normative rules traced to alkanes-rs source |
| [Guide](https://bitcoinuniverseio.github.io/alkanes/guide.html) | Transfer, call, deploy, support matrix, common mistakes |
| [Reference](https://bitcoinuniverseio.github.io/alkanes/reference.html) | Terminology, metashrew indexing, reorg, mempool, limits, security |
| [Test vectors](https://bitcoinuniverseio.github.io/alkanes/test-vectors.html) | Ten valid and nine invalid vectors with expected outcomes |
| [Tool](https://bitcoinuniverseio.github.io/alkanes/tool.html) | Client-side protostone encoder and decoder |
| [Changelog](https://bitcoinuniverseio.github.io/alkanes/changelog.html) | Document history and mainnet behaviour-change heights |

## Support in Bitcoin Universe products

Only capability declared in this organisation's own code is listed.

| Surface | Actions | State |
|---|---|---|
| Core, main | view, discover, view collection, view activity, view transaction | Supported |
| Wallet | view, send, receive | Supported |
| Inscribe | mint | Supported |
| Marketplace, reads | view, view collection, view activity | Read-only |
| Marketplace, mutations | list, update listing, unlist, buy, make offer, accept offer, cancel offer, sell, settle, reconcile | Not supported |

Recorded reason for the unsupported actions, verbatim: "Alkanes mutations remain read-only until exact Alkane
state, transferability, builder, signed-transaction validation, broadcast, settlement, and reorg recovery are
deployed and proven."

Third-party wallets and marketplaces are outside this organisation's code, so this documentation makes no claim
about them either way.

## Universe indexing recovery

As of 7 October 2026, the Universe Alkanes mainnet state producer is running and
replaying from protocol genesis at block 880000 using Universe-operated Bitcoin
infrastructure. Successful indexing establishes recovery progress, not complete
historical coverage or readiness of every product capability. Consumers must
respect checkpoint, lag and publication guards while the replay catches up.

See the [current public recovery notes](https://github.com/bitcoinuniverseio/docs-alkanes/blob/develop/README.md#state-producer-recovery-7-october-2026).
This operational status does not change the protocol specification or the
unsupported Marketplace mutation capabilities listed above.

## Facts that are commonly stated wrongly

- Amounts are raw `u128` base units. Divisibility is **asset-defined**; there is no fixed decimal scale.
- An edict amount of `0` means the entire remaining balance, not zero.
- An edict body whose length is not a multiple of four produces an **empty** edict list with no error surfaced.
- Message calldata is zero-padded to whole 15-byte chunks, and the padding decodes to extra zero-valued inputs.
- A protostone occupies virtual output `N + 1 + i` for a transaction with `N` real outputs.
- Protoburns (tags 83 and 95) are parsed but not processed by the released indexer.
- Alkanes has no network token. Compute is metered with wasmi fuel; fees are Bitcoin fees.

## Origin and attribution

Alkanes did not originate at Bitcoin Universe. The protocol and its reference Rust implementation come from the
upstream `kungfuflex/alkanes-rs` project, which also hosts the protocol wiki. Alkanes is a sub-protocol of
[protorunes](https://github.com/kungfuflex/protorune/wiki), which extends Runes; both originated outside this
organisation. [bitcoinuniverseio/alkanes-rs](https://github.com/bitcoinuniverseio/alkanes-rs) is this
organisation's implementation repository and is the source every statement on the site is checked against.

## This repository

Static HTML, CSS, and vanilla JavaScript. No build step, no framework, no external CDNs, no external fonts, no
trackers. Deployed by GitHub Pages from `main` at the repository root.

```
index.html  encoding.html  specification.html  guide.html
reference.html  test-vectors.html  tool.html  changelog.html  404.html
theme.css  site.js  protostone.js
search-index.json  llms.txt  sitemap.xml  robots.txt  docs.manifest.json
favicon.svg  og.svg
```

Every ordinary page works with JavaScript disabled. JavaScript only adds search, the theme toggle, and the
protostone tool. To work on the site, open the files directly or serve the directory with any static server.

`search-index.json` is generated from the page headings. If you add or rename a heading, regenerate it rather
than editing it by hand.

## Contributing, support, security

- [CONTRIBUTING.md](CONTRIBUTING.md)
- [SUPPORT.md](SUPPORT.md)
- [SECURITY.md](SECURITY.md), including private vulnerability reporting

Central Bitcoin Universe documentation portal: <https://docs.bitcoinuniverse.io>

## Licence

Documentation is MIT licensed, see [LICENSE](LICENSE). The Alkanes protocol implementation is licensed
separately in [alkanes-rs](https://github.com/bitcoinuniverseio/alkanes-rs).
