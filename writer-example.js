// 引入自定义的qwen模块，包含与大模型交互的各种工具函数
const {
    use_env,         // 初始化大模型API
    use_chat,        // 用于与大模型进行多轮对话
    system_say,      // 系统角色发言
    user_say,        // 用户角色发言
    use_trim,        // 去除字符串首尾空白
    use_markdown,    // 将输出格式化为Markdown
    use_prompt,      // 读取prompt模板
    use_functions    // 加载自定义函数工具
} = require('./qwen');


// 初始化大模型API，配置API_KEY、接口地址和模型列表
use_env({
    BASE_URL: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    MODEL: ['deepseek-r1-distill-qwen-32b', 'deepseek-v3'],
})
    // 第一步：读取范本示例prompt，作为用户输入，进行初步对话
    .then(() => use_chat(user_say(use_prompt('示例提取', '范本示例1'))))
    // 第二步：将大模型的输出格式化为Markdown
    .then(use_markdown)
    // 第三步：将范本内容作为系统角色，结合自定义函数，读取个性化要求，发起新一轮对话
    .then(who_i_am => use_chat(
        use_functions('./tools'), // 加载自定义工具函数
        system_say(who_i_am),     // 系统角色发言，内容为范本示例
        user_say(use_trim(`
        # 任务要求
        读取prompt/个性化要求.md，结合读取prompt/范本示例1.md，生成一篇不在港说明。

        # 输出约束
        1. 以Markdown格式输出，禁止添加任何解释。
        2. 针对每个问题，给出详细描述并举例说明。
        `)),
    ))
    // 第四步：继续多轮对话，正式生成不在港说明正文
    .then(memory => use_chat(
        memory, // 传递前文结果下文
        user_say(
            use_trim(`
            # 任务描述

            1. 撰写：《关于翁智超先生不在港的情况说明》。
            2. 请将以下个性化要求，按逻辑的顺序，整合到文章中，突出科技优势、之前软件著作权，对香港的业务有什么促进作用。
            3. 核心能帮他创造收入，根据信息列表，参考【个性化要求】，一定要参照我的口气来写，注意使用长短句，避免AI味道。
            4. 每个段落都要恳切真诚，不少于300字。
            5. 繁体字输出。
            `),
            '# 个性化要求',
            use_prompt('个性化要求') // 读取个性化要求prompt
        ),
        user_say('请帮我将以上提示词转换为Markdown格式的文章。')
    ))
    // 第五步：将最终输出格式化为Markdown并打印到控制台
    .then(use_markdown)
    .then(console.log);
