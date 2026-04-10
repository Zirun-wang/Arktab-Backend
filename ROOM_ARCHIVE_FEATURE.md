# 房间归档功能说明

## 概述

当房间过期时，服务器会自动将房间的完整数据保存到 `./archived_rooms/` 目录中，以便后续分析和查看。

## 功能特性

### ✅ 自动归档
- 房间过期前自动保存数据
- 每5分钟检查一次过期房间
- 归档成功后才会删除房间

### ✅ 完整快照
- 保存所有房间设置
- 保存所有玩家数据（静态和动态状态）
- 保存时间戳信息

### ✅ 清晰命名
文件名格式：`{时间戳}_{序号}_{房间ID}.json`

示例：`2026-04-03T16-30-00_001_ABC123.json`

## 归档数据结构

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
    "enable_leak_count_detection": false
  },
  "player_count": 3,
  "players": [
    {
      "player_id": "p1",
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

## 字段说明

### 归档信息
- `archived_at`: 归档时间（ISO 8601格式）
- `room_id`: 房间ID
- `host_player_id`: 房主ID
- `created_at`: 房间创建时间
- `expires_at`: 房间过期时间
- `duration_ms`: 房间持续时间（毫秒）
- `duration_hours`: 房间持续时间（小时，保留2位小数）

### 房间设置
- `room_settings`: 房间设置对象
  - `max_players`: 房间人数上限
  - `enable_battle_progress_detection`: 是否启用作战进度检测
  - `enable_leak_count_detection`: 是否启用漏怪数检测

### 玩家数据
- `player_count`: 玩家总数
- `players`: 玩家数组
  - `player_id`: 玩家ID（p1-p4）
  - `static`: 静态状态
  - `dynamic`: 动态状态
  - `is_host`: 是否为房主
  - `last_updated`: 最后更新时间

## 使用场景

### 1. 游戏数据分析
```bash
# 查看所有归档房间
ls -la archived_rooms/

# 统计房间数量
find archived_rooms/ -name "*.json" | wc -l

# 查找特定房主的房间
grep -l "房主昵称" archived_rooms/*.json
```

### 2. 查看历史记录
```bash
# 按时间排序查看
ls -lt archived_rooms/

# 查看特定房间的数据
cat archived_rooms/{时间戳}_{房间ID}_*.json
```

### 3. 数据分析脚本
```javascript
// 示例：统计平均游戏时长
const fs = require('fs');
const path = require('path');

const archiveDir = './archived_rooms';
const files = fs.readdirSync(archiveDir);

let totalDuration = 0;
files.forEach(file => {
  const data = JSON.parse(fs.readFileSync(path.join(archiveDir, file), 'utf8'));
  totalDuration += parseFloat(data.duration_hours);
});

console.log(`平均游戏时长: ${(totalDuration / files.length).toFixed(2)} 小时`);
```

## 测试归档功能

### 方法1: 使用测试脚本
```bash
# 启动服务器
node server.js

# 在另一个终端运行测试
node test-archive.js
```

### 方法2: 手动测试（快速）
1. 修改 `server.js` 中的 `ROOM_EXPIRY_TIME`:
   ```javascript
   const ROOM_EXPIRY_TIME = 10 * 1000; // 10秒
   ```

2. 重启服务器：
   ```bash
   node server.js
   ```

3. 创建测试房间：
   ```bash
   curl -X POST http://localhost:3000/api/rooms \
     -H "Content-Type: application/json" \
     -d '{"player_name":"测试房主"}'
   ```

4. 等待10秒后检查：
   ```bash
   ls -la archived_rooms/
   cat archived_rooms/*.json | jq
   ```

5. 记得改回：
   ```javascript
   const ROOM_EXPIRY_TIME = 30 * 60 * 1000; // 30分钟
   ```

## 注意事项

### ⚠️ 存储空间
- 归档文件会占用磁盘空间
- 建议定期清理旧的归档文件
- 可以设置定时任务清理30天前的归档

### ⚠️ 隐私保护
- 归档文件不包含玩家昵称等个人信息
- 如果涉及敏感数据，建议加密存储
- `.gitignore` 已配置，归档文件不会被提交到Git

### ⚠️ 手动删除房间
- 通过 API 手动删除的房间**不会**被归档
- 只有因过期自动删除的房间才会归档
- 房主退出导致房间解散也不会归档

## 配置选项

### 修改归档目录
在 `server.js` 中修改：
```javascript
const ARCHIVED_ROOMS_DIR = path.join(__dirname, 'custom_archive_dir');
```

### 修改清理间隔
在 `server.js` 中修改：
```javascript
setInterval(() => {
  // ...
}, 5 * 60 * 1000); // 每5分钟清理一次
```

### 禁用归档功能
如果不需要归档功能，可以注释掉 `archiveRoom()` 调用：
```javascript
// 归档房间数据
// const archived = archiveRoom(roomData);
// if (archived) {
//   archivedCount++;
// }
```

## 故障排除

### 归档失败
如果归档失败，会记录错误日志：
```
[2026-04-03T16:30:00.000Z] 归档房间失败: ABC123 Error: ...
```

检查项：
1. 目录权限是否正确
2. 磁盘空间是否充足
3. 文件名是否包含非法字符

### 归档目录不存在
服务器启动时会自动创建归档目录，无需手动创建。

### 房间未归档
检查是否为手动删除的房间（手动删除不归档）。

## 最佳实践

### 1. 定期清理旧归档
```bash
# 删除30天前的归档
find archived_rooms/ -name "*.json" -mtime +30 -delete
```

### 2. 备份重要数据
```bash
# 定期备份归档目录
tar -czf room_archive_backup_$(date +%Y%m%d).tar.gz archived_rooms/
```

### 3. 监控磁盘使用
```bash
# 查看归档目录大小
du -sh archived_rooms/

# 设置磁盘使用警报
df -h | grep /dev/sda1
```

## 版本历史

- **v2.0** (2026-04-03) - 初始版本
  - 实现房间过期自动归档
  - 完整快照保存
  - 清晰的文件命名规则

## 相关文件

- `server.js` - 服务器主文件（包含归档逻辑）
- `test-archive.js` - 归档功能测试脚本
- `.gitignore` - Git忽略配置（已包含归档目录）
- `ARCHIVE_ROOM_FEATURE.md` - 本文档