## 项目简介

Writer 是我用 Node.js 写的一个自动化写作和数据处理小工具。核心思路很简单：把大模型 API 封装成函数，自动 function-call 和记忆过程，帮你生成个性化、无 AI 痕迹的文章，还能读本地文件做数据分析，甚至自动发邮件、对接企业客服系统，省心省力，效率拉满。

---

## 目录结构

```text
writer
│
├── package.json         # Node.js 项目依赖和配置信息
├── qwen.js              # 主逻辑/入口 JS 文件
├── readme.md            # 说明文档（你现在看到的这个）
├── tools-example.js     # 工具函数示例
├── writer-example.js    # 主要功能实现
├── feishu-bot.js        # 接入飞书机器人的示例
├── .env.yaml            # 主要功能实现（需要自己建立）
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

---

## 主要功能

- 一键生成风格贴合自己的说明文档（比如《不在港说明》），完全看不出 AI 痕迹。
- 支持本地文件读取和数据分析，数据处理也能自动化。
- 可以自动发邮件，或者对接企业微信、飞书等聊天机器人，直接用 IM 做界面。
- 只要提示词写得好，复杂任务都能自动跑通。

---

## 快速开始

1. **安装依赖**  
   在项目根目录下运行：
   ```bash
   npm install
   ```

2. **运行示例**  
   推荐直接用 IDE（WebStorm、VSCode 都行）调试 `writer-example.js`，体验下完整流程。  
   也可以命令行直接跑：
   ```bash
   node writer-example.js
   ```

3. **获取 Qwen 的 API Key**  
   自己去这里申请：  
   https://help.aliyun.com/zh/model-studio/get-api-key?spm=a2c4g.11186623.0.i2

4. **配置环境变量**  
   在项目根目录下新建 `.env.yaml` 文件，内容如下：
```yaml
qwen:
  key: 【千问key】
feishu:
  app_id: 【飞书appid】
  app_secret: 【飞书secret】
```
   也可以直接在代码里写死 API Key（见下面的说明）。

5. **IDE 里直接写死 API Key 也行**  
   懒得配环境变量的话，把 `API_KEY: process.env.API_KEY` 里的 `process.env.API_KEY` 直接换成你的 api key 就行。

---

## 对接飞书机器人

- 推荐直接接入飞书机器人，把它当作你的图形界面用，体验极佳。
- 请按“自动回复机器人”进行配置。
- 飞书机器人官方文档地址：  
  https://open.feishu.cn/document/develop-robots/quick-start
- 配置好 `feishu.app_id` 和 `feishu.app_secret` 后，相关功能就能跑起来了。

---

## 图形界面支持

- 暂时没打算做 GUI，因为函数都封装得很顺手，直接用 IM 机器人就够用。
- 如果你有更复杂的界面需求，欢迎提 issue，后续可以考虑扩展。

---

## 扩展能力

- 目前只做了基础的文件系统操作（读文件、遍历文件夹），日常用完全够。
- 有其他想法或者需求，欢迎在 issue 区留言，我会酌情加功能。
