const fs = require('fs/promises');
const {dirname, join, resolve, normalize, posix} = require("path");
const yaml = require('yaml');
const crypto = require("crypto");

const entry = {file: process.argv[1], dir: dirname(process.argv[1])};
const $require = require('module').createRequire(entry.file);

// ===== 工具函数 =====

/**
 * 计算输入文本的 MD5 哈希值。
 * @param {...string} text - 要哈希的文本。
 * @returns {string} 哈希值。
 */
const md5 = (...text) => crypto.createHash('md5').update(text.join('')).digest('hex');

// ===== 环境与配置相关 =====

/**
 * @function
 * @param inputs {string|object}
 * @returns {Promise<Awaited<any>>|Promise<Awaited<unknown>[]>}
 * @property {Object} __value - 当前环境变量的缓存值
 */
const use_env = (...inputs) => Promise.all(inputs.map(input => input.constructor === Object
	? Promise.resolve(use_env.__value = Object.assign(use_env.__value ?? {}, input)) : Promise.all([
		new Promise((rel, rej) => {
			try {
				process.loadEnvFile(input);
				rel(use_env.__value = Object.assign(use_env.__value ?? {}, process.env));
			} catch (e) {
				rej(e);
			}
		}),
		...[input, join(entry.dir, input)].map(f => fs.readFile(f, 'utf-8')
			.then(t => yaml.isDocument(t) ? yaml.parse(t) : JSON.parse(t))
			.then(r => use_env.__value = Object.assign(use_env.__value ?? {}, r))
			.catch(e => e)),
	]).then(() => use_env.__value)));

/**
 * 设置缓存文件夹路径。
 * @param {string} path - 缓存文件夹路径。
 * @returns {Function} set_cache 本身。
 */
const set_cache = path => Object.assign(set_cache, {__value: path});
const get_cache = () => {
	const val = set_cache.__value ?? '.cache';
	return val === resolve(val) ? val : resolve(entry.dir, val);
}

/**
 * 设置 prompt 文件夹路径。
 * @param {string} path - prompt 文件夹路径。
 * @returns {Function} set_prompt 本身。
 */
const set_prompt = path => Object.assign(set_prompt, {__path: path});

/**
 * 读取指定名称的 prompt 文件内容。
 * @param {...string} names - prompt 文件名（不含扩展名）。
 * @returns {Promise<string[]>} 各 prompt 文件内容数组。
 */
const use_prompt = (...names) => Promise.all(names.map((name) => fs.readFile(join(set_prompt.__path ?? 'prompt', /\.md$/.test(name) ? name : `${name}.md`), 'utf-8')));

// ===== 消息构造相关 =====

/**
 * 构造 user 消消息对象。
 * @param {...string|Promise} content - 消息内容。
 * @returns {Promise<{role: string, content: string}>} user 消息对象。
 */
const user_say = (...content) =>
	Promise.all(content.map(r => Promise.resolve(r)))
		.then(r => ({role: "user", content: r.join('\r\n')}));

/**
 * 构造 system 消息对象。
 * @param {...string|Promise} content - 消息内容。
 * @returns {Promise<{role: string, content: string}>} system ���消息对象。
 */
const system_say = (...content) =>
	Promise.all(content.map(r => Promise.resolve(r)))
		.then(r => ({role: "system", content: r.join('\r\n')}));

// ===== 内容处理相关 =====

/**
 * 提取 assistant 返回内容中的纯文本。
 * @param {Array} input - assistant 返回的消息数组。
 * @returns {string} 拼接后的内容。
 */
const use_content = input => {
	const res = [];
	for (const {message: {content}} of input) res.push(content);
	return res.join('\r\n').trim();
}

const use_json = rs => {
	let j = null;
	for (const {message: {content}} of rs) {
		const s = content.indexOf('```json') + 7;
		j ? Object.assign(j, JSON.parse(s === 6 ? content : content.slice(s, -3))) : j = JSON.parse(s === 6 ? content : content.slice(s, -3));
	}
	return j;
}

/**
 * 提取 assistant 返回内容中的 markdown 文本。
 * @param {Array} input - assistant 返回的消息数组。
 * @returns {string} 拼接后的 markdown 内容。
 */
