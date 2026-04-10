# 归档管理功能使用指南

## 概述

本文档介绍如何使用卫戍协议多人联机服务的归档管理功能，包括配置管理员密码、访问归档页面、下载和删除归档文件等。

## 功能特性

### ✅ 密码保护
- 访问归档管理功能需要输入管理员密码
- 会话有效期24小时，自动过期
- 支持退出登录

### ✅ 归档文件管理
- 查看所有归档文件列表
- 下载归档文件
- 删除归档文件
- 显示文件详细信息（归档时间、房间ID、房主ID、玩家数、时长、文件大小）

### ✅ 用户友好界面
- 响应式设计，支持移动端
- 实时更新服务器状态
- 操作成功/失败提示

## 快速开始

### 1. 配置管理员密码

在项目根目录创建 `.env` 文件：

```bash
# 复制示例文件
cp .env.example .env

# 编辑 .env 文件，设置管理员密码
# ADMIN_PASSWORD=your_secure_password_here
```

**重要提示**：
- 请使用强密码（建议至少12位，包含大小写字母、数字和特殊字符）
- 不要将 `.env` 文件提交到 Git（已配置在 `.gitignore` 中）
- 定期更换密码以提高安全性

### 2. 启动服务器

```bash
# 方式1: 直接启动（使用默认端口3000）
node server.js

# 方式2: 使用环境变量
ADMIN_PASSWORD=your_password node server.js
```

服务器启动后会显示：

```
============================================================
卫戍协议多人联机服务已启动 (v2.0)
服务地址: http://localhost:3000
============================================================
...
管理员密码: 已配置（使用环境变量 ADMIN_PASSWORD）
============================================================
```

如果看到 `⚠️  警告: 未配置管理员密码`，请检查 `.env` 文件是否正确配置。

### 3. 访问归档管理页面

在浏览器中打开：`http://localhost:3000/developer`

点击顶部导航栏的 **"📦 归档管理"** 标签。

## 使用流程

### 登录

1. 在归档管理页面，输入管理员密码
2. 点击"登录"按钮或按回车键
3. 登录成功后会显示归档文件列表

### 查看归档文件

归档文件列表显示以下信息：

| 字段 | 说明 |
|------|------|
| 归档时间 | 房间归档的时间（本地时区） |
| 房间ID | 过期房间的唯一标识符 |
| 房主ID | 房主玩家ID（p1-p4） |
| 玩家数 | 房间内玩家的总数 |
| 时长 | 房间从创建到过期的持续时间（小时） |
| 文件大小 | 归档文件的大小（KB） |

**性能优化说明**：
- 为了保证系统性能，归档列表默认只显示最新的100个存档
- 列表顶部会显示实际总存档数量
- 如果需要查看特定存档，可以通过API直接下载或使用高级查询功能

### 下载归档文件

1. 在归档文件列表中，找到要下载的文件
2. 点击该行的 **"下载"** 按钮
3. 浏览器会自动下载 JSON 格式的归档文件
4. 文件名格式：`{时间戳}_{序号}_{房间ID}.json`

**归档文件内容示例**：

```json
{
  "archived_at": "2026-04-03T16:30:00.000Z",
  "room_id": "ABC123",
  "host_player_id": "p1",
  "created_at": "2026-04-03T15:00:00.000Z",
  "expires_at": "2026-04-03T16:30:00.000Z",
  "duration_ms": 5400000,
  "duration_hours": "1.50",
  "room_settings": {
    "max_players": 4,
    "enable_battle_progress_detection": false,
    "enable_leak_count_detection": false,
    "host_display_text": ""
  },
  "player_count": 3,
  "players": [
    {
      "player_id": "p1",
      "player_name": "测试房主",
      "static": {
        "boss": "昆图斯",
        "ban_list": ["拉特兰", "卡西米尔"],
        "enemy_type": ["隐匿", "折射"],
        "strategy": "保守"
      },
      "dynamic": {
        "phase": "battle",
        "round": "11",
        "money": 30,
        "operators": [...],
        "alliance_stack": {...},
        "leak_count": 1,
        "cc_level": 5
      },
      "is_host": true,
      "last_updated": "2026-04-03T16:29:50.000Z"
    }
  ]
}
```

### 删除归档文件

1. 在归档文件列表中，找到要删除的文件
2. 点击该行的 **"删除"** 按钮
3. 确认删除操作（弹窗提示）
4. 删除成功后会自动刷新列表

**警告**：删除操作不可恢复，请谨慎操作！

### 退出登录

1. 在归档管理页面右上角，点击 **"退出登录"** 按钮
2. 返回到登录界面

会话会在以下情况下失效：
- 主动退出登录
- 24小时后自动过期
- 服务器重启

## API 接口（开发者）

除了 Web 界面，也可以通过 API 访问归档管理功能：

### 登录

```bash
curl -X POST http://localhost:3000/api/admin/login \
  -H "Content-Type: application/json" \
  -d '{"password":"your_password"}'
```

