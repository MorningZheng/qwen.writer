const {promises: fs} = require('fs');
const {join, posix} = require('path');
const {parse: babel_parse} = require('@babel/parser');
const {parse: comment_parse} = require('comment-parser');
const crypto = require('crypto');

/**
 * 计算输入文本的 MD5 哈希值。
 * @param {...string} text - 要哈希的文本。
 * @returns {string} 哈希值。
 */
const md5 = (...text) => {
	const hash = crypto.createHash('md5');
	for (const t of text) hash.update(t);
	return hash.digest('hex');
};

/**
 * 递归读取指定目录下的所有函数定义（需配合 babel 解析）。
 * @param {string|array<string>} paths - 目录路径。
 * @param {Object} inject - 注入的变量对象。
 * @returns {Promise<Array>} 函数描述对象数组。
 */
const use_functions = (paths, inject = null) => Promise.all((Array.isArray(paths) ? paths : [paths]).map(path =>
	fs.readdir(path, {withFileTypes: true, recursive: false})
		.catch(e => [])
		.then(async files => {
			const libs = [];
			for (const f of files) {
				const {name} = f, path = f.parentPath ?? f.path;
				const filename = path.slice(0, -join(path).length) + posix.join(path, name);

				if (f.isDirectory()) {
					for (const name of ['main', 'index', 'export', 'expose']) {
						const entry = join(filename, name) + '.js';
						if (await fs.stat(entry).then(() => false).catch(() => true)) continue;
						libs.push({
							standalone: false,
							filename: entry,
							dir: filename,
						});
						break;
					}
				} else if (/\.js$/i.test(name)) {
					libs.push({
						standalone: true,
						filename,
						dir: f.parentPath ?? f.path,
					});
				}
			}
			return libs;
		}),
)).then(async libs => {
	libs = libs.flat();
	const result = [];
	for (const item of libs) {
		const {filename} = item;

		const ast = await fs.readFile(filename, 'utf-8').then(text => Object.assign(
			babel_parse(text, {
				sourceType: 'module',
				plugins: ['typescript', 'jsx'],
				ranges: true,
				tokens: true,

			}),
			{md5: md5(text.trim())},
		)), hash = ast['md5'];


		for (const node of ast.program.body) {
			if (node.type !== 'ExpressionStatement') continue;

			const {operator, left, right} = node.expression;
			if (operator !== '=' || left.object?.name !== 'module') continue;


			for (const fn of right?.properties ?? []) {
				// if (fn.key.name !== 'test') continue;

				//规范：没有说明的方法，不予处理
				if (!Array.isArray(fn.leadingComments)) continue;
				const params = new Map(), desc = [];
				for (const item of fn.params) params.set(item.name ?? item?.left?.name, {children: []});

				//解析参数
				for (const {value} of fn.leadingComments) {
					for (const block of comment_parse(`/*${value}*/`)) {
						desc.push(block.description);
						for (const item of block.tags) {
							const {name, tag} = item;
							const description = (item.description ?? '').replace(/^-\s*/, '').trim();
							if (/param/i.test(tag)) {
								const info = {
									name,
									type: item.type || '*',
									description,
									optional: item.optional || false,
									...(item.default !== undefined && {default: item.default})
								}

								if (name.includes('.')) {
									const start = name.indexOf('.');
									params.get(name.slice(0, start)).children.push(Object.assign(info, {name: name.slice(start + 1)}))
								} else Object.assign(params.get(name), info);

							} else if (/return/i.test(tag)) desc.push({
								type: item.type || 'void',
								description: (description || name).replace(/^-\s*/, '').trim(),
								toString() {
									return `函数运行后返回：${name}`;
								},
							});
						}
					}
				}

				const callee = `${fn.key.name}_${hash}`;
				//这里有两种判断，一种是简单的调用，一种是input和shared的方案
				if (
					(params.size === 2 && params.has('input') && params.has('shared'))
					||
					params.size === 3 && params.has('input') && params.has('shared') && params.has('chain')
				) {
					const {children} = params.get('input'), required = children.map(i => i.name);
					result.push({
						type: "function", function: {
							name: callee,
							description: desc.join('\n'),
							parameters: {
								type: "object",
								properties: children,
								[required.length ? 'required' : Symbol('required')]: required,
							},
						},
						[Symbol.for('callee')]: {
							name: fn.key.name,
							path: filename,
							call: (fn, arg, env = inject, chain) => {
								console.log('Call', filename, callee, arg, env);
								return fn(arg, env, chain);
							},
						}
					});
				} else {
					//传统方案
					const required = Array.from(params.keys());
					const args = required.join(','), expose = new Function(`{${args}}`, `return [${args}]`);

					result.push({
						type: "function", function: {
							name: callee,
							description: desc.join('\n'),
							parameters: {
								type: "object",
								properties: params,
								[required.length ? 'required' : Symbol('required')]: required,
							},
						},
						[Symbol.for('callee')]: {
							name: fn.key.name,
							path: filename,
							call: (fn, arg, env = inject) => {
								console.log('Call', filename, callee, arg, env);
								return fn.call(env, ...expose(arg))
							},
						}
					});
				}
			}

		}
	}
	return result;
})

module.exports = use_functions;