import { parse as jsoncParse, modify, applyEdits, format, type JSONPath } from 'jsonc-parser'
import type { TSchema, Static } from '@sinclair/typebox'
import { TypeCompiler } from '@sinclair/typebox/compiler'
import { toPathArray } from './toPathArray.js'
import { isObj } from './isObj.js'
import { insertLineCommentBeforeProperty, removeLineCommentBeforeProperty } from './lineCommentBeforeProperty.js'
import { stripOptionalNullsForValidation } from './stripOptionalNullsForValidation.js'

const FORMAT = { insertSpaces: true, tabSize: 4, eol: '\n' as const }

export type Variant = { path: string | JSONPath; value: unknown }

export class vvConfigJsonc<S extends TSchema> {
	constructor(private readonly rootSchema: S) {}

	private pickSchemaVariantByVariants(variants: Variant[]): TSchema {
		const union = (this.rootSchema as any).anyOf as TSchema[] | undefined
		if (!union) return this.rootSchema
		const normalized = variants.map(v => ({ path: toPathArray(v.path), value: v.value }))
		const fits = (schema: TSchema) => {
			for (const { path, value } of normalized) {
				let node: any = schema
				for (const seg of path) {
					if (!node || node.type !== 'object' || !node.properties) {
						node = undefined
						break
					}
					node = node.properties[seg as any]
				}
				if (!node) return false
				if (Object.prototype.hasOwnProperty.call(node, 'const')) {
					if (node.const !== value) return false
				} else if (Array.isArray(node.enum)) {
					if (!node.enum.includes(value)) return false
				} else {
					return false
				}
			}
			return true
		}
		return (union.find(fits) ?? union[0]) as TSchema
	}

	private pickSchemaVariantByObject(obj: unknown): TSchema {
		const union = (this.rootSchema as any).anyOf as TSchema[] | undefined
		if (!union) return this.rootSchema
		if (!isObj(obj)) return union[0] as TSchema
		const score = (schema: any) => {
			let points = 0
			const walk = (s: any, cur: any): void => {
				if (!s || !isObj(cur)) return
				if (s.type === 'object' && s.properties) {
					for (const [k, p] of Object.entries<any>(s.properties)) {
						const v = (cur as any)[k]
						if (Object.prototype.hasOwnProperty.call(p, 'const')) {
							if (v === p.const) points += 2
						} else if (Array.isArray(p.enum)) {
							if (p.enum.includes(v)) points += 1
						}
						if (p && p.type === 'object') walk(p, v)
					}
				}
			}
			walk(schema, obj)
			return points
		}
		let best = union[0]
		let bestScore = -1
		for (const s of union) {
			const sc = score(s)
			if (sc > bestScore) {
				bestScore = sc
				best = s
			}
		}
		return best as TSchema
	}

	private pickNestedUnion(anyOf: TSchema[], relVariants: { path: JSONPath; value: unknown }[] | undefined, currentSegment: unknown): TSchema {
		if (relVariants && relVariants.length) {
			const fits = (schema: TSchema) => {
				for (const { path, value } of relVariants) {
					let node: any = schema
					for (const seg of path) {
						if (!node || node.type !== 'object' || !node.properties) {
							node = undefined
							break
						}
						node = node.properties[seg as any]
					}
					if (!node) return false
					if (Object.prototype.hasOwnProperty.call(node, 'const')) {
						if (node.const !== value) return false
					} else if (Array.isArray(node.enum)) {
						if (!node.enum.includes(value)) return false
					} else {
						return false
					}
				}
				return true
			}
			const matched = anyOf.find(fits)
			if (matched) return matched
		}
		if (isObj(currentSegment)) {
			let best = anyOf[0]
			let bestScore = -1
			for (const s of anyOf) {
				let points = 0
				const walk = (schema: any, cur: any): void => {
					if (!schema || !isObj(cur)) return
					if (schema.type === 'object' && schema.properties) {
						for (const [k, p] of Object.entries<any>(schema.properties)) {
							const v = (cur as any)[k]
							if (Object.prototype.hasOwnProperty.call(p, 'const')) {
								if (v === p.const) points += 2
							} else if (Array.isArray(p.enum)) {
								if (p.enum.includes(v)) points += 1
							}
							if (p && p.type === 'object') walk(p, v)
						}
					}
				}
				walk(s, currentSegment)
				if (points > bestScore) {
					bestScore = points
					best = s
				}
			}
			return best as TSchema
		}
		return anyOf[0] as TSchema
	}