const use_markdown = input => {
	const res = [];
	for (const {message: {content}} of input) {
		if (content.slice('```markdown')) res.push(content.slice('```markdown`'.length, -3).trim());
		else res.push(content);
	}
	return res.join('\r\n');
}

/**
 * 去除文本每行的统一缩进。
 * @param {string} text - 输入文本。
 * @returns {Promise<string>} 去除缩进后的文本。
 */
const use_trim = text => {
	const rows = (text ?? '').split(/[\r\n]+/g);
	let from = -1;
	for (const row of rows) {
		if (row.length === row.trim().length) continue;
		from = text.match(/\S/).index - 1;
		break;
	}
	return Promise.resolve(from === -1 ? text.trim() : rows.map(row => row.slice(from)).join('\n').trim());
}

// ===== 核心功能 =====

/**
 * @param {string|promise|object|await} args
 * @returns {Promise<undefined | any | {find: {<S extends T>(predicate: (value: T, index: number, obj: T[]) => value is S, thisArg?: any): (S | undefined), (predicate: (value: T, index: number, obj: T[]) => unknown, thisArg?: any): (T | undefined)}, findIndex(predicate: (value: T, index: number, obj: T[]) => unknown, thisArg?: any): number, fill(value: T, start?: number, end?: number): Promise<string | void>, copyWithin(target: number, start: number, end?: number): Promise<string | void>, toLocaleString: {(locales: (string | string[]), options?: (Intl.NumberFormatOptions & Intl.DateTimeFormatOptions)): string, (): string}, [Symbol.iterator](): ArrayIterator<T>, entries(): ArrayIterator<[number, T]>, keys(): ArrayIterator<number>, values(): ArrayIterator<T>, readonly [Symbol.unscopables]: {[K in keyof any[]]?: boolean}, includes(searchElement: T, fromIndex?: number): boolean, flatMap<U, This=undefined>(callback: (this:This, value: T, index: number, array: T[]) => (ReadonlyArray<U> | U), thisArg?: This): U[], flat<A, D=1 extends number>(this:A, depth?: D): FlatArray<A, D>[], at(index: number): (T | undefined), findLast: {<S extends T>(predicate: (value: T, index: number, array: T[]) => value is S, thisArg?: any): (S | undefined), (predicate: (value: T, index: number, array: T[]) => unknown, thisArg?: any): (T | undefined)}, findLastIndex(predicate: (value: T, index: number, array: T[]) => unknown, thisArg?: any): number, toReversed(): T[], toSorted(compareFn?: (a: T, b: T) => number): T[], toSpliced: {(start: number, deleteCount: number, ...items: T[]): T[], (start: number, deleteCount?: number): T[]}, with(index: number, value: T): T[], length: number, toString(): string, pop(): (T | undefined), push(...items: T[]): number, concat: {(...items: ConcatArray<T>): T[], (...items: ConcatArray<T> | T[]): T[]}, join(separator?: string): string, reverse(): T[], shift(): (T | undefined), slice(start?: number, end?: number): T[], sort(compareFn?: (a: T, b: T) => number): Promise<string | void>, splice: {(start: number, deleteCount?: number): T[], (start: number, deleteCount: number, ...items: T[]): T[]}, unshift(...items: T[]): number, indexOf(searchElement: T, fromIndex?: number): number, lastIndexOf(searchElement: T, fromIndex?: number): number, every: {<S extends T>(predicate: (value: T, index: number, array: T[]) => value is S, thisArg?: any): this is S[], (predicate: (value: T, index: number, array: T[]) => unknown, thisArg?: any): boolean}, some(predicate: (value: T, index: number, array: T[]) => unknown, thisArg?: any): boolean, forEach(callbackfn: (value: T, index: number, array: T[]) => void, thisArg?: any): void, map<U>(callbackfn: (value: T, index: number, array: T[]) => U, thisArg?: any): U[], filter: {<S extends T>(predicate: (value: T, index: number, array: T[]) => value is S, thisArg?: any): S[], (predicate: (value: T, index: number, array: T[]) => unknown, thisArg?: any): T[]}, reduce: {(callbackfn: (previousValue: T, currentValue: T, currentIndex: number, array: T[]) => T): T, (callbackfn: (previousValue: T, currentValue: T, currentIndex: number, array: T[]) => T, initialValue: T): T, <U>(callbackfn: (previousValue: U, currentValue: T, currentIndex: number, array: T[]) => U, initialValue: U): U}, reduceRight: {(callbackfn: (previousValue: T, currentValue: T, currentIndex: number, array: T[]) => T): T, (callbackfn: (previousValue: T, currentValue: T, currentIndex: number, array: T[]) => T, initialValue: T): T, <U>(callbackfn: (previousValue: U, currentValue: T, currentIndex: number, array: T[]) => U, initialValue: U): U}, [p: number]: T}>}
 */
