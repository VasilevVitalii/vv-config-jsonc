import { type JSONPath } from 'jsonc-parser'

export function toPathArray(p: string | JSONPath): JSONPath {
	if (Array.isArray(p)) return p
	if (!p) return []
	return p.split('.').map(seg => (seg.match(/^\d+$/) ? Number(seg) : seg))
}