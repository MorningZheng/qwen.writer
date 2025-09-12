const lark = require('@larksuiteoapi/node-sdk');
const yaml = require('yaml');
const {join} = require("path");
const crypto = require("crypto");
const {promises: fs} = require('fs');
const use_ttl_uuid = require('./TTLuuid');
const {from} = require("form-data");

/**
 * 计算多个字符串拼接后的 MD5 十六进制摘要
 * @param {...string} text 参与摘要的字符串
 * @returns {string} 32 位十六进制 MD5
 */
const md5 = (...text) => crypto.createHash('md5').update(text.join('')).digest('hex');
const token_cache = new Map();

// 上移：字段类型常量，避免跨区域依赖不直观
const types = [
    {name: '文本', type: 'Text', value: 1},
    {name: '条码', type: 'Barcode', value: 1},
    {name: '数字', type: 'Number', value: 2},
    {name: '进度', type: 'Progress', value: 2},
    {name: '货币', type: 'Currency', value: 2},
    {name: '评分', type: 'Rating', value: 2},
    {name: '单选', type: 'SingleSelect', value: 3},
    {name: '多选', type: 'MultiSelect', value: 4},
    {name: '日期', type: 'DateTime', value: 5},
    {name: '复选框', type: 'Checkbox', value: 7},
    {name: '人员', type: 'User', value: 11},
    {name: '群组', type: 'GroupChat', value: 23},
    {name: '电话号码', type: 'Phone', value: 13},
    {name: '超链接', type: 'Url', value: 15},
    {name: '附件', type: 'Attachment', value: 17},
    {name: '单向关联', type: 'SingleLink', value: 18},
    {name: '公式', type: 'Formula', value: 20},
    {name: '双向关联', type: 'DuplexLink', value: 21},
    {name: '地理位置', type: 'Location', value: 22},
    {name: '创建时间', type: 'CreatedTime', value: 1001},
    {name: '最后更新时间', type: 'ModifiedTime', value: 1002},
    {name: '创建人', type: 'CreatedUser', value: 1003},
    {name: '修改人', type: 'ModifiedUser', value: 1004},
    {name: '自动编号', type: 'AutoNumber', value: 1005}
];

/**
 * 创建飞书 API 辅助客户端，封装鉴权、Wiki/Bitable、IM、Drive 等常用能力
 * @param {string} app_id 应用 App ID
 * @param {string} app_secret 应用 App Secret
 * @param {number} [expired_delay=6000] 令牌过期提前量（毫秒）（当前实现未使用，占位参数）
 * @returns {object} 封装的 API 访问器集合
 */
