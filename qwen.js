const {promises: fs} = require('fs');
const {join, dirname} = require('path');
const yaml = require('yaml');
const crypto = require("crypto");
const comment = require('comment-parser');
const babel = require('@babel/parser');

/**
 * 计算输入文本的 MD5 哈希值。
 * @param {...string} text - 要哈希的文本。
 * @returns {string} 哈希值。
 */
const md5 = (...text) => crypto.createHash('md5').update(text.join('')).digest('hex');

const entry = {file: process.argv[1], dir: dirname(process.argv[1])};
const use_env = options => Promise.resolve(Object.assign(use_env, options));

const maps = new WeakMap();
const $require = require('module').createRequire(entry.file);

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
const use_prompt = (...names) => Promise.all(names.map((name) => fs.readFile(join(set_prompt.__path ?? 'prompt', `${name}.md`), 'utf-8')));

const ANSWER_RESULT = Symbol.for('ANSWER_RESULT');


/**
 * 设置缓存文件夹路径。
 * @param {string} path - 缓存文件夹路径。
 * @returns {Function} set_cache 本身。
 */
const set_cache = path => Object.assign(set_cache, {__path: path});

/**
 * 调用大模型进行多轮对话，自动缓存结果。
 * @param {...any} args - 消息数组或 assistant 结果。
 * @returns {Promise<any>} assistant 返回的 choices。
 */
const use_chat = (...args) =>
    Promise.all(args.map(i => i?.[ANSWER_RESULT] ? use_assistant(i) : i))
        .then(input => {
            const messages = [], functions = [], salt = [];
            let tool_choice = undefined;
            (function walk(rows) {
                for (const item of rows) {
                    if (!item) continue;
                    if (Array.isArray(item)) walk(item);
                    else if (item.type === 'function') {
                        if (item.function.hasOwnProperty('description')) functions.push(item);
                        else tool_choice = item;
                    } else if (item.constructor === String || item.constructor === Number) salt.push(String(item));
                    else messages.push(item);
                }
            })(input);

            /** @type array*/
            console.log(`\x1b[33m${messages.slice(-1)[0].content?.slice?.(0, 100)}...\x1b[0m`);
            const req = {model: use_env.MODEL[0], messages, max_tokens: 8192, temperature: 0.7};
            if (functions.length) Object.assign(req, {
                model: use_env.MODEL[1] ?? use_env.MODEL[0],
                tools: functions,
                tool_choice,
            });
            const body = JSON.stringify(req);

            const filename = join(entry.dir, set_cache.__path ?? '.cache', `${md5(body, ...salt)}.yaml`);
            return fs.readFile(filename, 'utf-8').then(t => yaml.parse(t).res.choices).catch(e =>
                fetch(`${use_env.BASE_URL}/chat/completions`, {
                    method: 'POST',
                    headers: {
                        Authorization: `Bearer ${use_env.API_KEY}`,
                        'Content-Type': 'application/json',
                    },
                    body,
                })
                    .then(res => res.json())
                    .then(res => {
                        if (res.error) throw Object.assign(new Error(res.error.messages), res.error);
                        else return fs.mkdir(dirname(filename), {recursive: true})
                            .then(() => fs.writeFile(filename, yaml.stringify({salt, req, res}, null, 4)))
                            .then(() => res.choices);
                    })
            ).then(async rs => {
                rs[ANSWER_RESULT] = true;
                maps.set(rs, {messages, functions, tool_choice, salt});

                //执行函数链的调用
                if (rs[0].finish_reason === 'tool_calls') {
                    let call_result;
                    for (const {message} of rs) {
                        for (const req of message.tool_calls) {
                            const {path, name, call} = use_functions[req.function.name];
                            call_result = await Promise.resolve(call($require(path)[name], JSON.parse(req.function.arguments)))
                                .catch(e => e.toString())
                                .then(res => use_chat(
                                    ...salt,
                                    functions,
                                    messages,
                                    message,
                                    {
                                        tool_call_id: req.id,
                                        index: req.index,
                                        role: 'tool',
                                        content: JSON.stringify(res === undefined ? null : res),
                                    },
                                ));
                        }
                    }
                    return call_result;
                }

                return rs;
            });
        });

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
 * @param {...string} content - 消息内容。
 * @returns {Promise<{role: string, content: string}>} system 消消息对象。
 */
const sys_say = (...content) =>
    Promise.all(content.map(r => Promise.resolve(r)))
        .then(r => ({role: "system", content: r.join('\r\n')}));

/**
 * 提取 assistant 返回内容中的纯文本。
 * @param {Array} input - assistant 返回的消息数组。
 * @returns {string} 拼接后的内容。
 */
const use_content = input => {
    const res = [];

    for (const {message: {content}} of input) res.push(content);
    return res.join('\r\n');
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
 * 将 assistant 返回的内容合并到消息历史中。
 * @param {any} input - assistant 返回的 choices。
 * @returns {Promise<Array>} 合并后的消息数组。
 */
const use_assistant = input => Promise.resolve(input).then(rs => {
    const memory = maps.get(rs);
    const msg = maps.get(rs).messages.slice(0);
    if (Array.isArray(memory.functions)) msg.push(...memory.functions, memory.tool_choice);
    for (const {message: {content}} of rs) msg.push({role: "assistant", content});
    return msg;
});

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
        from = text.match(/\S/).index;
        break;
    }
    if (from === -1) return text.trim();
    return rows.map(row => row.slice(from)).join('\n').trim();
}

/**
 * 递归读取指定目录下的所有函数定义（需配合 babel 解析）。
 * @param {string} path - 目录路径。
 * @param {Object} env - 环境变量对象，包含 API_KEY 和 BASE_URL 等。
 * @returns {Promise<Array>} 函数描述对象数组。
 */
const use_functions = async (path, env) => {
    const result = [];
    path = await fs.realpath(path);
    for (const f of await fs.readdir(path, {withFileTypes: true})) {
        const filename = join(path, f.name);
        if (f.isDirectory()) result.push(...await use_functions(filename, env));
        else {
            (function walk(nodes) {
                for (const node of nodes) {
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
                                    if (t.tag !== 'param') continue;
                                    params[t.name] = {
                                        type: t.type,
                                        description: t.description,
                                    };
                                }
                            }
                        }
                        result.push({type: "function", function: body});
                        const args = Object.keys(params).join(','), hash = md5(filename),
                            name = `fc_${hash}_${fn.key.name}`;

                        use_functions[name] = {
                            name: fn.key.name,
                            path: filename,
                            call: new Function('env', `return (fn,{${args}})=>fn.call(env,${args})`)(env),//允许导入env，使用this访问
                        };
                        Object.assign(body, {
                            name,
                            description: desc.join('\n'),
                            parameters: {
                                type: "object",
                                properties: params,
                                [required.length ? 'required' : Symbol('required')]: required,
                            },
                        });
                    }
                }
            })(babel.parse(await fs.readFile(filename, {encoding: 'utf-8'}), {
                sourceType: 'module',
                plugins: ['typescript', 'jsx'],
                ranges: true,
                tokens: true
            }).program.body);
        }
    }

    return result;
};

module.exports = {
    use_prompt,
    use_chat,
    user_say,
    sys_say,
    system_say: sys_say,
    use_assistant,
    use_memory: use_assistant,
    use_markdown,
    use_trim,
    use_content,
    set_cache,
    use_functions,
    use_env,
    use_llm: use_env,
}