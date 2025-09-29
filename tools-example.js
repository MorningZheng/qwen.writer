const {use_env, use_functions, use_chat, user_say,use_content} = require('./qwen');

use_env('.env',{
    BASE_URL: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    MODEL: ['deepseek-r1-distill-qwen-32b', 'deepseek-v3'],
})
    .then(() => use_chat(
        use_functions('./tools'),
        user_say('遍历sdk目录下的所有文件，包括子文件夹。'),
    ))
    .then(res=>{
        return use_content(res)
    })
    .then(console.log);