module.exports = (app_id, app_secret, temp_dir, expired_delay = 0.1 * 60 * 1000) => {

    const client = new lark.Client({
        appId: app_id,
        appSecret: app_secret,
        disableTokenCache: false,
    });

    /**
     * 获取并磁盘缓存 tenant_access_token；缓存有效则直接返回，否则刷新后写回
     * @returns {Promise<string>} 有效的 tenant token
     */
    const get_token = async () => {
        const key = md5(`sloane::${app_id}=${app_secret}`);
        if (!token_cache.has(key)) {
            const filename = join(temp_dir ?? process.env.TMP ?? require('os').tmpdir(), `sloane.lark.${md5(key)}.json`);
            token_cache.set(key, {
                filename,
                data: await fs.readFile(filename, 'utf8').then(JSON.parse).catch(e => null),
            });
        }
        const {data} = token_cache.get(key);
        if (data?.until > Date.now()) return data.tenant_access_token;

        //e.response.data
        const rs = await client.auth.v3.tenantAccessToken.internal({data: {app_id, app_secret}}).catch(e => e);
        if (rs instanceof Error) throw new Error(rs.response.data);
        if (rs?.msg === 'ok') {
            rs.until = (rs.expire - 30) * 1000 + Date.now();
            return fs.writeFile(token_cache.get(key).filename, JSON.stringify(rs), 'utf8').then(() => rs.tenant_access_token);
        } else throw Object.assign(new Error(rs.msg), rs);
    }

    /**
     * 包装带租户 Bearer 的调用管道，统一处理鉴权与标准化返回
     * @param {object} payload 传入 SDK 的 path/params/data
     * @returns {{with(fn: Function): Promise<any>}} 执行器，调用 with(fn) 触发
     */
    const use_bearer = payload => ({
        /**
         * 使用已注入 Bearer 的客户端执行指定 SDK 方法
         * @param {Function} fn Lark SDK 方法（例如 client.im.v1.message.create）
         * @returns {Promise<any>} 标准化结果（自动解包 msg==='success' 的 data）
         */
        with(fn) {
            if (!fn) throw new Error('The next step must be specified');
            return get_token()
                .then(token => fn(payload ?? {}, lark.withTenantToken(token)))
                .then(res => {
                    if (res.writeFile || res.getReadableStream) return res;
                    else if (res.msg === 'success') return res.data;
                    else throw Object.assign(new Error(res.msg), res);
                });
        },
    });

    /**
     * 解析 Wiki 页面 URL 并获取节点信息
     * @param {string|URL} url Wiki 页面地址
     * @returns {Promise<object|null>} 节点信息（node）或 null
     */
    const get_node_info = url => {
        const re = /\b(wiki|base|docx)\/(\w+)$/.exec((url.constructor === String ? URL.parse(url) : url).pathname);
        if (!re) return Promise.resolve(null);

        if (re[1] === 'docx') return Promise.resolve(re[2]);

        if (re[1] === 'base') return use_bearer({
            path: {
                app_token: re[2],
            },
        }).with(client.bitable.v1.app.get).then(rs => rs.app);

        return use_bearer({
            params: {
                token: re[2],
                obj_type: 'wiki',
            },
        }).with(client.wiki.v2.space.getNode).then(rs => rs.node);
    }

    /**
     * Bitable 字段类型映射表（中文名/英文名 => {type, ui_type}）
     * @type {Record<string, {type:number, ui_type:string}>}
     */
    const fields_type = (() => {
        const data = {};
        for (const {name, type, value} of types) {
            data[name] = data[type.toLowerCase()] = {type: value, ui_type: type};
        }
        return data;
    })();

    /**
     * Bitable 应用级操作封装
     * @param {string} app_token Bitable App Token
     * @returns {{app_token:string, get_tables: function, use_table: function}} 应用访问器
     */
    const use_bit = app_token => ({
        app_token,
        /**
         * 遍历获取应用下所有数据表（异步生成器）
         * @param {number} [page_size=20] 分页大小
         * @returns {AsyncGenerator<object>} 表元信息条目
         */
        get_tables(page_size = 20) {
            return get_token().then(token => (async function* () {
                let page_token = undefined;
                do {
                    const rs = await use_bearer({path: {app_token}, params: {page_size, page_token}})
                        .with(client.bitable.v1.appTable.list)
                        .catch(e => e);

                    if (rs instanceof Error) throw rs;

                    if (rs.has_more) page_token = rs.page_token;
                    else page_token = undefined;
                    for (const item of rs.items) yield item;
                } while (page_token);
            })());
        },
        /**
         * 绑定到指定数据表，返回表级操作
         * @param {string} table_id 表 ID
         * @returns {{table_id:string, add:function, get_fields:function, add_fields:function}} 表访问器
         */
        use_table(table_id) {
            const uuid = use_ttl_uuid(table_id);
            return {
                table_id,
                /**
                 * 新增记录（支持单条或批量）
                 * @param {object|object[]} item 记录或记录数组（字段名->值）
                 * @returns {Promise<any>} 接口返回
                 */
                add(item) {
                    const [call, data] = Array.isArray(item)
                        ? ['batchCreate', {records: item.map(f => ({fields: f}))}]
                        : ['create', {fields: item}];

                    return use_bearer({
                        path: {app_token, table_id},
                        params: {
                            user_id_type: 'open_id',
                            client_token: uuid.use(item),
                            ignore_consistency_check: true,
                        },
                        data,
                    }).with(client.bitable.v1.appTableRecord[call]);
                },
                /**
                 * 获取表字段列表
                 * @returns {Promise<object[]>} 字段数组
                 */
                get_fields: () => use_bearer({
                    path: {app_token, table_id},
                    params: {
                        page_size: 999,
                    },
                }).with(client.bitable.v1.appTableField.list).then(rs => rs.items),
                /**
                 * 批量创建字段
                 * @param {{name:string,type:string}|Array<{name:string,type:string}>} fields 字段定义（中文/英文类型名均可）
                 * @returns {Promise<any[]>} 创建结果数组
                 */
                add_fields(fields) {
                    const todos = [];
                    for (const item of Array.isArray(fields) ? fields : [fields]) {
                        todos.push({...fields_type[item.type.toLowerCase()], field_name: item.name});
                    }
                    const path = {app_token, table_id};
                    return Promise.all(todos.map(data => use_bearer({
                        path,
                        data
                    }).with(client.bitable.v1.appTableField.create)));
                },
            }
        },
    });

    /**
     * 通过 Bitable/Wiki 页面 URL 解析出 {book, table}
     * @param {string} url 包含表 ID（或默认首个表）的页面 URL
     * @returns {Promise<{book:any, table:any}>} Bitable 应用与表访问器
     */
    const use_table = async url => {
        const u = URL.parse(url), info = await get_node_info(u);
        const book = use_bit(info.obj_token ?? info.app_token);
        return {
            book,
            table: book.use_table(u.searchParams.get('table') ?? await book.get_tables()
                .then(r => r.next())
                .then(f => f.value.table_id)),
        }
    };

    const use_doc = async id => {
        const document_id = id.startsWith('http') ? await get_node_info(URL.parse(id)).then(r => r.obj_token ?? r) : id;

        // process.exit();
        const use_convert = (from, content, offset) => get_token().then(token => lark.withTenantToken(token))
            .then(access => client.docx.v1.document.convert(
                    {
                        params: {user_id_type: 'open_id'},
                        data: {content_type: from, content},
                    },
                    access,
                ).then(r => client.docx.v1.documentBlockDescendant.create({
                    path: {document_id, block_id: document_id},
                    params: {document_revision_id: -1, user_id_type: 'open_id'},
                    data: {
                        index: offset,
                        children_id: r.data.first_level_block_ids,
                        descendants: r.data.blocks.map(i => Object.assign(i, {parent_id: undefined})),
                    }
                }, access))
            );

        return {
            document_id,
            get types() {
                return doc_types;
            },
            ls: () => use_bearer({
                path: {
                    document_id,
                },
                params: {page_size: 500, document_revision_id: -1},
            }).with(client.docx.v1.documentBlock.list).then(r => r.items),
            from_html: (content, offset) => use_convert('html', content, offset),
            from_md: (content, offset) => use_convert('markdown', content, offset),
            /**
             * @returns {Promise<string>}
             */
            to_html: () => use_bearer({
                path: {
                    document_id,
                },
                params: {page_size: 500, document_revision_id: -1},
            }).with(client.docx.v1.documentBlock.list).then(r => {
                const root = {};
                for (const node of r.items) {
                    if (node.block_type === 1) Object.assign(root, node);
                    else root[node.block_id] = node;
                }

                (function walk(node) {
                    if (Array.isArray(node.children))
                        for (const i in node.children) {
                            const id = node.children[i];
                            node.children[i] = walk(root[id]);
                        }
                    return node;
                })(root);

                const dom = (function walk(children) {
                    const rs = [];
                    for (const node of children) {
                        const type = doc_types.get(node.block_type);
                        if (type) {
                            const {md, tag} = type;
                            rs.push(`<${tag}>`);
                            if (node[md]?.elements) {
                                for (const el of walk(node[md]?.elements)) {
                                    rs.push(el);
                                }
                            }
                            if (node.children) {
                                const nodes = walk(node.children);
                                if (['ol', 'ul'].includes(tag)) {
                                    rs.push('<li>', ...nodes, '</li>');
                                } else rs.push(...nodes);
                            }

                            rs.push(`</${tag}>`);
                        } else rs.push(`<p>${node.text_run.content}</p>`);
                    }
                    return rs;
                })(root.children);
                dom.unshift('<html lang="zh">', '<body>');
                dom.push('</body>', '</html>');
                return dom.join('\n');
            }),
        }
    }


    /**
     * 群聊能力封装：信息、菜单、配置、发送与拉取消息
     * @param {string} chat_id 群聊 ID
     * @returns {{chat_id:string, get_info:function, get_menu:function, get_config:function, send_msg:function, get_messages:function,get_tabs:function}}
     */
    const use_chat = chat_id => {
        const uuid = use_ttl_uuid(chat_id);
        const expose = {
            chat_id,
            /**
             * 获取群聊信息
             * @returns {Promise<object>}
             */
            get_info: () => use_bearer({path: {chat_id}}).with(client.im.v1.chat.get),
            /**
             * 获取群菜单树
             * @returns {Promise<object>} 菜单树
             */
            get_menu: () => use_bearer({path: {chat_id}})
                .with(client.im.v1.chatMenuTree.get)
                .then(rs => rs.menu_tree),
            /**
             * 将群菜单转换为 {名称: URL} 配置映射
             * @returns {Promise<Record<string,string>>}
             */
            get_config: () => expose.get_tabs().then(tabs => {
                const data = {}, todo = [];
                for (const {tab_content: {doc}, tab_type: type, tab_name: name} of tabs) {
                    if (type !== 'doc') continue;
                    if (name.toLowerCase().endsWith('.yaml')) todo.push(use_fs(doc).read_yaml().then(config => Object.assign(data, {config})));
                    else todo.push(use_table(doc).then(r => Object.assign(data, r)));
                }
                return Promise.all(todo).then(() => data);
            }),
            /**
             * 向群发送消息
             * @param {object|string} data 文本或消息体对象
             * @param {string} [msg_type='text'] 消息类型
             * @returns {Promise<object>}
             */
            send_msg: (data, msg_type = 'text') => use_bearer({
                params: {
                    receive_id_type: 'chat_id',
                },
                data: {
                    receive_id: chat_id,
                    msg_type,
                    content: JSON.stringify(data.constructor === String ? {text: data} : data),
                    uuid: uuid.use(data),
                },
            }).with(client.im.v1.message.create),
            reply_msg: (msg_id, data, msg_type) => use_bearer({
                path: {
                    message_id: msg_id,
                },
                data: {
                    content: JSON.stringify(data.constructor === String ? {text: data} : data),
                    msg_type: 'text',
                    reply_in_thread: false,
                },
            }).with(client.im.v1.message.reply),
            /**
             * 拉取群消息列表
             * @param {number|Date} [start] 起始时间（毫秒时间戳或 Date）
             * @param {number|Date} [until] 结束时间（毫秒时间戳或 Date）
             * @param {number|string} [page_token] 翻页令牌或页大小
             * @returns {Promise<object>} 列表与翻页信息
             */
            get_messages: (start, until, page_token) => use_bearer({
                params: {
                    container_id_type: 'chat',
                    container_id: chat_id,
                    start_time: start ? Math.floor((start instanceof Date ? start.getTime() : start) / 1000) : undefined,
                    end_time: until ? Math.ceil((until instanceof Date ? until.getTime() : until) / 1000) : undefined,
                    sort_type: 'ByCreateTimeDesc',
                    page_size: Number.isInteger(page_token) ? page_token : 20,
                    page_token,
                },
            }).with(client.im.v1.message.list).then(r => r.items),
            get_tabs: () => use_bearer({path: {chat_id}}).with(client.im.v1.chatTab.listTabs).then(r => r.chat_tabs),
        };

        return expose;
    };

    /**
     * Drive 文件/文件夹访问器
     * @param {string} url 形如 https://.../(file|folder)/{token}
     * @returns {{read_file?:function, read_yaml?:function} | {folder_token:string, ls:function, use_hash:function}}
     */
    const use_fs = url => {
        const [, type, token] = /\b(file|folder)\/(\w+)$/.exec(URL.parse(url).pathname) ?? [];
        if (!type || !token) throw new Error('Invalid file system URL');

        /**
         * 下载文件为 Buffer
         * @param {string} file_token 文件 token
         * @returns {Promise<Buffer>}
         */
        const read_file = file_token => use_bearer({path: {file_token}})
            .with(client.drive.v1.file.download)
            .then(rs => new Promise(rel => {
                const data = [];
                rs.getReadableStream().on('data', buf => data.push(buf)).once('end', () => {
                    rel(Buffer.concat(data));
                    data.length = 0;
                });
            }));
        /**
         * 下载 YAML 并解析为对象
         * @param {string} file_token 文件 token
         * @returns {Promise<any>}
         */
        const read_yaml = file_token => read_file(file_token).then(buf => yaml.parse(buf.toString()));

        if (/file/ig.test(type)) {
            return {
                /**
                 * 读取文件 Buffer
                 * @returns {Promise<Buffer>}
                 */
                read_file() {
                    return read_file(token);
                },
                /**
                 * 读取 YAML 并解析
                 * @returns {Promise<any>}
                 */
                read_yaml() {
                    return read_yaml(token);
                },
            }
        } else if (/folder/ig.test(type)) {
            const folder_token = token;
            return {
                folder_token,
                /**
                 * 列出文件夹内文件
                 * @returns {Promise<object[]>}
                 */
                ls: () => use_bearer({
                    params: {
                        page_size: 50,
                        folder_token,
                        order_by: 'EditedTime',
                        direction: 'DESC',
                    },
                }).with(client.drive.v1.file.list).then(rs => rs.files),
                /**
                 * 基于 token + modified_time 生成快照哈希
                 * @param {Array<{token:string, modified_time:string}>} files 文件列表
                 * @returns {string} md5 摘要
                 */
                use_hash(files) {
                    const md5 = crypto.createHash('md5');
                    files.forEach(file => md5.update(file.token + file.modified_time));
                    return md5.digest('hex');
                },
            };
        }
    }

    /**
     * 消息级操作封装（转发、撤回、回复）
     * @param {string} msg_id 消息 ID
     * @returns {{forward:function, revoke:function, reply:function, read:function}}
     */
    const use_msg = msg_id => {
        return {
            /**
             * 转发消息至指定群
             * @param {string} chat_id 目标群 ID
             * @returns {Promise<object>}
             */
            forward: (chat_id) => use_bearer({
                params: {
                    receive_id_type: 'chat_id',
                },
                data: {
                    receive_id: chat_id,
                },
                path: {
                    msg_id,
                },
            }).with(client.im.v1.message.forward),
            /**
             * 撤回消息
             * @returns {Promise<object>}
             */
            revoke: () => use_bearer({path: {msg_id}}).with(client.im.v1.message.revoke),
            /**
             * 回复消息（线程内）
             * @param {object} data 回复内容
             * @returns {Promise<object>}
             */
            reply: data => use_bearer({
                path: {msg_id},
                data: {
                    ...data,
                    reply_in_thread: true,
                },
            }).with(client.im.v1.message.reply),
            read: () => use_bearer({
                path: {message_id: msg_id},
                params: {user_id_type: 'open_id'},
            }).with(client.im.v1.message.get).then(r=>r.items.map(i=>{
                if(i.msg_type==='text')i.body.content=JSON.parse(i.body.content);
                return i;
            })),
        }
    }

    /**
     * 获取有权限访问的群列表
     * @returns {Promise<object[]>} 群列表
     */
    const get_chat_list = () => use_bearer({})
        .with(client.im.v1.chat.list)
        .then(rs => rs.items);

    /**
     * 获取用户信息
     * @param {string} user_id 用户 ID
     * @returns {Promise<object>} 用户详情
     */
    const get_user = user_id => use_bearer({
        path: {user_id},
        params: {
            department_id_type: 'department_id',
            user_id_type: 'user_id',
        },
    }).with(client.contact.v3.user.get).then(r => r.user);

    // 按功能域组织（仅顺序优化，保持实现不变）
    // 1) 鉴权与通用：client, get_token, use_bearer
    // 2) Wiki & Bitable：get_node_info, fields_type, use_bit, use_table
    // 3) IM：use_chat, use_msg, get_chat_list
    // 4) Drive：use_fs
    // 5) Contact：get_user

    // 导出对象顺序调整（仅重排，保持成员不变）
    return {
        // 鉴权与通用
        lark,
        client,
        use_ws(hooks, params = {}) {
            return new lark.WSClient({
                appId: app_id,
                appSecret: app_secret,
            }).start({eventDispatcher: new lark.EventDispatcher(params).register(hooks)});
        },
        get_token,
        use_bearer,

        // Wiki & Bitable
        get_node_info,
        use_bit,
        use_doc,
        use_table,

        // IM
        use_chat,
        use_msg,
        get_chat_list,

        // Drive
        use_fs,

        // 其他
        fields_type,
        get_user,

        send_msg: (id, data, receive_id_type) => {
            return use_bearer({
                params: {
                    receive_id_type,
                },
                data: {
                    receive_id: id,
                    msg_type: 'text',
                    content: JSON.stringify(data.constructor === String ? {text: data} : data),
                },
            }).with(client.im.v1.message.create);
        },
    }
}


