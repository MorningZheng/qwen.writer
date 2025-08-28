process.loadEnvFile('.env');

const {use_llm, use_functions, use_chat, user_say, use_trim} = require('./qwen');

use_llm({
    API_KEY: process.env.API_KEY,
    BASE_URL: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    MODEL: ['deepseek-r1-distill-qwen-32b', 'deepseek-v3'],
})
    .then(() => use_chat(
        use_functions('./tools'),
        user_say('遍历.data目录下的所有文件，包括子文件夹。'),
    ))
    .then(console.log);