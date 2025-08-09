## 项目简介

Writer 是一个基于 Node.js 的自动化写作和数据处理小工具。核心思路是把大模型 API 封装成函数，自动 function-call 和记忆过程，能帮你生成个性化、无 AI 痕迹的文章，还能读本地文件做数据分析，甚至自动发邮件、对接企业客服系统，省心省力。

## 目录结构

```text
writer
│
├── package.json         # Node.js 项目依赖和配置信息
├── qwen.js              # 主逻辑/入口 JS 文件
├── readme.md            # 说明文档（你现在看到的这个）
├── tools-example.js     # 工具函数示例
├── writer.js            # 主要功能实现
│
├── prompt/              # 提示词/模板目录
│   ├── 个性化要求.md    # 个性化需求
│   ├── 示例提取.md      # 示例提取说明
│   ├── 范本示例1.md     # 范本示例 1
│   └── 范本示例2.md     # 范本示例 2
│
└── tools/               # 工具函数目录
    └── fs.js            # 文件系统相关工具
```

## 主要功能

- 生成符合自己风格、无 AI 痕迹的说明文档（比如《不在港说明》）。
- 支持本地文件读取和数据分析。
- 可以自动发邮件，或者对接企业微信、飞书等聊天机器人。
- 只要提示词写得好，复杂任务都能自动搞定。

## 快速开始

1. **安装依赖**  
   在项目根目录下运行：
   ```bash
   npm install
   ```
2. **运行示例**  
   推荐用 IDE（WebStorm、VSCode 都行）调试 `writer-example.js`，体验一把完整流程。  
   也可以直接命令行跑：
   ```bash
   node writer-example.js
   ```
3. **获取 Qwen 的 API Key**  
   自己去这里申请：https://help.aliyun.com/zh/model-studio/get-api-key?spm=a2c4g.11186623.0.i2
4. **配置环境变量**  
   命令行执行要配好 env，WebStorm 可以在 settings -> tools -> terminal 里设置。
5. **IDE 里直接写死 API Key 也行**  
   懒得配环境变量的话，把 `API_KEY: process.env.API_KEY` 里的 `process.env.API_KEY` 直接换成你的 api key 就行。

## 图形界面支持

- 暂时没打算做 GUI，因为函数都封装得很顺手了。
- 推荐直接接入飞书、企业微信等聊天机器人当界面。如果你有需求，欢迎提 issue，后续可以考虑扩展。

## 扩展能力

- 目前只做了基础的文件系统操作（读文件、遍历文件夹），够用就行。
- 有其他想法或者需求，欢迎在 issue 区留言，我会酌情加功能。
