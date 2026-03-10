'use strict';
// ══════════════════════════════════════════════════════
//  TREAT REGISTRY
//  Maps treat IDs to { buildFn(ef, phase) } factories.
//  buildFn is called at config-parse time with the effect
//  string from the sheet, returning the runtime fn.
// ══════════════════════════════════════════════════════
const TREAT_REGISTRY = {};
