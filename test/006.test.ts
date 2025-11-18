import { vvConfigJsonc, Type, type Static } from '../src/index.js'
import { parse as jsoncParse } from 'jsonc-parser'

/**
 * These tests cover scenarios where users break the config file by making incorrect edits.
 * The library should handle these gracefully, either by fixing them or returning validation errors.
 */

enum EDdlKind {
    ORA = 'ORA',
}

enum EUseMode {
    INCLUDE = 'INCLUDE',
    EXCEPT = 'EXCEPT',
}

enum ELoggerMode {
    REWRITE = 'REWRITE',
    APPEND = 'APPEND',
}

const SConnectionOra = Type.Object({
    host: Type.String({ description: 'connection to Oracle', default: 'localhost' }),
    port: Type.Integer({ default: 1521 }),
    service: Type.String({ default: 'XEPDB1' }),
    login: Type.String({ default: 'USER' }),
    password: Type.String({ default: '123456' }),
    passwordCrypted: Type.Boolean({ description: 'use this app with arg --crypt <your_pass> for simple crypt pasword', default: false }),
})

const SConfigOra = Type.Object({
    kind: Type.Literal(EDdlKind.ORA, { description: 'specifies that this configuration is for Oracle Database' }),
    connection: SConnectionOra,
    objects: Type.Object({
        schema: Type.Object({
            list: Type.Array(Type.String(), { description: 'list of schemas to process', default: ['MY_SCHEMA1', 'MY_SCHEMA2'] }),
            mode: Type.Enum(EUseMode, { description: 'INCLUDE: process only schemas from the list; EXCEPT: process all schemas except those in the list', default: 'INCLUDE' }),
        }),
        sequence: Type.Object({
            dir: Type.String({ description: 'path template for storing sequence DDL scripts; supports placeholders {{schema}} and {{sequence}}', default: 'path/to/ddl/{{schema}}/SEQUENCE/{{schema}}.SEQ.{{sequence}}.sql' }),
        }),
        synonym: Type.Object({
            dir: Type.String({ description: 'path template for storing synonym DDL scripts; supports placeholders {{schema}} and {{synonym}}', default: 'path/to/ddl/{{schema}}/SYNONYM/{{schema}}.SYN.{{synonym}}.sql' }),
        }),
        job: Type.Object({
            dir: Type.String({ description: 'path template for storing job DDL scripts; supports placeholders {{schema}} and {{job}}', default: 'path/to/ddl/{{schema}}/JOB/{{schema}}.SEQ.{{job}}.sql' }),
        }),
    }),
})

const SConfig = Type.Object({
    log: Type.Object({
        dir: Type.String({ description: 'full path to log file', default: 'path/to/log' }),
        mode: Type.Enum(ELoggerMode, {
            description: 'REWRITE - write log to file "vv-ddl-gen.log"; APPEND - write log to files vv-ddl-gen.YYYYMMDD-HHMMSS.log',
            default: 'REWRITE',
        }),
    }),
    db: SConfigOra,
})

