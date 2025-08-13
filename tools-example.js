const {use_llm, use_functions, use_chat, user_say, use_trim} = require('./qwen');


// use_functions('./tools').then(console.log);
use_llm({
    API_KEY: 'sk-587d3552cea74ed28b5fa84fe1ea242b',
    BASE_URL: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    MODEL: ['deepseek-r1-distill-qwen-32b', 'deepseek-v3'],
})
    .then(() => use_chat(
        use_functions('./tools'),
        user_say('遍历data目录下的所有文件，包括子文件夹。以json格式输出'),
    ))
    .then(console.log);