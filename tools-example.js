const {use_env, use_functions, use_chat, user_say, use_content} = require('./sdk/qwen');


// use_functions('./tools').then(rs=>console.log(JSON.stringify(rs,null,2)));

use_env('.env',{
    BASE_URL: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    MODEL: ['deepseek-r1-distill-qwen-32b', 'deepseek-v3'],
})
    .then(() => use_chat(
        use_functions('./tools'),
        user_say('遍历sdk目录下的所有文件，包括子文件夹。'),
	    // user_say('测试方式你好。'),
    ))
    .then(res=>{
        return use_content(res)
    })
    .then(console.log);