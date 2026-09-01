# Support

## Documentation

Start at <https://bitcoinuniverseio.github.io/alkanes/>. Search is in the header, and pressing `/` focuses it.

| I want to | Go to |
|---|---|
| Build a transfer payload | [Encoding](https://bitcoinuniverseio.github.io/alkanes/encoding.html) |
| Check a payload before signing | [Tool](https://bitcoinuniverseio.github.io/alkanes/tool.html) |
| Implement an indexer or encoder | [Specification](https://bitcoinuniverseio.github.io/alkanes/specification.html) and [Test vectors](https://bitcoinuniverseio.github.io/alkanes/test-vectors.html) |
| Understand transfer, call, or deploy | [Guide](https://bitcoinuniverseio.github.io/alkanes/guide.html) |
| Understand reorg, mempool, or limits | [Reference](https://bitcoinuniverseio.github.io/alkanes/reference.html) |

## Where to ask

| Topic | Where |
|---|---|
| An error or gap in this documentation | [Open an issue here](https://github.com/bitcoinuniverseio/alkanes/issues) |
| The protocol implementation or indexer | [bitcoinuniverseio/alkanes-rs](https://github.com/bitcoinuniverseio/alkanes-rs) |
| Upstream protocol questions | [ALKANES wiki](https://github.com/kungfuflex/alkanes-rs/wiki) and [protorunes wiki](https://github.com/kungfuflex/protorune/wiki) |
| Other Bitcoin Universe documentation | <https://docs.bitcoinuniverse.io> |
| A security vulnerability | [Privately](https://github.com/bitcoinuniverseio/alkanes/security/advisories/new), see [SECURITY.md](SECURITY.md) |

## What this project cannot help with

- **Recovering a lost balance.** If a transaction confirmed with a wrong payload, the outcome is final. There
  is no protocol mechanism to reverse it and no key that can undo it. This is why the encoding page exists.
- **Deciding whether an alkane is worth anything.** Contracts can mint their own token without a
  protocol-level cap; supply control lives entirely in contract code. Nothing here is financial advice.
- **Third-party wallet or marketplace behaviour.** Those are outside this organisation's code.
- **Running an indexer for you.** The reference implementation and its build instructions are in alkanes-rs.

## Before you report a problem

If a transaction did not do what you expected:

1. Decode the `OP_RETURN` script with the [tool](https://bitcoinuniverseio.github.io/alkanes/tool.html).
2. Check the script begins `6a 5d` and the protocol tag is `1`.
3. Check the alkane id, the amount in base units, and the output index.
4. Look at the execution trace through the `trace` view function; a revert carries a readable message after
   the four-byte `08 c3 79 a0` prefix.

Include the decoded output in your report.
