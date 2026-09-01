/* Alkanes protostone encoder / decoder.
   Pure client-side. Nothing you paste here is stored, logged, or sent anywhere:
   this file makes no network requests at all.

   Encoding rules mirror bitcoinuniverseio/alkanes-rs:
     ts-sdk/src/protostone/runestone.ts   (RunestoneProtostoneUpgrade.encipher)
     ts-sdk/src/protostone/protostone.ts  (ProtoStone.encipher_payloads)
     ts-sdk/src/protostone/bytes.ts       (encodeVarInt, unpack)
     crates/protorune-support/src/protostone.rs (Protostone::decipher, to_fields)
     crates/ordinals/src/runestone/tag.rs (Tag)
*/
(function () {
  'use strict';

  var OP_RETURN = 0x6a, OP_PUSHNUM_13 = 0x5d;
  var TAG_PROTOCOL = 16383n, TAG_BODY = 0n;
  var TAG_MESSAGE = 81n, TAG_BURN = 83n, TAG_POINTER = 91n, TAG_REFUND = 93n, TAG_FROM = 95n;
  var MAX_PUSH = 520;

  var PROTOSTONE_TAGS = {
    '0': ['Body', 'Edicts follow. Every remaining value belongs to the edict body.'],
    '81': ['Message', 'One 15-byte chunk of the cellpack calldata handed to the alkanes VM.'],
    '83': ['Burn', 'Protoburn: bridges rune balances from the Runes layer into this protocol.'],
    '91': ['ProtoPointer', 'Output index that receives the successful result of the message.'],
    '93': ['Refund', 'Output index that receives the balances if the message fails.'],
    '95': ['From', 'Edict index selector used by protoburns.']
  };

  var RUNESTONE_TAGS = {
    '0': 'Body (Runes-layer edicts)', '1': 'Divisibility', '2': 'Flags', '3': 'Spacers',
    '4': 'Rune', '5': 'Symbol', '6': 'Premine', '8': 'Cap', '10': 'Amount',
    '12': 'HeightStart', '14': 'HeightEnd', '16': 'OffsetStart', '18': 'OffsetEnd',
    '20': 'Mint', '22': 'Pointer', '126': 'Cenotaph', '127': 'Nop', '16383': 'Protocol (protostone payload)'
  };

  /* ---------------- primitives ---------------- */

  function encodeVarInt(v) {
    var out = [];
    while (v >> 7n > 0n) { out.push(Number(v & 0xffn) | 0x80); v >>= 7n; }
    out.push(Number(v & 0x7fn));
    return out;
  }

  function encipher(vals) {
    var out = [];
    for (var i = 0; i < vals.length; i++) out = out.concat(encodeVarInt(vals[i]));
    return out;
  }

  /* LEB128 decode with the same limits as crates/ordinals/src/varint.rs */
  function decipher(bytes) {
    var out = [], i = 0;
    while (i < bytes.length) {
      var result = 0n, j = 0, done = false;
      for (; j <= 18 && i < bytes.length; j++) {
        var b = bytes[i++];
        var value = BigInt(b & 0x7f);
        if (j === 18 && (value & 0x7cn) !== 0n) throw new Error('varint overflow at byte ' + (i - 1));
        result |= value << BigInt(7 * j);
        if ((b & 0x80) === 0) { done = true; break; }
      }
      if (!done) throw new Error('unterminated or overlong varint at byte ' + (i - 1));
      out.push(result);
    }
    return out;
  }

  /* 15-byte little-endian chunking. Mirrors unpack() / split_bytes(). */
  function unpack(bytes) {
    var groups = [], out = [];
    for (var i = 0; i < bytes.length; i++) {
      if (i % 15 === 0) groups.push([]);
      groups[groups.length - 1].push(bytes[i]);
    }
    for (var g = 0; g < groups.length; g++) {
      var v = 0n;
      for (var k = groups[g].length - 1; k >= 0; k--) v = (v << 8n) | BigInt(groups[g][k]);
      out.push(v);
    }
    return out;
  }

  /* Inverse: take the low 15 bytes of each u128, little-endian. Mirrors join_to_bytes(). */
  function joinToBytes(vals) {
    var out = [];
    for (var i = 0; i < vals.length; i++) {
      var v = vals[i];
      for (var b = 0; b < 15; b++) { out.push(Number(v & 0xffn)); v >>= 8n; }
    }
    return out;
  }

  function toHex(bytes) {
    var s = '';
    for (var i = 0; i < bytes.length; i++) s += bytes[i].toString(16).padStart(2, '0');
    return s;
  }

  function fromHex(str) {
    var s = String(str).replace(/^0[xX]/, '').replace(/[\s:,_]/g, '');
    if (!s.length) throw new Error('empty input');
    if (!/^[0-9a-fA-F]+$/.test(s)) throw new Error('input contains characters that are not hexadecimal');
    if (s.length % 2) throw new Error('hex string has an odd number of characters');
    var out = [];
    for (var i = 0; i < s.length; i += 2) out.push(parseInt(s.substr(i, 2), 16));
    return out;
  }

  function pushdata(bytes) {
    var n = bytes.length, out;
    if (n < 0x4c) out = [n];
    else if (n <= 0xff) out = [0x4c, n];
    else out = [0x4d, n & 0xff, (n >> 8) & 0xff];
    return out.concat(bytes);
  }

  /* ---------------- encode ---------------- */

  function buildEdictProtostone(protocolTag, edicts) {
    var p = [];
    if (edicts.length) {
      p.push(TAG_BODY);
      var sorted = edicts.slice().sort(function (a, b) {
        return a.block === b.block ? (a.tx < b.tx ? -1 : a.tx > b.tx ? 1 : 0) : (a.block < b.block ? -1 : 1);
      });
      var pb = 0n, pt = 0n;
      for (var i = 0; i < sorted.length; i++) {
        var e = sorted[i];
        var dblock = e.block - pb;
        if (dblock < 0n) throw new Error('edict ids must be non-decreasing');
        var dtx = dblock === 0n ? e.tx - pt : e.tx;
        if (dtx < 0n) throw new Error('edict ids must be non-decreasing');
        p.push(dblock, dtx, e.amount, e.output);
        pb = e.block; pt = e.tx;
      }
    }
    return [protocolTag, BigInt(p.length)].concat(p);
  }

  function buildScript(protostoneIntegers) {
    var inner = encipher(protostoneIntegers);
    var chunks = unpack(inner);
    var outer = [];
    for (var i = 0; i < chunks.length; i++) { outer.push(TAG_PROTOCOL); outer.push(chunks[i]); }
    var payload = encipher(outer);
    var script = [OP_RETURN, OP_PUSHNUM_13];
    for (var o = 0; o < payload.length; o += MAX_PUSH) {
      script = script.concat(pushdata(payload.slice(o, o + MAX_PUSH)));
    }
    return { inner: inner, chunks: chunks, outer: outer, payload: payload, script: script };
  }

  /* ---------------- decode ---------------- */

  function readPushes(bytes, start) {
    var payload = [], i = start;
    while (i < bytes.length) {
      var op = bytes[i++];
      var len;
      if (op >= 0x01 && op <= 0x4b) { len = op; }
      else if (op === 0x4c) { if (i >= bytes.length) throw new Error('truncated OP_PUSHDATA1'); len = bytes[i++]; }
      else if (op === 0x4d) { if (i + 1 >= bytes.length) throw new Error('truncated OP_PUSHDATA2'); len = bytes[i] | (bytes[i + 1] << 8); i += 2; }
      else if (op === 0x4e) { if (i + 3 >= bytes.length) throw new Error('truncated OP_PUSHDATA4'); len = bytes[i] | (bytes[i + 1] << 8) | (bytes[i + 2] << 16) | (bytes[i + 3] * 16777216); i += 4; }
      else { throw new Error('opcode 0x' + op.toString(16).padStart(2, '0') + ' at byte ' + (i - 1) + ' is not a data push; a runestone payload may only contain data pushes'); }
      if (i + len > bytes.length) throw new Error('data push at byte ' + (i - 1) + ' claims ' + len + ' bytes but only ' + (bytes.length - i) + ' remain');
      payload = payload.concat(bytes.slice(i, i + len));
      i += len;
    }
    return payload;
  }

  /* Mirrors to_fields(): pairs, and tag 0 swallows the rest as the body. */
  function toFields(values) {
    var map = {}, i = 0;
    var order = [];
    while (i + 1 < values.length) {
      var key = values[i], val = values[i + 1];
      i += 2;
      var k = key.toString();
      if (!map[k]) { map[k] = []; order.push(k); }
      if (key === 0n) { map[k].push(val); for (; i < values.length; i++) map[k].push(values[i]); break; }
      map[k].push(val);
    }
    return { map: map, order: order, trailing: i < values.length ? values.slice(i) : [] };
  }

  function edictsFromIntegers(vals) {
    if (vals.length % 4 !== 0) throw new Error('edict values did not appear in sets of four');
    var last = { block: 0n, tx: 0n }, out = [];
    for (var i = 0; i < vals.length; i += 4) {
      var block = last.block + vals[i];
      var tx = vals[i] === 0n ? last.tx + vals[i + 1] : vals[i + 1];
      out.push({ block: block, tx: tx, amount: vals[i + 2], output: vals[i + 3] });
      last = { block: block, tx: tx };
    }
    return out;
  }

  function decodeScript(hex) {
    var bytes = fromHex(hex);
    var r = { bytes: bytes, notes: [], errors: [], protostones: [], runestoneFields: [] };

    if (bytes[0] !== OP_RETURN) {
      r.errors.push('First byte is 0x' + (bytes[0] || 0).toString(16).padStart(2, '0') +
        ', not 0x6a (OP_RETURN). This is not an OP_RETURN output, so it carries no runestone.');
      return r;
    }
    if (bytes.length < 2 || bytes[1] !== OP_PUSHNUM_13) {
      r.errors.push('Second byte is ' + (bytes.length < 2 ? 'missing' : '0x' + bytes[1].toString(16).padStart(2, '0')) +
        ', not 0x5d (OP_PUSHNUM_13). An OP_RETURN without the OP_PUSHNUM_13 magic is not a runestone. ' +
        'alkanes-rs skips it entirely: no protostone is read, no protorune balance moves, and any alkanes in the ' +
        'inputs stay assigned to the spent outpoints in the index. A JSON blob after a bare 6a is not a protostone.');
      return r;
    }
    r.notes.push('Bytes 0-1 are 6a 5d: OP_RETURN followed by OP_PUSHNUM_13, the runestone envelope.');

    var payload;
    try { payload = readPushes(bytes, 2); }
    catch (e) { r.errors.push(e.message); return r; }
    r.payload = payload;

    var outer;
    try { outer = decipher(payload); }
    catch (e) { r.errors.push('Runestone payload: ' + e.message); return r; }
    r.outer = outer;

    /* split the runestone message into fields and its own edict body */
    var protocolChunks = [];
    var i = 0;
    while (i + 1 < outer.length) {
      var tag = outer[i], val = outer[i + 1];
      if (tag === 0n) {
        r.runestoneFields.push({ tag: 0n, name: 'Body (Runes-layer edicts)', value: null, count: outer.length - i - 1 });
        break;
      }
      i += 2;
      if (tag === TAG_PROTOCOL) { protocolChunks.push(val); }
      else {
        r.runestoneFields.push({
          tag: tag, name: RUNESTONE_TAGS[tag.toString()] || 'unrecognised tag', value: val
        });
      }
    }
    if (!protocolChunks.length) {
      r.errors.push('The runestone contains no tag 16383 (Protocol) field, so it carries no protostone. ' +
        'alkanes-rs finds nothing to execute and no protorune balance is moved.');
      return r;
    }
    r.protocolChunks = protocolChunks;

    var innerBytes = joinToBytes(protocolChunks);
    r.innerBytes = innerBytes;
    var inner;
    try { inner = decipher(innerBytes); }
    catch (e) { r.errors.push('Protostone payload: ' + e.message); return r; }
    r.inner = inner;

    /* Protostone::decipher */
    var p = 0;
    while (p < inner.length) {
      var protocolTag = inner[p++];
      if (protocolTag === 0n) break;
      if (p >= inner.length) { r.errors.push('Protostone with protocol tag ' + protocolTag + ' has no length field.'); break; }
      var length = inner[p++];
      var n = Number(length);
      if (p + n > inner.length) {
        r.errors.push('Protostone with protocol tag ' + protocolTag + ' declares ' + n +
          ' values but only ' + (inner.length - p) + ' remain. alkanes-rs rejects the whole protostone list with "less values than expected".');
        break;
      }
      var values = inner.slice(p, p + n);
      p += n;

      var f = toFields(values);
      var st = { protocolTag: protocolTag, length: length, values: values, fields: [], edicts: [], edictError: null };

      for (var oi = 0; oi < f.order.length; oi++) {
        var k = f.order[oi];
        var meta = PROTOSTONE_TAGS[k];
        st.fields.push({ tag: BigInt(k), name: meta ? meta[0] : 'unrecognised tag', help: meta ? meta[1] : 'alkanes-rs ignores protostone tags it does not recognise.', values: f.map[k] });
      }

      if (f.map['0']) {
        try { st.edicts = edictsFromIntegers(f.map['0']); }
        catch (e) {
          st.edictError = e.message;
          st.edicts = [];
        }
      }
      if (f.map['81']) {
        st.calldataBytes = joinToBytes(f.map['81']);
        try { st.cellpack = decipher(st.calldataBytes).filter(function (v, idx, arr) { return true; }); }
        catch (e) { st.cellpackError = e.message; }
      }
      if (f.map['91']) st.pointer = f.map['91'][0];
      if (f.map['93']) st.refund = f.map['93'][0];
      if (f.map['83']) st.burn = f.map['83'][0];
      if (f.map['95']) st.from = f.map['95'][0];

      r.protostones.push(st);
    }

    if (!r.protostones.length && !r.errors.length) {
      r.errors.push('The protostone payload decoded to no protostones. The first protocol tag was zero, which alkanes-rs treats as end-of-list.');
    }
    return r;
  }

  /* ---------------- rendering ---------------- */

  function esc(s) {
    return String(s).replace(/[&<>"]/g, function (c) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]; });
  }

  function box(cls, title, html) {
    return '<div class="' + cls + '"><span class="t">' + esc(title) + '</span>' + html + '</div>';
  }

  function hexRow(label, bytes) {
    return '<h4>' + esc(label) + ' <span class="muted small">(' + bytes.length + ' bytes)</span></h4>' +
      '<pre class="hexblock"><code>' + toHex(bytes) + '</code></pre>';
  }

  function intList(vals) {
    return '<pre class="hexblock"><code>[' + vals.map(function (v) { return v.toString(); }).join(', ') + ']</code></pre>';
  }

  function renderDecode(r) {
    var h = '';
    if (r.errors.length) {
      h += box('danger', 'Not a usable alkanes payload', '<ul>' + r.errors.map(function (e) { return '<li>' + esc(e) + '</li>'; }).join('') + '</ul>');
    }
    if (r.notes.length) {
      h += '<ul class="small">' + r.notes.map(function (n) { return '<li>' + esc(n) + '</li>'; }).join('') + '</ul>';
    }
    if (r.payload) h += hexRow('Runestone payload (concatenated data pushes)', r.payload);
    if (r.outer) { h += '<h4>Runestone integers (LEB128 decoded)</h4>' + intList(r.outer); }

    if (r.runestoneFields && r.runestoneFields.length) {
      h += '<h4>Runes-layer fields</h4><div class="tablewrap"><table><thead><tr><th>Tag</th><th>Meaning</th><th>Value</th></tr></thead><tbody>' +
        r.runestoneFields.map(function (f) {
          return '<tr><td><code>' + f.tag + '</code></td><td>' + esc(f.name) + '</td><td>' +
            (f.value === null ? '<span class="muted">' + f.count + ' trailing values</span>' : '<code>' + f.value + '</code>') + '</td></tr>';
        }).join('') + '</tbody></table></div>';
    }

    if (r.protocolChunks) {
      h += '<h4>Tag 16383 (Protocol) chunks</h4>' + intList(r.protocolChunks) +
        '<p class="small muted">Each chunk is 15 bytes of the protostone byte stream, read little-endian. ' +
        'The 16th byte of a u128 is never used, which keeps every value inside the runestone varint limits.</p>';
      h += hexRow('Protostone byte stream', r.innerBytes);
      h += '<h4>Protostone integers</h4>' + intList(r.inner);
    }

    for (var i = 0; i < r.protostones.length; i++) {
      var st = r.protostones[i];
      h += '<h3>Protostone ' + (i + 1) + ' of ' + r.protostones.length + '</h3>';
      var tagNote = st.protocolTag === 1n
        ? '<span class="yes">protocol tag 1: alkanes</span>'
        : '<span class="no">protocol tag ' + st.protocolTag + ' is not alkanes</span>. alkanes-rs only handles tag 1. ' +
          'If this is the only protostone, the alkanes indexer finds no protostone of its own but the runestone is still valid, so it clears the alkane balances on the spent inputs and they are destroyed.';
      h += '<p class="small">' + tagNote + ' &middot; declared length ' + st.length + ' values.</p>';

      h += '<div class="tablewrap"><table><thead><tr><th>Tag</th><th>Field</th><th>Values</th><th>Meaning</th></tr></thead><tbody>' +
        st.fields.map(function (f) {
          return '<tr><td><code>' + f.tag + '</code></td><td>' + esc(f.name) + '</td><td><code>' +
            f.values.map(function (v) { return v.toString(); }).join(', ') + '</code></td><td class="small">' + esc(f.help) + '</td></tr>';
        }).join('') + '</tbody></table></div>';

      if (st.edictError) {
        h += box('danger', 'Edict body is malformed', '<p>' + esc(st.edictError) +
          '. alkanes-rs does not fail the transaction for this: <code>Protostone::from_fields_and_tag</code> discards the error and the protostone ends up with an empty edict list, so the intended transfer silently does not happen.</p>');
      }
      if (st.edicts.length) {
        h += '<h4>Edicts</h4><div class="tablewrap"><table><thead><tr><th>#</th><th>Alkane id</th><th>Amount</th><th>Output</th><th>Reading</th></tr></thead><tbody>' +
          st.edicts.map(function (e, n) {
            var reading = e.amount === 0n
              ? 'Amount 0 means the entire remaining balance of ' + e.block + ':' + e.tx + ' at this point in edict processing'
              : 'Move ' + e.amount + ' base units of ' + e.block + ':' + e.tx;
            return '<tr><td>' + (n + 1) + '</td><td><code>' + e.block + ':' + e.tx + '</code></td><td><code>' + e.amount +
              '</code></td><td><code>' + e.output +
              '</code></td><td class="small">' + esc(reading) + ', to output ' + e.output + '.</td></tr>';
          }).join('') + '</tbody></table></div>';
      }
      if (st.calldataBytes) {
        h += hexRow('Message calldata (cellpack)', st.calldataBytes);
        if (st.cellpack && st.cellpack.length >= 2) {
          var t = st.cellpack;
          var inputs = t.slice(2);
          h += '<div class="tablewrap narrow"><table><thead><tr><th>Part</th><th>Value</th><th>Meaning</th></tr></thead><tbody>' +
            '<tr><td>target.block</td><td><code>' + t[0] + '</code></td><td class="small">' + esc(blockMeaning(t[0])) + '</td></tr>' +
            '<tr><td>target.tx</td><td><code>' + t[1] + '</code></td><td class="small">Second half of the AlkaneId.</td></tr>' +
            (inputs.length ? '<tr><td>inputs[0]</td><td><code>' + inputs[0] + '</code></td><td class="small">Opcode. The contract dispatches on this value.</td></tr>' : '') +
            inputs.slice(1).map(function (v, n) { return '<tr><td>inputs[' + (n + 1) + ']</td><td><code>' + v + '</code></td><td class="small">Argument.</td></tr>'; }).join('') +
            '</tbody></table></div>';
        } else if (st.cellpackError) {
          h += box('danger', 'Calldata is not a valid cellpack', '<p>' + esc(st.cellpackError) + '</p>');
        } else {
          h += box('danger', 'Calldata is not a valid cellpack',
            '<p>The calldata decodes to ' + (st.cellpack ? st.cellpack.length : 0) +
            ' value(s). A cellpack needs at least two, the target block and the target tx. alkanes-rs rejects this ' +
            'before execution, skips the protostone, and refunds to the refund pointer.</p>');
        }
      }
      if (st.pointer !== undefined || st.refund !== undefined) {
        h += '<p class="small">Pointer ' + (st.pointer === undefined ? '<span class="muted">absent</span>' : '<code>' + st.pointer + '</code>') +
          ' receives the result on success; refund pointer ' + (st.refund === undefined ? '<span class="muted">absent</span>' : '<code>' + st.refund + '</code>') +
          ' receives the balances if the message reverts.</p>';
      }
      if (st.burn !== undefined) {
        h += '<p class="small">Burn field present (<code>' + st.burn + '</code>): this protostone is a protoburn that bridges Runes-layer balances into protocol ' + st.protocolTag + '.</p>';
      }
    }
    return h;
  }

  function blockMeaning(b) {
    var m = {
      '0': 'Null / non-contract.', '1': 'CREATE: deploy the WASM binary carried in the first input witness.',
      '2': 'A sequentially numbered contract. tx is its sequence number.',
      '3': 'CREATERESERVED: deploy to reserved id [4, tx].',
      '4': 'A reserved-number contract.',
      '5': 'FACTORY from a sequence-numbered template.',
      '6': 'FACTORY from a reserved-number template.',
      '32': 'System precompiled contract.',
      '800000000': 'Virtual precompile (block header, coinbase, diesel mints, miner fee).'
    };
    return m[b.toString()] || 'Not a reserved block value; treated as a direct call to an existing contract id.';
  }

  /* ---------------- wiring ---------------- */

  function parseBig(str, what) {
    var s = String(str).trim();
    if (!/^\d+$/.test(s)) throw new Error(what + ' must be a whole non-negative number');
    return BigInt(s);
  }

  document.addEventListener('DOMContentLoaded', function () {
    var panelE = document.getElementById('panel-encode');
    var panelD = document.getElementById('panel-decode');
    if (!panelE || !panelD) return;

    var noscripts = document.querySelectorAll('.tool-needs-js');
    for (var i = 0; i < noscripts.length; i++) noscripts[i].hidden = false;
    var fallbacks = document.querySelectorAll('.tool-no-js');
    for (var j = 0; j < fallbacks.length; j++) fallbacks[j].hidden = true;

    var tabs = document.querySelectorAll('.tabs button');
    function select(id) {
      for (var t = 0; t < tabs.length; t++) {
        var on = tabs[t].getAttribute('data-panel') === id;
        tabs[t].setAttribute('aria-selected', on ? 'true' : 'false');
        tabs[t].setAttribute('tabindex', on ? '0' : '-1');
        document.getElementById(tabs[t].getAttribute('data-panel')).hidden = !on;
      }
    }
    for (var t2 = 0; t2 < tabs.length; t2++) {
      tabs[t2].addEventListener('click', function () { select(this.getAttribute('data-panel')); });
    }
    select('panel-encode');

    /* --- encode --- */
    var outE = document.getElementById('encode-out');
    document.getElementById('encode-form').addEventListener('submit', function (ev) {
      ev.preventDefault();
      outE.innerHTML = '';
      try {
        var tag = parseBig(document.getElementById('e-tag').value, 'Protocol tag');
        var block = parseBig(document.getElementById('e-block').value, 'Alkane id block');
        var tx = parseBig(document.getElementById('e-tx').value, 'Alkane id tx');
        var amount = parseBig(document.getElementById('e-amount').value, 'Amount');
        var output = parseBig(document.getElementById('e-output').value, 'Output index');

        var warn = [];
        if (tag !== 1n) warn.push('Protocol tag ' + tag + ' is not the alkanes tag. alkanes-rs implements MessageContext with protocol_tag() = 1. ' +
          'A protostone with any other tag is invisible to the alkanes indexer, but the runestone is still valid, so the indexer still clears the alkane balances on the spent inputs. The balances are destroyed.');
        if (block === 0n && tx > 0n) warn.push('An id with block 0 and a non-zero tx is rejected by ProtoruneRuneId::new, so this edict cannot address a real asset.');
        if (block === 0n && tx === 0n) warn.push('Id 0:0 is the null alkane. No balance is held under it.');
        if (amount === 0n) warn.push('Amount 0 does not mean "nothing". It means the entire remaining balance of this alkane at this point in edict processing.');
        if (amount > (2n ** 128n - 1n)) throw new Error('Amount exceeds the u128 range');
        if (output > 100000n) warn.push('Output index ' + output + ' is far beyond any plausible transaction. Protostone message vouts are capped at num_outputs + 100.');

        var integers = buildEdictProtostone(tag, [{ block: block, tx: tx, amount: amount, output: output }]);
        var b = buildScript(integers);
        var hex = toHex(b.script);

        var valid = b.script[0] === OP_RETURN && b.script[1] === OP_PUSHNUM_13;

        var h = '';
        h += box(valid && tag === 1n ? 'fact' : 'danger',
          valid && tag === 1n ? 'Valid alkanes protostone envelope' : 'Check this before broadcasting',
          '<p>Script starts <code>6a 5d</code>: ' + (valid ? '<span class="yes">yes</span>' : '<span class="no">no</span>') +
          '. Protocol tag: <code>' + tag + '</code>' + (tag === 1n ? ' <span class="yes">(alkanes)</span>' : ' <span class="no">(not alkanes)</span>') + '.</p>');

        if (warn.length) {
          h += box('danger', 'Warnings', '<ul>' + warn.map(function (w) { return '<li>' + esc(w) + '</li>'; }).join('') + '</ul>');
        }

        h += '<h4>OP_RETURN script hex <span class="muted small">(' + b.script.length + ' bytes)</span></h4>' +
          '<pre class="hexblock"><code><span class="hl">6a5d</span>' + hex.slice(4) + '</code></pre>';
        h += '<p class="small muted">Put this whole script in one output with value 0. The amount <code>' + amount +
          '</code> is in the alkane\'s own base units: divisibility is asset-defined, so the protocol layer never rescales it.</p>';

        h += '<h4>How it was built</h4><ol class="small">' +
          '<li>Protostone integers <code>[' + integers.map(String).join(', ') + ']</code>: protocol tag, field count, then tag 0 (Body) and the delta-encoded edict quadruple.</li>' +
          '<li>LEB128: <code>' + toHex(b.inner) + '</code> (' + b.inner.length + ' bytes).</li>' +
          '<li>Split into 15-byte little-endian chunks: <code>[' + b.chunks.map(String).join(', ') + ']</code>.</li>' +
          '<li>Each chunk becomes a runestone field with tag 16383: <code>[' + b.outer.map(String).join(', ') + ']</code>.</li>' +
          '<li>LEB128 again: <code>' + toHex(b.payload) + '</code> (' + b.payload.length + ' bytes), pushed after <code>6a 5d</code>.</li>' +
          '</ol>';

        h += '<h4>Equivalent ts-sdk call</h4><pre><code>' + esc(
          'const { encodedRunestone } = encodeRunestoneProtostone({\n' +
          '  protostones: [\n' +
          '    ProtoStone.edicts({\n' +
          '      protocolTag: ' + tag + 'n,\n' +
          '      edicts: [{\n' +
          '        id: new ProtoruneRuneId(' + block + 'n, ' + tx + 'n),\n' +
          '        amount: ' + amount + 'n,\n' +
          '        output: ' + output + ',\n' +
          '      }],\n' +
          '    }),\n' +
          '  ],\n' +
          '});') + '</code></pre>';

        outE.innerHTML = h;
      } catch (e) {
        outE.innerHTML = box('danger', 'Could not encode', '<p>' + esc(e.message) + '</p>');
      }
    });

    /* --- decode --- */
    var outD = document.getElementById('decode-out');
    document.getElementById('decode-form').addEventListener('submit', function (ev) {
      ev.preventDefault();
      outD.innerHTML = '';
      try {
        outD.innerHTML = renderDecode(decodeScript(document.getElementById('d-hex').value));
      } catch (e) {
        outD.innerHTML = box('danger', 'Could not decode', '<p>' + esc(e.message) + '</p>');
      }
    });

    var samples = document.querySelectorAll('[data-sample]');
    for (var s = 0; s < samples.length; s++) {
      samples[s].addEventListener('click', function () {
        select('panel-decode');
        var f = document.getElementById('d-hex');
        f.value = this.getAttribute('data-sample');
        f.focus();
        document.getElementById('decode-form').dispatchEvent(new Event('submit', { cancelable: true }));
      });
    }
  });
})();
