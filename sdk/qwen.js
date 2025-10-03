const fs = require('fs/promises');
const {dirname, join, resolve, normalize} = require("path");
const yaml = require('yaml');
const crypto = require("crypto");
const comment = require('comment-parser');
const babel = require('@babel/parser');

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
const get_cache=()=>{
    const val=set_cache.__value??'.cache';
    return val=== resolve(val)?val:resolve(entry.dir, val);
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
 * 构造 user 消息对象。
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
 * @returns {string} 去除缩进后的文本。
 */
const use_trim = text => {
    const rows = (text ?? '').split(/[\r\n]+/g);
    let from = -1;
    for (const row of rows) {
        if (row.length === row.trim().length) continue;
        from = text.match(/\S/).index - 1;
        break;
    }
    if (from === -1) return text.trim();
    return rows.map(row => row.slice(from)).join('\n').trim();
}

// ===== 核心功能 =====

const use_chat = (...args) => Promise.all(args.map(i => (i?.constructor === String || i?.constructor === Number) ? user_say(i) : i))
    .then(input => {
        const messages = [], functions = [], options = {
            model: null, max_tokens: 8192, temperature: 0.7,
            enable_thinking: false,
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

        const req = ['max_tokens', 'temperature', 'tool_choice', 'extra_body']
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
                }, {messages,}),
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
                    for (const item of res.choices) {
                        if (item.finish_reason === 'tool_calls') {
                            called.push(item.message);
                            for (const req of item.message.tool_calls) {
                                const {path, name, call} = functions[req.function.name][Symbol.for('callee')];
                                console.log('Require', path, name);

                                const rs=await Promise.resolve(call($require(path)[name], options[Symbol.for('inject')], JSON.parse(req.function.arguments)))
                                    .catch(e => e)
                                    .then(res => ({
                                        tool_call_id: req.id,
                                        index: req.index,
                                        role: 'tool',
                                        content: JSON.stringify(res ?? null),
                                    }));
                                if(rs instanceof Error) throw rs;
                                called.push(rs);
                            }
                        }
                    }

                    return called.length ? use_chat.apply(null, args.concat(...called)) : new class extends Array {
                        [Symbol.for('upstream')] = {input};
                    }(...res.choices);
                });
    });

/**
 * 递归读取指定目录下的所有函数定义（需配合 babel 解析）。
 * @param {string} path - 目录路径。
 * @param {Object} inject - 注入的变量对象。
 * @returns {Promise<Array>} 函数描述对象数组。
 */
const use_functions = (path, inject = null) =>
    Promise.all((Array.isArray(path) ? path : [path]).map(p => fs.readdir(p, {
        withFileTypes: true,
        recursive: false
    }).catch(e => [])))
        // fs.readdir(path, {withFileTypes: true, recursive: false})
        .then(async rs => {
            const [key] = Object.getOwnPropertySymbols(rs[0]).filter(s => s.description === 'type');

            const dirs = new Set(), libs = [];
            for (const f of rs.flatMap(i => i)) { //排序后再处理，文件夹优先
                const {name} = f, path = f.parentPath ?? f.path;
                const filename = path.slice(0, -join(path).length) + join(path, name);

                if (f.isDirectory()) {
                    // dirs.add(filename);
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

            const result = [], field = Symbol.for('callee');
            // const info = [], memo = {};
            for (const {filename, standalone, dir} of libs) {
                const text = await fs.readFile(filename, 'utf-8'), hash = md5(text);

                for (const node of babel.parse(await fs.readFile(filename, {encoding: 'utf-8'}), {
                    sourceType: 'module',
                    plugins: ['typescript', 'jsx'],
                    ranges: true,
                    tokens: true
                }).program.body) {
                    if (node.type !== 'ExpressionStatement') continue;
                    const {operator, left, right} = node.expression;
                    if (operator !== '=' || left.object?.name !== 'module') continue;

                    for (const fn of right?.properties ?? []) {
                        if (fn.kind !== 'method') continue;
                        const body = {}, desc = [], params = {}, required = [];

                        for (const p of fn.params) {
                            if (p.type === 'Identifier') {
                                params[p.name] = {};
                                required.push(p.name);
                            } else if (p.type === 'AssignmentPattern') params[p.left.name] = {};
                        }

                        if (!Array.isArray(fn.leadingComments)) continue;
                        for (const {value} of fn.leadingComments) {
                            for (const c of comment.parse(`/*${value}*/`)) {
                                desc.push(c.description);
                                for (const t of c.tags) {
                                    if (/param/i.test(t.tag)) params[t.name] = {
                                        type: t.type,
                                        description: t.description,
                                    };
                                    else if (/return/i.test(t.tag)) desc.push(`函数运行后返回：${t.name}`);
                                }
                            }
                        }

                        const name = `fc_${md5(hash, fn.key.name)}`,
                            args = Object.keys(params).join(','),
                            expose = new Function(`{${args}}`, `return [${args}]`);
                        Object.assign(body, {
                            name,
                            description: desc.join('\n'),
                            parameters: {
                                type: "object",
                                properties: params,
                                [required.length ? 'required' : Symbol('required')]: required,
                            },
                        });
                        result.push({
                            type: "function", function: body,
                            [field]: {
                                name: fn.key.name,
                                path: resolve(filename),
                                call: (fn, env = inject, arg) => {
                                    console.log('Call', filename, name, arg, env);
                                    return fn.call(env, ...expose(arg))
                                },
                            }
                        });
                    }
                }
            }
            return result;
        });

const use_inject = value => ({inject: value});
const use_salt = value => ({salt: value});

// ===== 导出 =====

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