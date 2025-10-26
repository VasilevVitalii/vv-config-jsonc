<div id="badges">
  <a href="https://www.linkedin.com/in/vasilev-vitalii/">
    <img src="https://img.shields.io/badge/LinkedIn-blue?style=for-the-badge&logo=linkedin&logoColor=white" alt="LinkedIn Badge"/>
  </a>
  <a href="https://www.youtube.com/@user-gj9vk5ln5c/featured">
    <img src="https://img.shields.io/badge/YouTube-red?style=for-the-badge&logo=youtube&logoColor=white" alt="Youtube Badge"/>
  </a>
</div>

# vv-config-jsonc

### Based on:

-   @sinclair/typebox
-   jsonc-parser

A tiny utility to generate and maintain human‑friendly JSONC configuration files from TypeBox schemas.

-   Generates a JSONC template from a TypeBox schema (defaults inserted, descriptions rendered as line comments).
-   Reads existing JSONC, adds missing fields, preserves unknown user keys, and validates with TypeBox.
-   Optional fields with null are treated as “missing” for validation (no false‑positive errors).
-   Arrays in getConfig: when a missing array field is added, it becomes [] (not a default sample). Existing array items get missing fields filled (from item defaults or null).
-   Stable formatting (4 spaces), non‑destructive edits, comment normalization.

## License

_MIT_

## Install

```
npm i vv-config-jsonc
```

## Quick start

```TypeScript
import { vvConfigJsonc, Type } from 'vv-config-jsonc'

const SConf = Type.Object({
    host: Type.String({ description: 'Database host', default: 'localhost' }),
    port: Type.Integer({ description: 'Port', default: 5432 }),
    debug: Type.Boolean({ description: 'Enable debug', default: false }),
    note: Type.Optional(Type.String({ description: 'Optional note' })),
    someParam: Type.String({ description: 'some param with length >= 3', default: 'abcd', minLength: 3 }),
})

const configurator = new vvConfigJsonc(SConf)

// 1) Generate a JSONC template (defText) and a fully-typed default object
const { defText, defConfig } = configurator.getDefault()
// write defText to config.jsonc if you want

// 2) Read an existing partial JSONC string and complete it
const input = `{
  //Database host
  "host": "db.internal",
  //some param with length >= 3
  "someParam": "a"
}`

const { text, config, errors, changed } = configurator.getConfig(input)
// text  -> completed, formatted JSONC with comments
// config -> parsed object matching Static<typeof SConf>
// errors -> validation errors (if any)
// changed -> true if fields were added

```