	private extractSkeletonAndComments(
		schema: any,
		baseDot = '',
		variants?: Variant[],
		currentSegment?: unknown,
	): { skeleton?: any; comments: Record<string, string> } {
		const comments: Record<string, string> = {}
		const addC = (dot: string, s: any) => {
			if (s && typeof s.description === 'string' && s.description.trim()) comments[dot] = s.description
		}
		if (schema && schema.type === 'object' && isObj(schema.properties)) {
			const out: Record<string, unknown> = {}
			let hasAny = false
			for (const [key, prop] of Object.entries<any>(schema.properties)) {
				const dot = baseDot ? `${baseDot}.${key}` : key
				if (Object.prototype.hasOwnProperty.call(prop, 'default')) {
					out[key] = prop.default
					hasAny = true
					addC(dot, prop)
					if (prop.type === 'array' && Array.isArray(prop.default) && prop.default.length > 0) {
						const items = prop.items
						if (items && items.type === 'object' && isObj(items.properties)) {
							for (const [ik, ip] of Object.entries<any>(items.properties)) addC(`${dot}.0.${ik}`, ip)
						}
					}
					continue
				}
				if (Object.prototype.hasOwnProperty.call(prop, 'const')) {
					out[key] = prop.const
					hasAny = true
					addC(dot, prop)
					continue
				}
				if (prop && Array.isArray(prop.anyOf) && prop.anyOf.length) {
					const relVariants = variants
						? variants
								.map(v => ({ dot: Array.isArray(v.path) ? v.path.join('.') : String(v.path), value: v.value }))
								.filter(v => v.dot === dot || v.dot.startsWith(dot + '.'))
								.map(v => {
									const trimmed = v.dot === dot ? '' : v.dot.slice(dot.length + 1)
									return { path: toPathArray(trimmed), value: v.value }
								})
						: undefined
					const curSeg = isObj(currentSegment) ? (currentSegment as any)[key] : undefined
					const chosen = this.pickNestedUnion(prop.anyOf, relVariants, curSeg)
					const child = this.extractSkeletonAndComments(chosen, dot, variants, curSeg)
					if (child.skeleton !== undefined) {
						out[key] = child.skeleton
						hasAny = true
					} else {
						out[key] = {}
						hasAny = true
					}
					Object.assign(comments, child.comments)
					addC(dot, chosen)
					continue
				}
				if (prop && prop.type === 'object') {
					const curSeg = isObj(currentSegment) ? (currentSegment as any)[key] : undefined
					const child = this.extractSkeletonAndComments(prop, dot, variants, curSeg)
					if (child.skeleton !== undefined) {
						out[key] = child.skeleton
						hasAny = true
					} else {
						out[key] = {}
						hasAny = true
					}
					Object.assign(comments, child.comments)
					addC(dot, prop)
					continue
				}
				if (prop && prop.type === 'array') {
					const items = prop.items
					if (items && items.type === 'object') {
						const itemSkeleton = this.extractSkeletonAndComments(items, `${dot}.0`, variants, undefined)
						if (itemSkeleton.skeleton !== undefined && Object.keys(itemSkeleton.skeleton).length > 0) {
							const hasNonNullValue = Object.values(itemSkeleton.skeleton).some(v => v !== null)
							if (hasNonNullValue) {
								out[key] = [itemSkeleton.skeleton]
								Object.assign(comments, itemSkeleton.comments)
							} else {
								out[key] = []
							}
						} else {
							out[key] = []
						}
					} else {
						out[key] = []
					}
					hasAny = true
					addC(dot, prop)
					continue
				}
				out[key] = null
				hasAny = true
				addC(dot, prop)
			}
			return { skeleton: hasAny ? out : undefined, comments }
		}
		if (baseDot) addC(baseDot, schema)
		return { comments }
	}

