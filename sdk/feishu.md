# feishu.js 功能分析

本模块用于飞书 API 的 Node.js 封装，支持鉴权、Wiki、Bitable 数据表、字段类型映射等常用能力。

## 主要功能

- 飞书 API 客户端创建与鉴权
- tenant_access_token 获取与缓存
- Wiki 页面节点信息解析
- Bitable 应用与数据表操作
- 字段类型映射表

## 导出主函数

```
feishu(app_id, app_secret, expired_delay?)
│
├─ client : 飞书 SDK 客户端
│
├─ get_token() : 获取并缓存 tenant_access_token
│
├─ use_bearer(payload)
│    └─ with(fn) : 注入 Bearer 后执行指定 API 方法
│
├─ get_node_info(url) : 解析 Wiki 页面 URL 并获取节点信息
│
├─ fields_type : Bitable 字段类型映射表
│
└─ use_bit(app_token)
     │
     ├─ get_tables(page_size?) : 获取应用下所有数据表（异步生成器）
     │
     └─ use_table(table_id)
          │
          ├─ add(item) : 新增记录（单条或批量）
          │
          ├─ get_fields() : 获取表字段列表
          │
          └─ add_fields(fields) : 新增字段
```

## 主要函数说明

### feishu(app_id, app_secret, expired_delay?)
- 功能：创建飞书 API 客户端，自动处理鉴权与常用能力。
- 参数：
  - app_id: 应用 App ID
  - app_secret: 应用 App Secret
  - expired_delay: 令牌过期提前量（毫秒，可选）

### get_token()
- 功能：获取并磁盘缓存 tenant_access_token。
- 返回：Promise<string> 有效 token

### use_bearer(payload)
- 功能：包装带租户 Bearer 的 API 调用。
- 参数：payload（API path/params/data）
- 返回：{ with(fn) }
  - with(fn): 执行指定 SDK 方法

### get_node_info(url)
- 功能：解析 Wiki 页面 URL 并获取节点信息。
- 参数：url（Wiki 页面地址）
- 返回：Promise<object|null> 节点信息

### fields_type
- 功能：Bitable 字段类型映射表（中文/英文名 => 类型与 UI 类型）

### use_bit(app_token)
- 功能：Bitable 应用级操作封装。
- 参数：app_token（Bitable App Token）
- 返回：
  - get_tables(page_size?): 获取所有数据表（异步生成器）
  - use_table(table_id): 表级操作

#### use_table(table_id)
- 功能：绑定到指定数据表，返回表级操作。
- 参数：table_id（表 ID）
- 返回：
  - add(item): 新增记录（单条或批量）
  - get_fields(): 获取表字段列表
  - add_fields(fields): 新增字段

---

如需详细用法，请参考源码注释或示例。
