## 项目简介

> 本项目旨在让大模型“更好用、更易扩展”。核心理念是：将大模型 API 封装为函数，自动实现 function-call 和记忆管理。
> 示例展示了如何通过本地提示词，生成个性化、无 AI 痕迹的文章。
> 你还可以用本地文件做数据分析，甚至自动发邮件、对接企业客服系统。`feishu-bot.js` 提供了完整的飞书机器人接入示例。

---

## 目录结构

```text
writer
│
├── package.json         # Node.js 项目依赖和配置信息
├── qwen.js              # 主逻辑/入口 JS 文件
├── readme.md            # 说明文档（即本文件）
├── tools-example.js     # 工具函数示例
├── writer-example.js    # 主要功能实现
├── feishu-bot.js        # 飞书机器人接入示例
├── .env.yaml            # 环境变量配置（需自行创建）
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

## 快速开始

1. **安装依赖**  
   在项目根目录执行：
   ```bash
   npm install
   ```

2. **运行示例**  
   推荐用 IDE（如 WebStorm、VSCode）调试 `writer-example.js`，体验完整流程。  
   也可直接命令行运行：
   ```bash
   node writer-example.js
   ```

3. **获取 Qwen API Key**  
   前往以下地址申请：  
   https://help.aliyun.com/zh/model-studio/get-api-key?spm=a2c4g.11186623.0.i2

4. **配置��境变量**  
   在项目根目录新建 `.env.yaml`，内容如下：
   ```yaml
   qwen:
     key: 【千问key】
   feishu:
     app_id: 【飞书appid】
     app_secret: 【飞书secret】
   ```
   你也可以直接在代码中写死 API Key（见下文）。

5. **直接在代码中写死 API Key（可选）**  
   如果不想配置环境变量，可将 `API_KEY: process.env.API_KEY` 里的 `process.env.API_KEY` 直接替换为你的 API Key。

---

## 功能说明

### 1. 飞书机器人接入

- 推荐通过飞书机器人作为图形界面，体验最佳。
- 请按“自动回复机器人”方式配置。
- 飞书机器人官方文档：  
  https://open.feishu.cn/document/develop-robots/quick-start
- 配置好 `feishu.app_id` 和 `feishu.app_secret` 后，即可使用相关功能。

### 2. 企业微信/飞书机器人扩展

> 理论上，将 `feishu-bot` 的 SDK 和 API 替换为企业微信即可，功能保持一致。
> 你也可以将本项目作为模块库，直接引入 `feishu-bot`，自定义函数。例如：

```javascript
require('./feishu-bot')({
   // 你的环境配置
}, $require => { // $require 是相对于 feishu-bot 的 require
    return {
        // 自定义响应飞书的钩子
       'im.message.receive_v1'(args) {
            // 处理逻辑
            return `处理结果：${args}`;
        }
    }
})
```

---

## 图形界面支持

- 暂无 GUI 计划，因函数封装已足够顺手，直接用 IM 机器人即可满足需求。
- 如有更复杂的界面需求，欢迎提 issue，后续可考虑扩展。

---

## 扩展能力

- 目前已支持基础文件系统操作（如读文件、遍历文件夹），日常使用足够。
- 有其他想法或需求，欢迎在 issue 区留言，会酌情添加新功能。