	private collectMissing(
		current: unknown,
		skeleton?: unknown,
		baseJsonPath: JSONPath = [],
		baseDot = '',
	): { jsonPath: JSONPath; dotPath: string; value: unknown }[] {
		if (!isObj(skeleton)) return []
		const out: { jsonPath: JSONPath; dotPath: string; value: unknown }[] = []
		for (const [key, sv] of Object.entries(skeleton)) {
			const jp = [...baseJsonPath, key]
			const dp = baseDot ? `${baseDot}.${key}` : key
			const hasKey = isObj(current) && Object.prototype.hasOwnProperty.call(current, key)
			if (!hasKey) {
				out.push({ jsonPath: jp, dotPath: dp, value: sv })
				continue
			}
			const cv = isObj(current) ? (current as any)[key] : undefined
			if (isObj(sv) && isObj(cv)) out.push(...this.collectMissing(cv, sv, jp, dp))
		}
		return out
	}

	private addMissingArrayItemFields(
		text: string,
		obj: any,
		schema: any,
		basePath: JSONPath = [],
		baseDot = '',
	): { text: string; added: { parentPath: JSONPath; propKey: string; comment?: string }[] } {
		let curText = text
		const added: { parentPath: JSONPath; propKey: string; comment?: string }[] = []
		if (!schema || obj === null || typeof obj !== 'object') return { text: curText, added }
		if (Array.isArray(schema.anyOf) && schema.anyOf.length) {
			const chosen = schema.anyOf.find((s: any) => s?.type === 'object') ?? schema.anyOf[0]
			return this.addMissingArrayItemFields(curText, obj, chosen, basePath, baseDot)
		}
		if (schema.type === 'object' && schema.properties && typeof schema.properties === 'object') {
			for (const [propName, propSchema] of Object.entries<any>(schema.properties)) {
				const childDot = baseDot ? `${baseDot}.${propName}` : propName
				const childPath = [...basePath, propName]
				if (propSchema?.type === 'object') {
					const childObj = isObj(obj) ? (obj as any)[propName] : undefined
					const res = this.addMissingArrayItemFields(curText, childObj, propSchema, childPath, childDot)
					curText = res.text
					added.push(...res.added)
					continue
				}
				if (propSchema?.type === 'array' && propSchema.items && propSchema.items.type === 'object') {
					const arrVal = isObj(obj) ? (obj as any)[propName] : undefined
					if (Array.isArray(arrVal)) {
						const itemProps: Record<string, any> = (propSchema.items.properties ?? {}) as any
						for (let i = 0; i < arrVal.length; i++) {
							const el = arrVal[i]
							if (!isObj(el)) continue
							for (const [k, defSchema] of Object.entries<any>(itemProps)) {
								if (Object.prototype.hasOwnProperty.call(el, k)) continue
								let value: any = null
								if (Object.prototype.hasOwnProperty.call(defSchema, 'default')) value = defSchema.default
								else if (Object.prototype.hasOwnProperty.call(defSchema, 'const')) value = defSchema.const
								const p = [...childPath, i, k]
								const edits = modify(curText, p, value, { formattingOptions: FORMAT })
								if (edits.length) {
									curText = applyEdits(curText, edits)
									const comment = typeof defSchema.description === 'string' ? defSchema.description : undefined
									added.push({ parentPath: [...childPath, i], propKey: k, comment })
								}
							}
						}
						for (let i = 0; i < arrVal.length; i++) {
							const el = arrVal[i]
							if (!isObj(el)) continue
							const res = this.addMissingArrayItemFields(curText, el, propSchema.items, [...childPath, i], `${childDot}.${i}`)
							curText = res.text
							added.push(...res.added)
						}
					}
					continue
				}
			}
		}
		if (schema.type === 'array' && schema.items && Array.isArray(obj)) {
			for (let i = 0; i < obj.length; i++) {
				const el = obj[i]
				const res = this.addMissingArrayItemFields(curText, el, schema.items, [...basePath, i], `${baseDot}.${i}`)
				curText = res.text
				added.push(...res.added)
			}
		}
		return { text: curText, added }
	}

