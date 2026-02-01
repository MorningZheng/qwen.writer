// 引入飞书SDK、Qwen相关工具和fs的promise版
const Lark = require('@larksuiteoapi/node-sdk');
const qwen = require('./sdk/qwen.js');
const {promises: fs} = require('fs');
const {join} = require("path");

/**
 * Qwen SDK
 * 提供和大模型交互的工具函数
 *
 * @typedef {typeof import('./sdk/qwen.js')} Qwen
 */

/**
 * Feishu SDK
 * 提供和大模型交互的工具函数
 *
 * @typedef {ReturnType<typeof import('./sdk/feishu.js')>} Feishu
 */

/**
 * 载入配置并执行 handler。
 *
 * @template T
 * @param {string | Record<string, any>} env - 配置文件路径或对象
 * @param {(ctx: {feishu: Feishu, qwen: Qwen, env: any, [key: string]: any})=> T | Promise<T>} [handler]
 * @returns {Promise<T | any>} handler 返回值，或配置对象
 */
module.exports = (env, handler) => Promise.resolve(
    env?.constructor === Object
        ? env
        : fs.readFile(env ?? '.env.yaml', 'utf-8').then(require('yaml').parse).catch(e => e)
).then(async env => {
    // 检查必要的环境变量，缺啥直接抛错
    for (const [n, j] of [
        ['qwen', ['key']],
        ['feishu', ['app_id', 'app_secret']],
    ]) for (const k of j) if (!env[n]?.[k]) throw new Error(`缺少环境变量: ${n}.${k}`);

    const {use_env, use_chat, use_functions, user_say, use_content} = qwen;
    // 初始化LLM（Qwen），支持自定义BASE_URL和模型
    await use_env({
        API_KEY: env.qwen.key,
        BASE_URL: env.qwen?.url ?? 'https://dashscope.aliyuncs.com/compatible-mode/v1',
        MODEL: ['deepseek-r1-distill-qwen-32b', 'deepseek-v3'],
    });

    // 初始化飞书SDK
    const feishu = require('./sdk/feishu')(env.feishu.app_id, env.feishu.app_secret);
	// console.log('Feishu Bot initialized.');


    // handler支持自定义注入，否则用默认事件处理
    let listener;
    if (handler) {
        // $require方便handler里用依赖和env
        const $require = Object.assign(id => $require[id] ?? require(id), {env, feishu, qwen});
        listener = await handler($require).then(r=>r??{});
    } else {
        // 用Map维护每个用户的对话上下文
        const chats = new Map();
        listener = {
            // 收到消息事件，走LLM对话，自动维护chats
            'im.message.receive_v1'(data) {
                const {user_id} = data.sender.sender_id;
                use_chat(
                    chats.get(user_id) ?? use_functions(join(__dirname, 'tools'), {env, ...data, user_id}),
                    user_say(JSON.parse(data.message.content).text),
                ).then(rs => {
                    chats.set(user_id, rs);
                    feishu.send_msg(user_id, {content: {text: use_content(rs)}}, 'user_id');
                });
            },
            // 菜单事件，支持一键清空记忆
            'application.bot.menu_v6'(data) {
                if (data.event_key === 'click_me_baby') {
                    const {user_id} = data.operator.operator_id;
                    chats.delete(user_id);
                    feishu.send_msg(user_id, {content: {text: '记忆都清空咯，我们重新来过~'}}, 'user_id');
                }
            },
            // 进入私聊事件，暂时不用
            'im.chat.access_event.bot_p2p_chat_entered_v1'(data) {},//暂时不启用
        };
    }
    // 启动飞书WS监听
    feishu.use_ws(listener).then();

	return {feishu,qwen};
});

// 支持直接node运行本文件，自动加载配置并启动
const [a, b] = [__filename, process.argv[1]].map(f => f.split(/[\\\/]/g).slice(-2).join('/'));
if (a === b) module.exports();