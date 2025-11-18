import { vvConfigJsonc, Type, type Static } from '../src/index.js'
import { parse as jsoncParse } from 'jsonc-parser'

/**
 * This test reproduces the real bug scenario from vv-ddl-gen project.
 *
 * Steps that lead to the bug:
 * 1. User generates TEMPLATE config using ConfigGerenate() -> creates TEMPLATE.ORA.jsonc
 * 2. User modifies the config (changes paths, credentials, etc.)
 * 3. User runs the app which calls ConfigRead()
 * 4. ConfigRead() calls getConfig() to normalize and validate
 * 5. ConfigRead() SAVES the normalized result back to the file (line 140 in vv-ddl-gen/src/config.ts)
 * 6. The saved file becomes corrupted (as seen in BACKDEPO.UAT.jsonc)
 *
 * This test uses the REAL schema from vv-ddl-gen project.
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

// Real schema from vv-ddl-gen/src/config.ts with minimal Oracle connection
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
        table: Type.Object({
            dir: Type.String({ description: 'path template for storing table DDL scripts; supports placeholders {{schema}} and {{table}}', default: 'path/to/ddl/{{schema}}/TABLE/{{schema}}.TBL.{{table}}.sql' }),
            allowStorage: Type.Boolean({ description: 'if true, include STORAGE parameters (INITIAL, NEXT, MINEXTENTS, etc.) in the table DDL', default: false }),
            allowTablespace: Type.Boolean({ description: 'if true, include TABLESPACE clause in the table DDL', default: false }),
        }),
        view: Type.Object({
            dir: Type.String({ description: 'path template for storing view DDL scripts; supports placeholders {{schema}} and {{view}}', default: 'path/to/ddl/{{schema}}/VIEW/{{schema}}.VIE.{{view}}.sql' }),
        }),
        index: Type.Object({
            dir: Type.String({ description: 'path template for storing index DDL scripts; supports placeholders {{schema}}, {{table}} and {{index}}', default: 'path/to/ddl/{{schema}}/INDEX/{{schema}}.TBL.{{table}}.IDX.{{index}}.sql' }),
        }),
        trigger: Type.Object({
            dir: Type.String({ description: 'path template for storing trigger DDL scripts; supports placeholders {{schema}} and {{trigger}}', default: 'path/to/ddl/{{schema}}/TRIGGER/{{schema}}.TRG.{{trigger}}.sql' }),
        }),
        package: Type.Object({
            dir: Type.String({ description: 'path template for storing package specification DDL scripts; supports placeholders {{schema}} and {{package}}.', default: 'path/to/ddl/{{schema}}/PACKAGE/{{schema}}.PHD.{{package}}.sql' }),
        }),
        package_body: Type.Object({
            dir: Type.String({
                description: 'path template for storing package body DDL scripts; If not set, spec and body are stored in one file; supports placeholders {{schema}} and {{package_body}}',
                default: 'path/to/ddl/{{schema}}/PACKAGEBODY/{{schema}}.PBY.{{package_body}}.sql',
            }),
        }),
        procedure: Type.Object({
            dir: Type.String({ description: 'path template for storing procedure DDL scripts; supports placeholders {{schema}} and {{procedure}}', default: 'path/to/ddl/{{schema}}/PROCEDURE/{{schema}}.PRC.{{procedure}}.sql' }),
        }),
        function: Type.Object({
            dir: Type.String({ description: 'path template for storing function DDL scripts; supports placeholders {{schema}} and {{function}}', default: 'path/to/ddl/{{schema}}/FUNCTION/{{schema}}.FUN.{{function}}.sql' }),
        }),
        type: Type.Object({
            dir: Type.String({ description: 'path template for storing type DDL scripts; supports placeholders {{schema}} and {{type}}', default: 'path/to/ddl/{{schema}}/TYPE/{{schema}}.TYP.{{type}}.sql' }),
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
        table_fill_full: Type.Object({
            dir: Type.String({ description: 'path template for storing full data insert scripts for tables; supports placeholders {{schema}} and {{table}}', default: 'path/to/ddl/{{schema}}/TABLE.FILL.FULL/{{schema}}.TBL.{{table}}.FF.sql' }),
            list: Type.Array(Type.String(), { description: 'list of tables for which to generate full data insert scripts; example: ["schema1.table1", "schema2.table1"]', default: ['schema1.table1', 'schema2.table1'] }),
        }),
        table_fill_demo: Type.Object({
            dir: Type.String({ description: 'path template for storing demo data insert scripts (few records) for tables. supports placeholders {{schema}} and {{table}}', default: 'path/to/ddl/{{schema}}/TABLE.FILL.DEMO/{{schema}}.TBL.{{table}}.FD.sql' }),
            count: Type.Integer({ description: 'number of records to include in the demo data script', default: 3, minimum: 0 }),
            ignore_exists: Type.Boolean({ description: 'if true, do not regenerate the script if the file already exists', default: false }),
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

type TConfig = Static<typeof SConfig>

describe('Real vv-ddl-gen scenario - Oracle config normalization bug', () => {
    const conf = new vvConfigJsonc(SConfig)

    test('should generate valid TEMPLATE config', () => {
        // Step 1: Generate TEMPLATE (like ConfigGerenate does)
        const template = conf.getDefault([{ path: 'db.kind', value: EDdlKind.ORA }])

        expect(template.text).toBeDefined()
        expect(() => jsoncParse(template.text)).not.toThrow()

        const parsed = jsoncParse(template.text)
        expect(parsed.db.kind).toBe('ORA')
        expect(parsed.db.objects.sequence.dir).toContain('{{schema}}')
    })

    test('should normalize user-modified config without corruption (THIS IS THE BUG)', () => {
        // Step 1: Generate TEMPLATE
        const template = conf.getDefault([{ path: 'db.kind', value: EDdlKind.ORA }])

        // Step 2: Simulate user making some changes
        const userModifiedConfig = template.text

        // Step 3: Read and normalize (like ConfigRead does)
        const normalized = conf.getConfig(userModifiedConfig)

        // Step 4: This is what ConfigRead saves back to file
        const savedText = normalized.text

        // CRITICAL: The saved text MUST be valid JSONC
        let parsedResult
        try {
            parsedResult = jsoncParse(savedText)
        } catch (error) {
            console.log('=== BROKEN OUTPUT ===')
            console.log(savedText)
            console.log('=== END ===')
            throw new Error(`Normalized config is BROKEN and cannot be parsed: ${error}`)
        }

        // Verify structure integrity
        expect(parsedResult).toBeDefined()
        expect(parsedResult.db).toBeDefined()
        expect(parsedResult.db.objects).toBeDefined()

        // CRITICAL CHECKS for the bug
        expect(parsedResult.db.objects.sequence).toBeDefined()
        expect(typeof parsedResult.db.objects.sequence).toBe('object')

        // THE BUG: sequence.dir becomes undefined or corrupted
        expect(typeof parsedResult.db.objects.sequence.dir).toBe('string')
        expect(parsedResult.db.objects.sequence.dir).toBeDefined()
        expect(parsedResult.db.objects.sequence.dir).toContain('{{schema}}')
        expect(parsedResult.db.objects.sequence.dir).toContain('{{sequence}}')

        // synonym should NOT be nested inside sequence
        expect(parsedResult.db.objects.sequence.synonym).toBeUndefined()
        expect(parsedResult.db.objects.sequence.job).toBeUndefined()
        expect(parsedResult.db.objects.sequence.table_fill_full).toBeUndefined()

        // These should be siblings of sequence
        expect(parsedResult.db.objects.synonym).toBeDefined()
        expect(parsedResult.db.objects.job).toBeDefined()
        expect(parsedResult.db.objects.table_fill_full).toBeDefined()
    })
})