	private removeArrayItemsCommentsBeyondFirst(text: string, obj: any, schema: any, basePath: JSONPath = [], baseDot = ''): string {
		let curText = text
		if (!schema || obj === null || typeof obj !== 'object') return curText
		if (Array.isArray(schema.anyOf) && schema.anyOf.length) {
			const chosen = schema.anyOf.find((s: any) => s?.type === 'object') ?? schema.anyOf[0]
			return this.removeArrayItemsCommentsBeyondFirst(curText, obj, chosen, basePath, baseDot)
		}
		if (schema.type === 'object' && schema.properties && typeof schema.properties === 'object') {
			for (const [propName, propSchema] of Object.entries<any>(schema.properties)) {
				const childDot = baseDot ? `${baseDot}.${propName}` : propName
				const childPath = [...basePath, propName]
				if (propSchema?.type === 'object') {
					const childObj = isObj(obj) ? (obj as any)[propName] : undefined
					curText = this.removeArrayItemsCommentsBeyondFirst(curText, childObj, propSchema, childPath, childDot)
					continue
				}
				if (propSchema?.type === 'array' && propSchema.items && propSchema.items.type === 'object') {
					const arrVal = isObj(obj) ? (obj as any)[propName] : undefined
					if (Array.isArray(arrVal)) {
						const itemProps: Record<string, any> = (propSchema.items.properties ?? {}) as any
						for (let i = 1; i < arrVal.length; i++) {
							const el = arrVal[i]
							if (!isObj(el)) continue
							for (const k of Object.keys(itemProps)) curText = removeLineCommentBeforeProperty(curText, [...childPath, i], k)
						}
						for (let i = 0; i < arrVal.length; i++) {
							const el = arrVal[i]
							if (!isObj(el)) continue
							curText = this.removeArrayItemsCommentsBeyondFirst(curText, el, propSchema.items, [...childPath, i], `${childDot}.${i}`)
						}
					}
					continue
				}
			}
		}
		if (schema.type === 'array' && schema.items && Array.isArray(obj)) {
			for (let i = 0; i < obj.length; i++) {
				const el = obj[i]
				curText = this.removeArrayItemsCommentsBeyondFirst(curText, el, schema.items, [...basePath, i], `${baseDot}.${i}`)
			}
		}
		return curText
	}

	private collectArrayPropertyPaths(schema: any, baseDot = ''): Set<string> {
		const out = new Set<string>()
		if (!schema) return out
		if (Array.isArray(schema.anyOf) && schema.anyOf.length) {
			for (const s of schema.anyOf) for (const p of this.collectArrayPropertyPaths(s, baseDot)) out.add(p)
			return out
		}
		if (schema.type === 'object' && schema.properties && typeof schema.properties === 'object') {
			for (const [key, prop] of Object.entries<any>(schema.properties)) {
				const dot = baseDot ? `${baseDot}.${key}` : key
				if (prop?.type === 'array') {
					out.add(dot)
					continue
				}
				if (prop?.type === 'object') {
					for (const p of this.collectArrayPropertyPaths(prop, dot)) out.add(p)
					continue
				}
				if (Array.isArray(prop?.anyOf) && prop.anyOf.length) {
					for (const p of this.collectArrayPropertyPaths(prop, dot)) out.add(p)
					continue
				}
			}
		}
		if (schema.type === 'array' && schema.items) {
			for (const p of this.collectArrayPropertyPaths(schema.items, `${baseDot}.[]`)) out.add(p)
		}
		return out
	}

