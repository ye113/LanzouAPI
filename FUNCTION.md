# FUNCTION.md — 功能说明与实现文档

## 项目简介

LanzouAPI 是一个蓝奏云链接解析器，支持解析带密码/无密码的蓝奏云分享链接，返回文件直链或直接触发下载。同时提供 Cloudflare Worker 版本，利用边缘缓存提升响应速度。

## 项目文件结构

```
/
├── index.php          # 原始 PHP 版本（传统服务端）
├── worker.js          # Cloudflare Worker 版本（JS）
├── wrangler.toml      # Worker 部署配置
├── FUNCTION.md        # 本文件
├── README.md          # 使用说明
└── LICENSE
```

---

## 核心功能

接收蓝奏云分享链接，爬取页面提取文件信息，调用蓝奏云内部接口获取真实下载直链，最终返回 JSON 格式的文件信息或 302 跳转至直链。

### 功能列表

| 功能 | 说明 |
|------|------|
| 解析无密码链接 | 从蓝奏云分享页提取 iframe → AJAX 接口获取直链 |
| 解析带密码链接 | 检测页面含 `function down_p()` 后，POST 密码完成验证 |
| 文件失效检测 | 页面包含"文件取消分享了"时直接返回 400 |
| 文件名提取 | 支持多种蓝奏云版本的正则匹配 |
| 文件大小提取 | 从页面元素提取文件大小 |
| 直链解析 | 获取最终 302 跳转后的真实下载地址 |
| 直接下载模式 | `type=down` 参数触发 302 跳转 |
| 自定义后缀 | `n` 参数自定义下载文件名后缀 |

---

## 模块实现说明

### 参数说明

| 参数 | 必填 | 说明 | 示例 |
|------|------|------|------|
| `url` | 是 | 蓝奏云分享链接 | `https://www.lanzouq.com/xxxxx` |
| `pwd` | 否 | 分享密码 | `1234` |
| `type` | 否 | `down` 时跳转下载 | `down` |
| `n` | 否 | 自定义文件名后缀 | `.apk` |

### 返回格式

```json
{
  "code": 200,
  "msg": "解析成功",
  "name": "文件名.zip",
  "filesize": "29.0 M",
  "downUrl": "https://..."
}
```

---

## Cloudflare Worker 优化

### Worker 架构

```
用户请求
  │
  ▼
请求 URL 含 url 且 type≠down？
  ├── 是 → 检查 Cloudflare 边缘缓存
  │       ├── 命中 (HIT) → 直接返回 (≈13ms)
  │       └── 未命中 → 执行解析流程 → 写入缓存 → 返回
  │
  └── 否 (type=down) → 跳过缓存 → 执行解析 → 302 跳转
```

### 解析流程

```
1. fetchPage(normUrl)
   ├── 检测"文件取消分享了" → 返回 400
   ├── 提取文件名、文件大小
   └── 判断页面是否含 function down_p()
       │
       ├── 有密码 → 提取 sign/ajaxm → postData → 解析 JSON
       └── 无密码 → 提取 iframe URL
                    ├── 有 webpage 参数 → 直接提取 sign/ajaxm → postData
                    └── 无 webpage → fetchPage(iframe) → 提取 wp_sign/ajaxdata/ajaxm → postData

2. 解析 postData 返回的 JSON
   ├── zt ≠ 1 → 返回 400 错误信息
   └── zt = 1 → 获取 dom + url，拼接直链地址

3. fetchRedirectUrl → 获取 302 跳转后的最终直链

4. 输出
   ├── type=down → 302 跳转至直链
   └── 其他 → 返回 JSON（写入缓存）
```

### 网络请求函数

| 函数 | 用途 | HTTP 方法 | 参数 |
|------|------|-----------|------|
| `fetchPage` | 获取页面 HTML | GET | url, cookie, referer |
| `postData` | POST 表单数据 | POST | post_data, url, referer, cookie |
| `fetchRedirectUrl` | 获取重定向地址 | GET (redirect: manual) | url, referer, cookie |
| `randIP` | 生成随机 X-Forwarded-For | — | — |

---

## 缓存机制

### 缓存策略

| 场景 | 是否缓存 | 说明 |
|------|---------|------|
| JSON 成功响应 (code 200) | ✅ | `s-maxage=1800, max-age=1800` |
| 错误响应 (400) | ❌ | 避免链接恢复后返回旧错误 |
| 302 跳转 (type=down) | ❌ | 直链每次不同，无缓存意义 |

### 环境变量

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `CACHE_TTL` | `1800` | 缓存时长（秒），建议 1800~2400 |
| `COOKIE` | `""` | 蓝奏云请求 Cookie（预留） |
| `LANZOU_DOMAIN` | `www.lanzouf.com` | 蓝奏云域名 |

### 缓存层级

```
用户浏览器 (max-age=1800)
    │ 30 分钟有效期
    ▼
Cloudflare 边缘节点 (s-maxage=1800)
    │ cf-cache-status: HIT → 13ms 返回
    │ cf-cache-status: MISS → 执行 Worker
    ▼
Worker → 蓝奏云服务器 (国内，7011ms)
```

---

## 已知局限

1. **不支持分享文件夹** — 仅支持单个文件分享链接
2. **直链有时效** — 通常有效 35~47 分钟，CACHE_TTL 建议不超过 30 分钟
3. **依赖蓝奏云页面结构** — 蓝奏云改版可能导致正则匹配失效，需同步更新
4. **`acw_sc__v2` 反爬** — 代码保留 `acwScV2Simple` 函数但未启用（当前蓝奏云未强制验证）

---

## 蓝奏云解析流程（时序图）

```
用户                    Worker                  蓝奏云
 │                        │                       │
 │  GET ?url=xxx          │                       │
 │───────────────────────►│                       │
 │                        │  GET 分享页            │
 │                        │──────────────────────►│
 │                        │◄──────────────────────│ (page HTML)
 │                        │                       │
 │                        │  提取 iframe URL       │
 │                        │                       │
 │                        │  GET iframe 页         │
 │                        │──────────────────────►│
 │                        │◄──────────────────────│ (iframe HTML)
 │                        │                       │
 │                        │  POST 获取直链         │
 │                        │──────────────────────►│
 │                        │◄──────────────────────│ (JSON: dom+url)
 │                        │                       │
 │                        │  GET 重定向            │
 │                        │──────────────────────►│
 │                        │◄──────────────────────│ (302 → 直链)
 │                        │                       │
 │  JSON {downUrl: ...}   │                       │
 │◄───────────────────────│                       │
```

---

## 部署与配置

### wrangler.toml

```toml
name = 'lanzouapi'
main = 'worker.js'
compatibility_date = '2025-01-01'

[vars]
CACHE_TTL = '1800'
```

### Cloudflare Dashboard 设置

| 位置 | 设置项 | 值 |
|------|--------|-----|
| 缓存 → 配置 → Browser Cache TTL | Respect Existing Headers | ✅ |
| Workers & Pages → lanzouapi → 设置 → 环境变量 | CACHE_TTL | 1800 |