const doc_types = new Map();
for (const item of [
    {"md": "page", "val": 1, "tag": "div"},
    {"md": "text", "val": 2, "tag": "p"},
    {"md": "heading1", "val": 3, "tag": "h1"},
    {"md": "heading2", "val": 4, "tag": "h2"},
    {"md": "heading3", "val": 5, "tag": "h3"},
    {"md": "heading4", "val": 6, "tag": "h4"},
    {"md": "heading5", "val": 7, "tag": "h5"},
    {"md": "heading6", "val": 8, "tag": "h6"},
    {"md": "heading7", "val": 9, "tag": "h6"},
    {"md": "heading8", "val": 10, "tag": "h6"},
    {"md": "heading9", "val": 11, "tag": "h6"},
    {"md": "bullet", "val": 12, "tag": "ul"},
    {"md": "ordered", "val": 13, "tag": "ol"},
    {"md": "code", "val": 14, "tag": "pre"},
    {"md": "quote", "val": 15, "tag": "blockquote"},
    {"md": "todo", "val": 17, "tag": "input"},
    {"md": "bitable", "val": 18, "tag": "table"},
    {"md": "callout", "val": 19, "tag": "aside"},
    {"md": "chat_card", "val": 20, "tag": "section"},
    {"md": "diagram", "val": 21, "tag": "svg"},
    {"md": "divider", "val": 22, "tag": "hr"},
    {"md": "file", "val": 23, "tag": "a"},
    {"md": "grid", "val": 24, "tag": "div"},
    {"md": "grid_column", "val": 25, "tag": "div"},
    {"md": "iframe", "val": 26, "tag": "iframe"},
    {"md": "image", "val": 27, "tag": "img"},
    {"md": "isv", "val": 28, "tag": "embed"},
    {"md": "mindnote", "val": 29, "tag": "section"},
    {"md": "sheet", "val": 30, "tag": "table"},
    {"md": "table", "val": 31, "tag": "table"},
    {"md": "table_cell", "val": 32, "tag": "td"},
    {"md": "view", "val": 33, "tag": "div"},
    {"md": "quote_container", "val": 34, "tag": "blockquote"},
    {"md": "task", "val": 35, "tag": "li"},
    {"md": "okr", "val": 36, "tag": "section"},
    {"md": "okr_objective", "val": 37, "tag": "h3"},
    {"md": "okr_key_result", "val": 38, "tag": "li"},
    {"md": "okr_progress", "val": 39, "tag": "progress"},
    {"md": "add_ons", "val": 40, "tag": "div"},
    {"md": "jira_issue", "val": 41, "tag": "section"},
    {"md": "wiki_catalog", "val": 42, "tag": "nav"},
    {"md": "board", "val": 43, "tag": "section"},
    {"md": "agenda", "val": 44, "tag": "section"},
    {"md": "agenda_item", "val": 45, "tag": "li"},
    {"md": "agenda_item_title", "val": 46, "tag": "h4"},
    {"md": "agenda_item_content", "val": 47, "tag": "p"},
    {"md": "link_preview", "val": 48, "tag": "a"},
    {"md": "source_synced", "val": 49, "tag": "section"},
    {"md": "reference_synced", "val": 50, "tag": "section"},
    {"md": "sub_page_list", "val": 51, "tag": "ul"},
    {"md": "ai_template", "val": 52, "tag": "template"},
    {"md": "undefined", "val": 999, "tag": "div"}
]) doc_types.set(item.md, item).set(item.val, item);