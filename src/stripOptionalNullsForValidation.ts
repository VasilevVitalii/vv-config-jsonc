import { isObj } from "./isObj"

export function stripOptionalNullsForValidation(obj: any, schema: any): any {
	// Примитивы/некорректные — возвращаем как есть
	if (!schema || obj === null || typeof obj !== 'object') return obj

	// anyOf (union) на корне — выбираем ветку по текущему значению
	if (Array.isArray(schema.anyOf) && schema.anyOf.length) {
		const chosen = chooseAnyOfForValue(schema.anyOf, obj)
		return stripOptionalNullsForValidation(obj, chosen)
	}

	// Объект: удаляем null у опциональных и рекурсируем в известные свойства
	if (schema.type === 'object' && schema.properties && typeof schema.properties === 'object') {
		const required: string[] = Array.isArray(schema.required) ? schema.required : []
		const clone: Record<string, any> = Array.isArray(obj) ? obj.slice() : { ...obj }

		for (const [key, prop] of Object.entries<any>(schema.properties)) {
			if (!Object.prototype.hasOwnProperty.call(clone, key)) continue

			const optional = !required.includes(key)
			const val = clone[key]

			if (val === null && optional) {
				delete clone[key] // трактуем null как “отсутствует” только для валидации
				continue
			}

			// Спускаемся глубже
			const nextSchema = Array.isArray(prop.anyOf) && prop.anyOf.length ? chooseAnyOfForValue(prop.anyOf, val) : prop

			if (nextSchema?.type === 'object') {
				clone[key] = stripOptionalNullsForValidation(val, nextSchema)
			} else if (nextSchema?.type === 'array' && Array.isArray(val)) {
				const itemSchema = nextSchema.items
				clone[key] = val.map((el: any) => stripOptionalNullsForValidation(el, itemSchema))
			}
		}
		return clone
	}

	// Массив: обрабатываем элементы
	if (schema.type === 'array' && Array.isArray(obj)) {
		const itemSchema = schema.items
		return obj.map(el => stripOptionalNullsForValidation(el, itemSchema))
	}

	return obj
}

function chooseAnyOfForValue(anyOf: any[], val: any): any {
    if (val === null) {
        return anyOf.find(s => s.type === 'null' || (Object.prototype.hasOwnProperty.call(s, 'const') && s.const === null)) ?? anyOf[0]
    }
    const t = typeof val
    for (const s of anyOf) {
        if (s.type === 'object' && isObj(val)) return s
        if (s.type === 'array' && Array.isArray(val)) return s
        if (s.type === 'string' && t === 'string') return s
        if (s.type === 'number' && t === 'number') return s
        if (s.type === 'integer' && Number.isInteger(val)) return s
        if (s.type === 'boolean' && t === 'boolean') return s
        if (Object.prototype.hasOwnProperty.call(s, 'const') && s.const === val) return s
        if (Array.isArray(s.enum) && s.enum.includes(val)) return s
    }
    return anyOf[0]
}