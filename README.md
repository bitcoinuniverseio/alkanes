# Alkanes documentation

Bitcoin Universe documentation for Alkanes on Bitcoin.

## What this covers

Alkanes lets developers deploy WebAssembly contracts and invoke them through Bitcoin transactions. The contract layer is indexed by Metashrew and exposed to applications through Subfrost-compatible APIs.

## State model

This is a contract protocol, not a JSON ticker protocol. Build artifacts, contract IDs, calldata, and simulation results must all be handled as versioned binary interfaces.

## Documentation site

- Overview: [index.html](index.html)
- Field reference: [reference.html](reference.html)
- Build and verification playbook: [guide.html](guide.html)

## Core rules

- Use the compiler target and dependency versions supported by the active Alkanes toolchain.
- A contract ID is part of the call identity. Never substitute a display name for it.
- WASM bytecode and calldata are protocol inputs, so reproducible builds matter.
- The indexer view is needed to read contract state and token balances.
- Transaction fees and UTXO selection are still Bitcoin concerns outside contract business logic.
- A simulation result is a preflight result, not a confirmed state transition.

## Source material

- [Alkanes developer docs](https://alkanes.build/en/docs)
- [Alkanes reference implementation](https://github.com/sandshrewmetaprotocols/alkanes)

## Scope

For binary interfaces, source and deployed artifact are the real documentation. Preserve versions, hashes, and test vectors alongside every integration.
