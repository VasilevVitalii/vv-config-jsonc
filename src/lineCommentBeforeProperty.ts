import { parseTree, findNodeAtLocation, type JSONPath } from 'jsonc-parser'

export function insertLineCommentBeforeProperty(
	text: string,
	parentPath: JSONPath,
	propKey: string,
	comment: string,
	opts?: { replaceExisting?: boolean },
): string {
	const tree = parseTree(text)
	if (!tree) return text

	const parentNode = parentPath.length ? findNodeAtLocation(tree, parentPath) : tree
	if (!parentNode || parentNode.type !== 'object' || !parentNode.children) return text

	const propNode = parentNode.children.find(p => p.type === 'property' && p.children?.[0]?.value === propKey)
	if (!propNode) return text

	const propStart = propNode.offset
	const before = text.slice(0, propStart)
	const after = text.slice(propStart)

	const lineStart = before.lastIndexOf('\n') + 1
	const indent = (before.slice(lineStart).match(/^\s*/) || [''])[0]

	const prevLineStart = before.lastIndexOf('\n', lineStart - 2) + 1
	const prevLine = before.slice(prevLineStart, lineStart)

	const wanted = `${indent}// ${comment}\n`

	if (/^\s*\/\/.*/.test(prevLine)) {
		if (opts?.replaceExisting) {
			return before.slice(0, prevLineStart) + wanted + before.slice(lineStart) + after
		}
		return text
	}

	return before.slice(0, lineStart) + wanted + before.slice(lineStart) + after
}

export function removeLineCommentBeforeProperty(text: string, parentPath: JSONPath, propKey: string): string {
	const tree = parseTree(text)
	if (!tree) return text

	const parentNode = parentPath.length ? findNodeAtLocation(tree, parentPath) : tree
	if (!parentNode || parentNode.type !== 'object' || !parentNode.children) return text

	const propNode = parentNode.children.find(p => p.type === 'property' && p.children?.[0]?.value === propKey)
	if (!propNode) return text

	const propStart = propNode.offset
	const before = text.slice(0, propStart)
	const after = text.slice(propStart)

	const lineStart = before.lastIndexOf('\n') + 1
	const prevLineStart = before.lastIndexOf('\n', lineStart - 2) + 1
	const prevLine = before.slice(prevLineStart, lineStart)

	if (/^\s*\/\/.*/.test(prevLine)) {
		return before.slice(0, prevLineStart) + before.slice(lineStart) + after
	}
	return text
}
