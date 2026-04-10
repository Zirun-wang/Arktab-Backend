# 存档系统重构说明

## 修改日期
2026-04-11

## 修改目的
从存档系统中移除个人信息字段（player_name和host_display_text），保护用户隐私。

## 修改内容

### 1. 核心修改

#### server.js
- **createRoom()函数**：移除`room_settings.host_display_text`的默认值
- **archiveRoom()函数**：
  - 移除从房主获取player_name的逻辑
  - 移除存档文件名中的房主名
  - 移除存档数据结构中的player_name字段
  - 移除存档数据结构中的host_display_text字段
- **获取归档列表API**：返回host_player_id而不是host_name
- **启动日志**：更新快照命名规则说明

#### 文档更新
- **ROOM_ARCHIVE_FEATURE.md**：
  - 更新文件命名格式：`{时间戳}_{序号}_{房间ID}.json`
  - 移除player_name和host_display_text字段说明
  - 更新隐私保护说明

- **ARCHIVE_MANAGEMENT_GUIDE.md**：
  - 更新归档列表字段说明（房主名→房主ID）
  - 更新文件命名格式
  - 更新API示例中的文件名

- **test-snapshot.js**：
  - 更新快照命名说明

### 2. 运行时 vs 存档的区别

**重要说明**：这次修改只影响存档系统，不影响运行时API。

#### 运行时（内存中）
- 仍然保存`player_name`字段
- 仍然支持`host_display_text`字段
- 客户端API响应中包含这些字段
- 创建/加入房间时仍然需要player_name参数

#### 存档（磁盘文件）
- **不保存**`player_name`字段
- **不保存**`host_display_text`字段
- 文件名不包含房主名
- 只保存player_id和游戏数据

## 存档数据结构对比

### 修改前
```json
{
  "room_id": "ABC123",
  "host_player_id": "p1",
  "room_settings": {
    "enable_battle_progress_detection": false,
    "enable_leak_count_detection": false,
    "host_display_text": "ARK-12345"
  },
  "players": [
    {
      "player_id": "p1",
      "player_name": "测试房主",
      "static": {...},
      "dynamic": {...},
      "is_host": true
    }
  ]
}
```

### 修改后
```json
{
  "room_id": "ABC123",
  "host_player_id": "p1",
  "room_settings": {
    "enable_battle_progress_detection": false,
    "enable_leak_count_detection": false
  },
  "players": [
    {
      "player_id": "p1",
      "static": {...},
      "dynamic": {...},
      "is_host": true
    }
  ]
}
```

## 文件命名变化

### 修改前
```
2026-04-03T16-30-00_ABC123_测试房主.json
```

### 修改后
```
2026-04-03T16-30-00_001_ABC123.json
```
（添加了序号，移除了房主名）

## 兼容性说明

### 向后兼容性
- **不兼容**：旧版本的存档文件可能包含player_name和host_display_text字段
- **建议**：删除旧存档文件或编写迁移脚本处理旧格式

### API兼容性
- **完全兼容**：运行时API没有任何变化
- 客户端无需修改

## 测试验证

### 功能测试
✅ 创建房间 - 正常
✅ 加入房间 - 正常
✅ 获取房间信息 - 正常（包含player_name）
✅ 快照定时器 - 正常启动

### 存档测试
✅ 存档文件不包含player_name - 已验证
✅ 存档文件不包含host_display_text - 已验证
✅ 文件命名符合新规范 - 已验证

## 安全改进

1. **隐私保护**：存档文件不再包含玩家昵称等个人信息
2. **数据最小化**：只保存必要的游戏数据
3. **合规性**：符合数据保护最佳实践

## 注意事项

1. **旧存档处理**：建议清理旧存档文件
2. **文档同步**：所有相关文档已更新
3. **测试覆盖**：功能测试已通过

## 相关文件

- `server.js` - 主要代码修改
- `ROOM_ARCHIVE_FEATURE.md` - 归档功能文档
- `ARCHIVE_MANAGEMENT_GUIDE.md` - 管理指南
- `test-snapshot.js` - 测试脚本
- `ARCHIVE_REFACTORING_NOTES.md` - 本文档

## 后续建议

1. 考虑添加数据迁移功能，自动清理旧存档文件
2. 考虑添加存档数据验证，确保格式正确
3. 考虑添加存档文件压缩，减少存储空间占用

---

## 性能优化（2026-04-11）

### 问题
当存档数量达到10万个时，归档管理页面会导致服务器卡死。

### 原因
- 同步读取并解析所有JSON文件
- 100,000次IO操作阻塞事件循环
- 无分页机制

### 解决方案
实施方案B：限制显示前100个存档

#### 修改内容
**server.js - `/api/admin/archives`接口**：
- 先获取总存档数（不解析JSON）
- 只处理前100个文件进行解析
- 返回实际总数、显示数量、是否有更多数据

#### API响应格式
```json
{
  "success": true,
  "data": {
    "total": 100000,        // 实际总数
    "displayed": 100,       // 实际显示的数量
    "display_limit": 100,    // 显示限制
    "has_more": true,       // 是否还有更多
    "files": [...]          // 存档文件列表
  }
}
```

#### 性能对比
- **优化前**：100,000个文件 = 100,000次IO + JSON解析 = 卡死
- **优化后**：100个文件 = 100次IO + JSON解析 = 几百毫秒
- **性能提升**：约1000倍 🚀

#### 文档更新
- **ARCHIVE_MANAGEMENT_GUIDE.md**：添加性能优化说明

### 未来优化方向

1. **短期**：添加分页参数支持（`?page=1&pageSize=50`）
2. **中期**：实施增量索引文件（`archived_rooms_index.json`）
3. **长期**：迁移到SQLite数据库，支持复杂查询

### 注意事项
- 显示限制为100个，可配置
- 用户知道实际总数，但无法直接浏览旧存档
- 如需查看特定存档，可通过API直接下载