describe('User breaks config - various error scenarios', () => {
    const conf = new vvConfigJsonc(SConfig)

    test('User sets wrong type for port (string instead of number) - should return validation error', () => {
        const brokenConfig = `{
    "log": {
        "dir": "Z:/logs",
        "mode": "REWRITE"
    },
    "db": {
        "kind": "ORA",
        "connection": {
            "host": "localhost",
            "port": "fifteen twenty one",
            "service": "XEPDB1",
            "login": "USER",
            "password": "123"
        }
    }
}`

        const result = conf.getConfig(brokenConfig)

        // Should detect type mismatch
        expect(result.errors.length).toBeGreaterThan(0)
        expect(result.errors.some(e => e.includes('port') || e.includes('Expected number'))).toBe(true)

        // The output should still be parseable
        expect(() => jsoncParse(result.text)).not.toThrow()
        const parsed = jsoncParse(result.text)
        expect(parsed.db.connection.port).toBe('fifteen twenty one') // preserves user value
    })

    test('User sets wrong enum value (mode: "MAYBE") - should return validation error', () => {
        const brokenConfig = `{
    "log": {
        "dir": "Z:/logs",
        "mode": "MAYBE"
    },
    "db": {
        "kind": "ORA",
        "connection": {
            "host": "localhost"
        }
    }
}`

        const result = conf.getConfig(brokenConfig)

        // Should detect invalid enum value
        expect(result.errors.length).toBeGreaterThan(0)
        expect(result.errors.some(e => e.includes('mode') || e.includes('REWRITE') || e.includes('APPEND'))).toBe(true)

        // Output should be valid
        expect(() => jsoncParse(result.text)).not.toThrow()
    })

    test('User sets array to wrong type (list as string) - should return validation error', () => {
        const brokenConfig = `{
    "log": {
        "dir": "Z:/logs",
        "mode": "REWRITE"
    },
    "db": {
        "kind": "ORA",
        "connection": {
            "host": "localhost"
        },
        "objects": {
            "schema": {
                "list": "MY_SCHEMA1, MY_SCHEMA2",
                "mode": "INCLUDE"
            }
        }
    }
}`

        const result = conf.getConfig(brokenConfig)

        // Should detect that list should be an array
        expect(result.errors.length).toBeGreaterThan(0)
        expect(result.errors.some(e => e.includes('list') || e.includes('array') || e.includes('Array'))).toBe(true)

        // Output should be valid JSONC
        expect(() => jsoncParse(result.text)).not.toThrow()
    })

    test('User accidentally nests objects incorrectly - should normalize structure', () => {
        const brokenConfig = `{
    "log": {
        "dir": "Z:/logs",
        "mode": "REWRITE"
    },
    "db": {
        "kind": "ORA",
        "connection": {
            "host": "localhost"
        },
        "objects": {
            "schema": {
                "list": ["SCHEMA1"]
            }
            // User forgot to add sequence, synonym, job
        }
    }
}`

        const result = conf.getConfig(brokenConfig)

        // Should add missing objects
        expect(result.changed).toBe(true)

        const parsed = jsoncParse(result.text)
        expect(parsed.db.objects.sequence).toBeDefined()
        expect(parsed.db.objects.synonym).toBeDefined()
        expect(parsed.db.objects.job).toBeDefined()

        // All should have default values
        expect(parsed.db.objects.sequence.dir).toContain('{{schema}}')
        expect(parsed.db.objects.synonym.dir).toContain('{{schema}}')
        expect(parsed.db.objects.job.dir).toContain('{{schema}}')

        // Structure should be flat, not nested
        expect(parsed.db.objects.sequence.synonym).toBeUndefined()
        expect(parsed.db.objects.sequence.job).toBeUndefined()
    })

    test('User removes entire "objects" section - should rebuild it with defaults', () => {
        const brokenConfig = `{
    "log": {
        "dir": "Z:/logs",
        "mode": "REWRITE"
    },
    "db": {
        "kind": "ORA",
        "connection": {
            "host": "localhost",
            "port": 1521,
            "service": "XEPDB1",
            "login": "USER",
            "password": "123"
        }
    }
}`

        const result = conf.getConfig(brokenConfig)

        // Should add the missing objects section
        expect(result.changed).toBe(true)

        const parsed = jsoncParse(result.text)
        expect(parsed.db.objects).toBeDefined()
        expect(parsed.db.objects.schema).toBeDefined()
        expect(parsed.db.objects.sequence).toBeDefined()
        expect(parsed.db.objects.synonym).toBeDefined()
        expect(parsed.db.objects.job).toBeDefined()

        // Should have default values
        expect(parsed.db.objects.schema.list).toEqual(['MY_SCHEMA1', 'MY_SCHEMA2'])
        expect(parsed.db.objects.schema.mode).toBe('INCLUDE')
    })

    test('User manually creates malformed JSON with missing comma - getConfig should handle it gracefully', () => {
        // Note: jsonc-parser is lenient and may auto-fix some issues
        const brokenConfig = `{
    "log": {
        "dir": "Z:/logs"
        "mode": "REWRITE"
    },
    "db": {
        "kind": "ORA",
        "connection": {
            "host": "localhost"
        }
    }
}`

        const result = conf.getConfig(brokenConfig)

        // Even if input is slightly malformed, output should be valid
        expect(() => jsoncParse(result.text)).not.toThrow()

        const parsed = jsoncParse(result.text)
        expect(parsed.log).toBeDefined()
        expect(parsed.db).toBeDefined()
    })

    test('User adds extra unknown fields - should preserve them', () => {
        const configWithExtra = `{
    "log": {
        "dir": "Z:/logs",
        "mode": "REWRITE",
        "customField": "user added this"
    },
    "db": {
        "kind": "ORA",
        "connection": {
            "host": "localhost",
            "customTimeout": 5000
        }
    },
    "myCustomSection": {
        "foo": "bar"
    }
}`

        const result = conf.getConfig(configWithExtra)

        const parsed = jsoncParse(result.text)

        // Unknown fields should be preserved
        expect(parsed.log.customField).toBe('user added this')
        expect(parsed.db.connection.customTimeout).toBe(5000)
        expect(parsed.myCustomSection).toEqual({ foo: 'bar' })

        // And required fields should still be there
        expect(parsed.log.dir).toBe('Z:/logs')
        expect(parsed.db.kind).toBe('ORA')
    })
})
