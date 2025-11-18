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

const text = [
	`{`,
	`   // demo for string`,
	`   "valString": "text1",`,
	`   // demo for bool`,
	`   "valBoolean": true,`,
	`   // demo for number`,
	`   "valNumber": -123.456,`,
	`   // demo for enum`,
	`   "valEnum": "kind1",`,
	`   // demo for string without default`,
	`   "valStringNull": null,`,
	`   "valObject": {`,
	`       // demo for sub-string`,
	`       "valString": "text2",`,
	`       // demo for sub-bool`,
	`       "valBoolean": false,`,
	`       // demo for sub-number`,
	`       "valNumber": -456.123,`,
	`       // demo for sub-enum`,
	`       "valEnum": "kind2"`,
	`   },`,
	`   // demo for array`,
	`   "valArray": [`,
	`       {`,
	`           // demo for array string`,
	`           "valString": "text4",`,
	`           // demo for array bool`,
	`            "valBoolean": false`,
	`       },`,
	`       {`,
	`           "valString": "text5",`,
	`            "valBoolean": true`,
	`       }`,
	`   ]`,
	`}`,
]

const object = {
	valString: 'text1',
	valBoolean: true,
	valNumber: -123.456,
	valEnum: 'kind1',
	valStringNull: null,
	valObject: {
		valString: 'text2',
		valBoolean: false,
		valNumber: -456.123,
		valEnum: 'kind2',
	},
	valArray: [
		{
			valString: 'text4',
			valBoolean: false,
		},
		{
			valString: 'text5',
			valBoolean: true,
		},
	],
}

describe('linear config (getDefault)', () => {
	const conf = new vvConfigJsonc(SConf)
	const resDefault = conf.getDefault()

	test('text.length', () => {
		expect(resDefault.text.trim().split('\n').length).toBe(text.length)
	})
	test('text', () => {
		resDefault.text
			.trim()
			.split('\n')
			.forEach((item, idx) => {
				expect(`${idx}: ${item.trim()}`).toBe(`${idx}: ${text[idx].trim()}`)
			})
	})
	test('object', () => {
		expect(JSON.stringify(resDefault.object)).toBe(JSON.stringify(object))
	})
})