const use_chat = (...args) => Promise.all(args.map(i => (i?.constructor === String || i?.constructor === Number) ? user_say(i) : i))
	.then(input => {

		const messages = [], functions = [], options = {
			model: null, max_tokens: 8192, temperature: 0.7,
			enable_thinking: false,
			extra_body: {
				get enable_thinking() {
					return options.enable_thinking ?? false;
				},
			},
			cache_path: get_cache(),
			BASE_URL: use_env.__value.BASE_URL,
			[Symbol.for('inject')]: undefined,
		};

		(function walk(rows) {
			for (const item of rows) {
				if (!item) continue;
				if (Array.isArray(item)) {
					if (Array.isArray(item[Symbol.for('upstream')]?.input)) walk(item[Symbol.for('upstream')]?.input);
					walk(item);
				} else if (item.hasOwnProperty('role') && item.hasOwnProperty('content')) messages.push(item);
				else if (item.type === 'function') {
					if (item.function.hasOwnProperty('description')) functions.push(functions[item.function.name] = item);
					else options.tool_choice = item;
				} else if (item.message && item['finish_reason']) messages.push(item.message);
				else if (item.constructor === Object) Object.assign(options, item);
			}
		})(input);

		const req = ['max_tokens', 'temperature', 'tool_choice', 'extra_body', 'enable_thinking']
			.reduce((o, k) => (options[k] ? o[k] = options[k] : false, o),
				Object.assign(functions.length ? {
					get model() {
						return options.model ?? use_env.__value.MODEL[1] ?? use_env.__value.MODEL[0];
					},
					tools: functions,
					parallel_tool_calls: false,
				} : {
					get model() {
						return options.model ?? use_env.__value.MODEL[0];
					},
				}, {messages}),
			);

		const hash = md5([messages, functions, options, req.model].map(i => JSON.stringify(i)).join('\n'));

		const cache_path = join(options.cache_path, `${hash}.yaml`);
		console.log('Cache', cache_path);

		const [{content}] = messages.slice(-1);
		console.log(`\x1b[33mAsking :${content.length > 100 ? `${content.slice(0, 100)}...` : content}\x1b[0m`);
		return fs.readFile(cache_path, 'utf-8')
			.then(t => yaml.parse(t).res)
			.catch(e => fetch(`${options.BASE_URL}/chat/completions`, {
					method: 'POST',
					headers: {
						Authorization: `Bearer ${use_env.__value.API_KEY}`,
						'Content-Type': 'application/json',
					},
					body: JSON.stringify(req),
				})
					.then(res => res.json())
					.then(res => {
						if (res.error) throw Object.assign(new Error(res.error.message ?? res.error.messages), res.error);
						return fs.mkdir(dirname(cache_path), {recursive: true})
							.then(() => fs.writeFile(cache_path, yaml.stringify({
								time: new Date().toLocaleString(),
								req,
								res
							}, null, 4)))
							.then(() => res);
					})
			)
			.then(
				/**
				 * @param {{choices: Array<{message: {role: string, content: string, tool_calls?: Array<{function: Object, id: string, type: string, arguments: string, index?: number}>}, index?: number, finish_reason?: string}>}} res
				 */
				async res => {
					const called = [];
					let stop_reason = undefined;

					LoopAsk:
						for (const item of res.choices) {
							if (item.finish_reason === 'tool_calls') {
								called.push(item.message);
								for (const req of item.message.tool_calls) {
									const {path, name, call} = functions[req.function.name][Symbol.for('callee')];
									console.log('Require', path, name);

									try {
										const rs = await call($require(path)[name], JSON.parse(req.function.arguments), options[Symbol.for('inject')], res);
										if (
											rs === Symbol.for('stop_output') || Symbol.for('stop') || Symbol.for('break')
											|| rs?.hasOwnProperty(Symbol.for('stop_output'))
											|| rs?.hasOwnProperty(Symbol.for('break'))
											|| rs?.hasOwnProperty(Symbol.for('stop'))
										) {
											stop_reason = rs;
											break LoopAsk;
										} else if (rs !== undefined) called.push({
											tool_call_id: req.id,
											index: req.index,
											role: 'tool',
											content: JSON.stringify(rs ?? null),
										});
									} catch (e) {
										console.error(e);
										// called.push({
										// 	tool_call_id: req.id,
										// 	index: req.index,
										// 	role: 'tool',
										// 	content: `Error: ${e.message}`,
										// });
										stop_reason = e;
									}
								}
							}
						}

					// console.log(stop_reason);
					if (stop_reason !== undefined) return stop_reason;
					return called.length ? use_chat.apply(null, args.concat(...called)) : new class extends Array {
						[Symbol.for('upstream')] = {input};
					}(...res.choices);
				});
	});

