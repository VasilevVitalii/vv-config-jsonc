import { Type } from '../src'
import { vvConfigJsonc } from '../src'

enum EEnum {
	oracle = 'oracle',
	mssql = 'mssql',
}

const SConfConnectionOracle = Type.Object({
	kind: Type.Literal(EEnum.oracle, { description: 'oracle database', default: 'oracle' }),
	login: Type.String({ description: 'login', default: 'user' }),
	someOracleParam: Type.Number({ description: 'some oracle param', default: 25 }),
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

const jsonc = [
	`{`,
	`   "log": {`,
	`       //full path to log`,
	`       "dir": "/pathlog"`,
	`   },`,
	`   "connection": {`,
	`       "kind": "oracle",`,
	`       "someOracleParam": "abc"`,
	`   }`,
	`}`,
]
const text =
	'{\n' +
	'    "log": {\n' +
	'        // full path to log\n' +
	'        "dir": "/pathlog",\n' +
	'        // some log param\n' +
	'        "someLogParam": "foo"\n' +
	'    },\n' +
	'    "connection": {\n' +
	'        // oracle database\n' +
	'        "kind": "oracle",\n' +
	'        // some oracle param\n' +
	'        "someOracleParam": "abc",\n' +
	'        // login\n' +
	'        "login": "user"\n' +
	'    }\n' +
	'}\n'
const object = {
	log: { dir: '/pathlog', someLogParam: 'foo' },
	connection: { kind: 'oracle', someOracleParam: 'abc', login: 'user' },
}

describe('non linear config (getConfig)', () => {
	const conf = new vvConfigJsonc(SConf)
	const resConf = conf.getConfig(jsonc.join('\n'))

	test('text', () => {
		expect(resConf.text).toBe(text)
	})
	test('object', () => {
		expect(JSON.stringify(resConf.config)).toBe(JSON.stringify(object))
	})
	test('errors', () => {
		expect(resConf.errors.length).toBe(1)
	})
})
