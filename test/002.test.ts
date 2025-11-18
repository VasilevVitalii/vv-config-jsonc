import { Type } from '../src/index.js'
import { vvConfigJsonc } from '../src/index.js'

enum EEnum {
	KIND1 = 'kind1',
	KIND2 = 'kind2',
}

const SConf = Type.Object({
	valString: Type.String({ description: 'demo for string', default: 'text1', minLength: 2 }),
	valBoolean: Type.Boolean({ description: 'demo for bool', default: true }),
	valNumber: Type.Number({ description: 'demo for number', default: -123.456 }),
	valEnum: Type.Enum(EEnum, { description: 'demo for enum', default: EEnum.KIND1 }),
	valStringNull: Type.Optional(Type.String({ description: 'demo for string without default' })),
	valObject: Type.Object({
		valString: Type.String({ description: 'demo for sub-string', default: 'text2' }),
		valBoolean: Type.Boolean({ description: 'demo for sub-bool', default: false }),
		valNumber: Type.Number({ description: 'demo for sub-number', default: -456.123 }),
		valEnum: Type.Enum(EEnum, { description: 'demo for sub-enum', default: EEnum.KIND2 }),
	}),
	valArray: Type.Array(
		Type.Object({
			valString: Type.String({ description: 'demo for array string', default: 'text3' }),
			valBoolean: Type.Boolean({ description: 'demo for array bool', default: true }),
		}),
		{
			description: 'demo for array',
			default: [
				{ valString: 'text4', valBoolean: false },
				{ valString: 'text5', valBoolean: true },
			],
		},
	),
})

const jsonc1 = [
	`{`,
	`   // other comment for param`,
	`   "valString": "text1",`,
	`   "customParam1": "aaa",`,
	`   // demo for bool`,
	`   "valBoolean": true,`,
	`   "valObject": {`,
	`       // other comment for sub-param`,
	`       "valString": "text2",`,
	`       "customParam2": "bbb"`,
	`   },`,
	`   "valArray": [`,
	`       {`,
	`           // other comment for array string`,
	`           "valString": "text4",`,
	`           "customParam3": "bbb"`,
	`       },`,
	`       {`,
	`           // demo for array string`,
	`           "valString": "text4",`,
	`           // demo for array bool`,
	`            "valBoolean": "abc"`,
	`       }`,
	`   ]`,
	`}`,
]
const text1 =
	'{\n' +
	'    // demo for string\n' +
	'    "valString": "text1",\n' +
	'    "customParam1": "aaa",\n' +
	'    // demo for bool\n' +
	'    "valBoolean": true,\n' +
	'    "valObject": {\n' +
	'        // demo for sub-string\n' +
	'        "valString": "text2",\n' +
	'        "customParam2": "bbb",\n' +
	'        // demo for sub-bool\n' +
	'        "valBoolean": false,\n' +
	'        // demo for sub-number\n' +
	'        "valNumber": -456.123,\n' +
	'        // demo for sub-enum\n' +
	'        "valEnum": "kind2"\n' +
	'    },\n' +
	'    // demo for array\n' +
	'    "valArray": [\n' +
	'        {\n' +
	'            // demo for array string\n' +
	'            "valString": "text4",\n' +
	'            "customParam3": "bbb",\n' +
	'            // demo for array bool\n' +
	'            "valBoolean": true\n' +
	'        },\n' +
	'        {\n' +
	'            "valString": "text4",\n' +
	'            "valBoolean": "abc"\n' +
	'        }\n' +
	'    ],\n' +
	'    // demo for number\n' +
	'    "valNumber": -123.456,\n' +
	'    // demo for enum\n' +
	'    "valEnum": "kind1",\n' +
	'    // demo for string without default\n' +
	'    "valStringNull": null\n' +
	'}\n'
const object1 = {
	valString: 'text1',
	customParam1: 'aaa',
	valBoolean: true,
	valObject: {
		valString: 'text2',
		customParam2: 'bbb',
		valBoolean: false,
		valNumber: -456.123,
		valEnum: 'kind2',
	},
	valArray: [
		{
			valString: 'text4',
			customParam3: 'bbb',
			valBoolean: true,
		},
		{
			valString: 'text4',
			valBoolean: 'abc',
		},
	],
	valNumber: -123.456,
	valEnum: 'kind1',
	valStringNull: null,
}

const jsonc2 = [`{`, `"customParam1": "value1",`, `"valNumber": "asd"`, `}`]
const text2 =
	'{\n' +
	'    "customParam1": "value1",\n' +
	'    // demo for number\n' +
	'    "valNumber": "asd",\n' +
	'    // demo for string\n' +
	'    "valString": "text1",\n' +
	'    // demo for bool\n' +
	'    "valBoolean": true,\n' +
	'    // demo for enum\n' +
	'    "valEnum": "kind1",\n' +
	'    // demo for string without default\n' +
	'    "valStringNull": null,\n' +
	'    "valObject": {\n' +
	'        // demo for sub-string\n' +
	'        "valString": "text2",\n' +
	'        // demo for sub-bool\n' +
	'        "valBoolean": false,\n' +
	'        // demo for sub-number\n' +
	'        "valNumber": -456.123,\n' +
	'        // demo for sub-enum\n' +
	'        "valEnum": "kind2"\n' +
	'    },\n' +
	'    // demo for array\n' +
	'    "valArray": []\n' +
	'}\n'
const object2 = {
	customParam1: 'value1',
	valNumber: 'asd',
	valString: 'text1',
	valBoolean: true,
	valEnum: 'kind1',
	valStringNull: null,
	valObject: {
		valString: 'text2',
		valBoolean: false,
		valNumber: -456.123,
		valEnum: 'kind2',
	},
	valArray: [],
}

describe('linear config (getConfig)', () => {
	const conf = new vvConfigJsonc(SConf)
	const resConf1 = conf.getConfig(jsonc1.join('\n'))
	const resConf2 = conf.getConfig(jsonc2.join('\n'))

	test('text1', () => {
		expect(resConf1.text).toBe(text1)
	})
	test('object1', () => {
		expect(JSON.stringify(resConf1.config)).toBe(JSON.stringify(object1))
	})
	test('errors1', () => {
		expect(resConf1.errors.length).toBe(1)
	})
	test('text2', () => {
		expect(resConf2.text).toBe(text2)
	})
	test('object2', () => {
		expect(JSON.stringify(resConf2.config)).toBe(JSON.stringify(object2))
	})
	test('errors2', () => {
		expect(resConf2.errors.length).toBe(1)
	})
})
