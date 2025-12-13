import { Type } from '../src/index.js'
import { vvConfigJsonc } from '../src/index.js'

describe('array without default value (getDefault)', () => {
	test('array of objects with defaults should return array with one element', () => {
		const SConfig = Type.Object({
			ai: Type.Array(
				Type.Object({
					url: Type.String({
						default: 'http://localhost:11434',
						description: 'API base URL',
					}),
				}),
			),
		})

		const conf = new vvConfigJsonc(SConfig)
		const result = conf.getDefault()

		expect(result.object).toEqual({
			ai: [{ url: 'http://localhost:11434' }],
		})
		expect(Array.isArray(result.object.ai)).toBe(true)
		expect(result.object.ai.length).toBe(1)
		expect(result.object.ai[0]).toEqual({ url: 'http://localhost:11434' })
	})

	test('array with default value should use that default', () => {
		const SConfig = Type.Object({
			ai: Type.Array(
				Type.Object({
					url: Type.String({
						default: 'http://localhost:11434',
						description: 'API base URL',
					}),
				}),
				{
					default: [{ url: 'http://localhost:11434' }],
				},
			),
		})

		const conf = new vvConfigJsonc(SConfig)
		const result = conf.getDefault()

		expect(result.object).toEqual({
			ai: [{ url: 'http://localhost:11434' }],
		})
		expect(Array.isArray(result.object.ai)).toBe(true)
		expect(result.object.ai.length).toBe(1)
	})

	test('array of primitives without default should return empty array', () => {
		const SConfig = Type.Object({
			tags: Type.Array(Type.String()),
		})

		const conf = new vvConfigJsonc(SConfig)
		const result = conf.getDefault()

		expect(result.object).toEqual({
			tags: [],
		})
		expect(Array.isArray(result.object.tags)).toBe(true)
		expect(result.object.tags.length).toBe(0)
	})

	test('array of objects with mixed defaults and non-defaults', () => {
		const SConfig = Type.Object({
			servers: Type.Array(
				Type.Object({
					url: Type.String({
						default: 'http://localhost:8080',
						description: 'Server URL',
					}),
					port: Type.Number({
						default: 8080,
						description: 'Port number',
					}),
					name: Type.String({
						description: 'Server name (no default)',
					}),
				}),
			),
		})

		const conf = new vvConfigJsonc(SConfig)
		const result = conf.getDefault()

		expect(result.object).toEqual({
			servers: [
				{
					url: 'http://localhost:8080',
					port: 8080,
					name: null,
				},
			],
		})
		expect(result.object.servers.length).toBe(1)
	})

	test('array of objects without any defaults should return empty array', () => {
		const SConfig = Type.Object({
			items: Type.Array(
				Type.Object({
					name: Type.String({
						description: 'Item name',
					}),
					value: Type.String({
						description: 'Item value',
					}),
				}),
			),
		})

		const conf = new vvConfigJsonc(SConfig)
		const result = conf.getDefault()

		expect(result.object).toEqual({
			items: [],
		})
		expect(result.object.items.length).toBe(0)
	})
})
