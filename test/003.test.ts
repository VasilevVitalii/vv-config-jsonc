import { Type } from '../src/index.js'
import { vvConfigJsonc } from '../src/index.js'

enum EEnum {
	oracle = 'oracle',
	mssql = 'mssql',
}

const SConfConnectionOracle = Type.Object({
	kind: Type.Literal(EEnum.oracle, { description: 'oracle database', default: 'oracle' }),
	login: Type.String({ description: 'login', default: 'user' }),
	someOracleParam: Type.String({ description: 'some oracle param', default: 'oracle bar' }),
})

const SConfConnectionMssql = Type.Object({
	kind: Type.Literal(EEnum.mssql, { description: 'mssql database', default: 'mssql' }),
	login: Type.String({ description: 'login', default: 'user' }),
	someMssqlParam: Type.String({ description: 'some mssql param', default: 'mssql bar' }),
})

const SConf = Type.Object({
	log: Type.Object({
		dir: Type.String({ description: 'full path to log', default: 'path/to/log' }),
		someLogParam: Type.String({ description: 'some log param', default: 'foo' }),
	}),
	connection: Type.Union([SConfConnectionOracle, SConfConnectionMssql]),
})

const textOracle = [
	`{`,
	`    "log": {`,
	`        // full path to log`,
	`        "dir": "path/to/log",`,
	`        // some log param`,
	`        "someLogParam": "foo"`,
	`    },`,
	`    "connection": {`,
	`        // oracle database`,
	`        "kind": "oracle",`,
	`        // login`,
	`        "login": "user",`,
	`        // some oracle param`,
	`        "someOracleParam": "oracle bar"`,
	`    }`,
	`}`,
]
const textMssql = [
	`{`,
	`    "log": {`,
	`        // full path to log`,
	`        "dir": "path/to/log",`,
	`        // some log param`,
	`        "someLogParam": "foo"`,
	`    },`,
	`    "connection": {`,
	`        // mssql database`,
	`        "kind": "mssql",`,
	`        // login`,
	`        "login": "user",`,
	`        // some mssql param`,
	`        "someMssqlParam": "mssql bar"`,
	`    }`,
	`}`,
]

const objectOracle = {
	log: { dir: 'path/to/log', someLogParam: 'foo' },
	connection: { kind: 'oracle', login: 'user', someOracleParam: 'oracle bar' },
}
const objectMssql = {
	log: { dir: 'path/to/log', someLogParam: 'foo' },
	connection: { kind: 'mssql', login: 'user', someMssqlParam: 'mssql bar' },
}

describe('non linear config (getDefault)', () => {
	const conf = new vvConfigJsonc(SConf)
	const resDefaultOracle = conf.getDefault([{ path: 'connection.kind', value: 'oracle' }])
	const resDefaultMssql = conf.getDefault([{ path: 'connection.kind', value: 'mssql' }])

	test('getDefault(oracle).text.length', () => {
		expect(resDefaultOracle.text.trim().split('\n').length).toBe(textOracle.length)
	})
	test('getDefault(mssql).text.length', () => {
		expect(resDefaultMssql.text.trim().split('\n').length).toBe(textMssql.length)
	})
	test('getDefault(oracle).text', () => {
		resDefaultOracle.text
			.trim()
			.split('\n')
			.forEach((item, idx) => {
				expect(`${idx}: ${item.trim()}`).toBe(`${idx}: ${textOracle[idx].trim()}`)
			})
	})
	test('getDefault(mssql).text', () => {
		resDefaultMssql.text
			.trim()
			.split('\n')
			.forEach((item, idx) => {
				expect(`${idx}: ${item.trim()}`).toBe(`${idx}: ${textMssql[idx].trim()}`)
			})
	})
	test('getDefault(oracle).object', () => {
		expect(JSON.stringify(resDefaultOracle.object)).toBe(JSON.stringify(objectOracle))
	})
	test('getDefault(mssql).object', () => {
		expect(JSON.stringify(resDefaultMssql.object)).toBe(JSON.stringify(objectMssql))
	})
})
