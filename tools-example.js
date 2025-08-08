const {use_functions, use_chat, user_say, use_content} = require('./qwen');


use_chat(
    use_functions('./tools'),
    user_say('读取D:\\Object\\Node\\NLP\\hk\\tools-example.js的文件内容。然后将读取的文件内容发送到飞书聊天oc_b76cd206932a81a768e2cc510f3a7724当中。'),
)
    .then(console.log);


// use_functions('./tools').then(console.log);