	getDefault(variants?: Variant[]): { text: string; object: Static<S> } {
		const schema = this.pickSchemaVariantByVariants(variants || [])
		const { skeleton, comments } = this.extractSkeletonAndComments(schema, '', variants, undefined)
		let text = '{}\n'
		if (isObj(skeleton)) {
			const stack: Array<{ base: JSONPath; obj: any }> = [{ base: [], obj: skeleton }]
			while (stack.length) {
				const { base, obj } = stack.pop()!
				for (const [k, v] of Object.entries(obj)) {
					const path = [...base, k]
					const edits = modify(text, path, v, { formattingOptions: FORMAT })
					if (edits.length) text = applyEdits(text, edits)
					if (isObj(v)) stack.push({ base: path, obj: v })
				}
			}
			for (const [dot, c] of Object.entries(comments)) {
				const parts = dot.split('.')
				const prop = parts.pop()!
				const parent = toPathArray(parts.join('.'))
				text = insertLineCommentBeforeProperty(text, parent, prop, c, { replaceExisting: true })
			}
		}
		const fmtEdits = format(text, undefined, FORMAT)
		if (fmtEdits.length) text = applyEdits(text, fmtEdits)
		if (!text.endsWith('\n')) text += '\n'
		const object = jsoncParse(text) as Static<S>
		return { text, object }
	}

	getConfig(inputText: string): { config: Static<S>; errors: string[]; changed: boolean; text: string } {
		let text = inputText && inputText.trim().length ? inputText : '{}\n'
		let obj = jsoncParse(text) ?? {}
		if (!isObj(obj)) obj = {}
		const schema = this.pickSchemaVariantByObject(obj)
		const compiler = TypeCompiler.Compile(schema)
		const { skeleton, comments } = this.extractSkeletonAndComments(schema, '', undefined, obj)
		const missing = this.collectMissing(obj, skeleton)
		const arrayProps = this.collectArrayPropertyPaths(schema)
		let changed = false
		for (const m of missing) {
			let value = m.value
			if (arrayProps.has(m.dotPath)) value = []
			const edits = modify(text, m.jsonPath, value, { formattingOptions: FORMAT })
			if (edits.length) {
				text = applyEdits(text, edits)
				changed = true
			}
		}
		const afterMissingObj = jsoncParse(text) ?? {}
		const arraysPass = this.addMissingArrayItemFields(text, afterMissingObj, schema, [], '')
		if (arraysPass.text !== text) {
			text = arraysPass.text
			changed = true
		}
		if (changed) {
			for (const m of missing) {
				const c = comments[m.dotPath]
				if (!c) continue
				const parent = m.jsonPath.slice(0, -1)
				const prop = String(m.jsonPath[m.jsonPath.length - 1])
				text = insertLineCommentBeforeProperty(text, parent, prop, c, { replaceExisting: true })
			}
			for (const a of arraysPass.added) {
				if (!a.comment) continue
				text = insertLineCommentBeforeProperty(text, a.parentPath, a.propKey, a.comment, { replaceExisting: true })
			}
		}
		for (const [dot, c] of Object.entries(comments)) {
			const parts = dot.split('.')
			const prop = parts.pop()!
			const parent = toPathArray(parts.join('.'))
			text = insertLineCommentBeforeProperty(text, parent, prop, c, { replaceExisting: true })
		}
		{
			const currentObj = jsoncParse(text) ?? {}
			text = this.removeArrayItemsCommentsBeyondFirst(text, currentObj, schema, [], '')
		}
		const fmtEdits = format(text, undefined, FORMAT)
		if (fmtEdits.length) text = applyEdits(text, fmtEdits)
		if (!text.endsWith('\n')) text += '\n'
		const finalObj = jsoncParse(text) as Static<S>
		const toValidate = stripOptionalNullsForValidation(finalObj, schema)
		const errors: string[] = []
		if (!compiler.Check(toValidate)) {
			for (const e of compiler.Errors(toValidate)) errors.push(`path=${e.path} message=${e.message}`)
		}
		return { config: finalObj, errors, changed, text }
	}
}