响应：
```json
{
  "success": true,
  "message": "登录成功",
  "data": {
    "token": "session_1710280305000_abc123xyz"
  }
}
```

### 获取归档列表

```bash
curl http://localhost:3000/api/admin/archives \
  -H "Authorization: session_1710280305000_abc123xyz"
```

### 下载归档文件

```bash
curl http://localhost:3000/api/admin/archives/2026-04-03T16-30-00_ABC123_测试房主.json \
  -H "Authorization: session_1710280305000_abc123xyz" \
  -o downloaded_file.json
```

### 删除归档文件

```bash
curl -X DELETE http://localhost:3000/api/admin/archives/2026-04-03T16-30-00_ABC123_测试房主.json \
  -H "Authorization: session_1710280305000_abc123xyz"
```

### 检查登录状态

```bash
curl http://localhost:3000/api/admin/check \
  -H "Authorization: session_1710280305000_abc123xyz"
```

### 退出登录

```bash
curl -X POST http://localhost:3000/api/admin/logout \
  -H "Authorization: session_1710280305000_abc123xyz"
```

## 安全建议

### 1. 密码安全
- 使用强密码（至少12位，包含大小写字母、数字和特殊字符）
- 定期更换密码
- 不要使用常见密码或个人信息

### 2. 环境变量
- `.env` 文件不应提交到版本控制系统
- 生产环境使用安全的密钥管理系统（如 AWS Secrets Manager、Azure Key Vault）
- 限制 `.env` 文件的访问权限：`chmod 600 .env`

### 3. 网络安全
- 生产环境使用 HTTPS
- 配置防火墙规则，限制访问
- 使用反向代理（如 Nginx）配置额外的安全层

### 4. 会话管理
- 会话默认24小时过期
- 服务器重启后会清除所有会话
- 敏感操作建议重新登录

## 故障排除

### 问题1: 无法登录

**症状**：输入密码后提示"密码错误"

**解决方案**：
1. 检查 `.env` 文件是否存在
2. 确认 `ADMIN_PASSWORD` 已正确设置
3. 重启服务器使环境变量生效
4. 检查密码中是否有空格或特殊字符

### 问题2: 归档列表为空

**症状**：登录后显示"暂无归档文件"

**解决方案**：
1. 这是正常情况，表示还没有房间过期
2. 可以手动创建测试房间并修改 `ROOM_EXPIRY_TIME` 来快速测试
3. 检查 `archived_rooms/` 目录是否有权限问题

### 问题3: 下载文件失败

**症状**：点击下载按钮后没有反应或下载失败

**解决方案**：
1. 检查浏览器控制台是否有错误信息
2. 确认文件存在于 `archived_rooms/` 目录
3. 检查服务器日志是否有错误
4. 尝试刷新页面重新登录

### 问题4: 删除文件失败

**症状**：点击删除按钮后提示失败

**解决方案**：
1. 检查文件是否被其他程序占用
2. 确认 `archived_rooms/` 目录有写入权限
3. 查看服务器日志获取详细错误信息

### 问题5: 会话频繁过期

**症状**：需要频繁重新登录

**解决方案**：
1. 这是正常的安全机制（24小时自动过期）
2. 可以通过修改 `server.js` 中的会话过期时间来调整
3. 确保浏览器没有禁用 localStorage

## 最佳实践

### 1. 定期清理旧归档

归档文件会占用磁盘空间，建议定期清理：

```bash
# 删除30天前的归档
find archived_rooms/ -name "*.json" -mtime +30 -delete
```

或设置 cron 定时任务：

```bash
# 每天凌晨2点清理30天前的归档
0 2 * * * find /path/to/archived_rooms/ -name "*.json" -mtime +30 -delete
```

### 2. 备份重要数据

定期备份归档目录：

```bash
# 创建备份
tar -czf archive_backup_$(date +%Y%m%d).tar.gz archived_rooms/

# 恢复备份
tar -xzf archive_backup_20260403.tar.gz
```

### 3. 监控磁盘使用

```bash
# 查看归档目录大小
du -sh archived_rooms/

# 设置磁盘使用警报（示例脚本）
if [ $(du -s archived_rooms/ | cut -f1) -gt 1048576 ]; then
    echo "归档目录超过1GB，请清理"
fi
```

### 4. 访问日志

归档管理操作会记录在服务器日志中：

```
[2026-04-03T16:30:00.000Z] 文件下载: 2026-04-03T16-30-00_ABC123_测试房主.json
[2026-04-03T16:31:00.000Z] 归档文件已删除: 2026-04-03T16-30-00_ABC123_测试房主.json
```

## 相关文档

- [房间归档功能说明](ROOM_ARCHIVE_FEATURE.md) - 归档功能的详细说明
- [RESTful API 文档](/developer) - 完整的 API 文档
- [.env.example](.env.example) - 环境变量配置示例

## 版本历史

- **v2.0** (2026-04-03) - 初始版本
  - 实现管理员登录功能
  - 实现归档文件列表、下载、删除功能
  - 添加 Web 管理界面
  - 添加会话管理