const {parse: babel_parse} = require('@babel/parser');
const {parse: comment_parse} = require('comment-parser');

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
				const params = Object.assign(new Map(), {lost: []}), desc = [];
				for (const item of fn.params) {
					const name = item.name ?? item?.left?.name, data = {children: []};
					name ? params.set(name, data) : params.lost.push(data);
				}


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
								} else {
									if (params.has(name)) Object.assign(params.get(name), info)
									else {
										const data = params.lost.shift();
										params.set(name, Object.assign(data, info));
									}
								}
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
								console.log('Call', filename, callee);//, arg, env
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
});

const use_inject = value => ({inject: value});
const use_salt = value => ({salt: value});

// ===== 导出 =====

/**
 * qwen SDK 导出集合。
 *
 * @module qwen
 * @property {(...text: string[]) => string} md5 计算输入文本的 MD5 哈希值。
 * @property {( ...inputs: (string|Object)[] ) => Promise<any>} use_env 加载/合并环境与配置（支持文件或对象），返回合并后的环境对象（缓存于 use_env.__value）。
 * @property {(path: string) => Function & {__value?: string}} set_cache 设置缓存目录路径（返回自身，可读取 set_cache.__value）。
 * @property {() => string} get_cache (内部使用) 获取解析后的缓存路径。
 * @property {(path: string) => Function & {__path?: string}} set_prompt 设置 prompt 文件夹路径（返回自身，可读取 set_prompt.__path）。
 * @property {(...names: string[]) => Promise<string[]>} use_prompt 读取指定名称的 prompt 文件内容（按 .md 后缀解析）。
 * @property {( ...content: (string|Promise)[] ) => Promise<{role: string, content: string}>} user_say 构造 user 消息对象。
 * @property {( ...content: (string|Promise)[] ) => Promise<{role: string, content: string}>} system_say 构造 system 消息对象。
 * @property {(input: Array) => string} use_content 提取 assistant 返回中的纯文本并拼接。
 * @property {(rs: Array) => any} use_json 从返回结果中提取并合并 JSON 内容。
 * @property {(input: Array) => string} use_markdown 提取 assistant 返回中的 markdown 文本。
 * @property {(text: string) => Promise<string>} use_trim 去除文本每行的统一缩进并返回处理后的文本。
 * @property {(...args: any[]) => Promise<any>} use_chat 核心聊天调用函数；接受消息、函数描述及选项，支持缓存与工具调用。
 * @property {*} use_functions 本地工具加载器（来自 ./use_functions）。
 * @property {(value: any) => {inject: any}} use_inject 注入辅助对象到 options。
 * @property {(value: any) => {salt: any}} use_salt 为请求构造 salt 包装。
 *
 * 说明：以上类型注释旨在提高编辑器提示与快速查阅，具体参数细节参见源码实现。
 */
module.exports = {
	// 工具
	md5,
	// 环境与配置
	use_env,
	set_cache,
	set_prompt,
	use_prompt,
	// 消息构造
	user_say,
	system_say,
	// 内容处理
	use_content,
	use_markdown,
	use_trim,
	// 核心功能
	use_chat,
	use_functions,
	use_inject, use_salt,
	use_json,
};