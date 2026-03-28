# 服务器后端更新总结

## 实施的更改

### 1. POST /api/rooms/:roomId/update 只负责更新已经在房间内的玩家状态
**变更内容：**
- 移除了自动创建房间的逻辑
- 如果房间不存在，返回 404 错误
- 如果玩家不在房间内，返回 400 错误
- 添加了权限检查：只有房主可以更新 `room_static`、`room_dynamic` 和 `room_settings`
- 添加了 `room_settings` 字段的支持
- 更新房间状态时会重置过期时间（从最后一次更新开始计算）

**影响：**
- 用户输入错误的邀请码时不会自动创建房间
- 防止未加入房间的玩家发送更新请求

---

### 2. POST /api/rooms 创建房间时服务器分配 player_id
**变更内容：**
- 移除了请求体中的 `player_id` 参数
- 只需要传入 `player_name`
- 服务器自动分配 `p1` 作为房主的 player_id
- 返回的响应中包含分配的 `player_id`

**影响：**
- 玩家只需填写昵称，不需要担心 ID 冲突
- 后续所有 POST 请求都需要使用服务器分配的 `player_id`

---

### 3. 房间有效期改为从最后一次更新开始计算
**变更内容：**
- 将房间有效期从 2 小时缩短为 30 分钟
- 每次更新房间状态时重置 `expiresAt`
- 更新过期时间：`room.expiresAt = Date.now() + ROOM_EXPIRY_TIME`

**影响：**
- 活跃的房间不会因超时被清理
- 闲置房间会在 30 分钟后自动清理

---

### 4. 添加 room_settings 字段
**变更内容：**
- 在房间数据结构中添加 `room_settings` 对象
- 包含以下字段：
  - `max_players`: 房间人数上限（默认 4）
  - `enable_battle_progress_detection`: 是否启用作战进度检测（默认 false）
  - `enable_leak_count_detection`: 是否启用漏怪数检测（默认 false）
  - `host_display_text`: 房主展示文本（用于明日方舟邀请码）

**影响：**
- 房间可以自定义设置
- 支持显示邀请码等功能

---

### 5. 添加 POST /api/rooms/:roomId/join 端点
**变更内容：**
- 新增加入房间的 API 端点
- 请求体只需要 `player_name`
- 服务器按顺序分配 `player_id`（p1, p2, p3, p4）
- 检查房间是否存在
- 检查房间是否已满
- 返回分配的 `player_id` 和房间信息

**影响：**
- 玩家可以通过邀请码加入房间
- 服务器统一管理玩家 ID，避免冲突

---

### 6. 更新同步状态包含 room_settings
**变更内容：**
- GET /api/rooms/:roomId 响应中包含 `room_settings`
- 玩家列表中包含 `player_name`

**影响：**
- 客户端可以获取房间设置
- 客户端可以显示玩家昵称

---

## API 变更对比

### 创建房间
**旧版：**
```json
POST /api/rooms
{
  "player_id": "p1",
  "player_name": "玩家名称"
}
```

**新版：**
```json
POST /api/rooms
{
  "player_name": "玩家名称"
}
```

### 更新房间状态
**旧版：**
- 如果房间不存在，自动创建房间
- 如果玩家不在房间内，自动添加玩家

**新版：**
- 如果房间不存在，返回 404
- 如果玩家不在房间内，返回 400
- 添加权限检查（只有房主可以更新房间设置）

### 新增：加入房间
```json
POST /api/rooms/:roomId/join
{
  "player_name": "玩家名称"
}
```

**响应：**
```json
{
  "success": true,
  "message": "加入房间成功",
  "data": {
    "room_id": "ABC123",
    "host_player_id": "p1",
    "player_id": "p2",
    "player_name": "玩家名称",
    "room_settings": {
      "max_players": 4,
      "enable_battle_progress_detection": false,
      "enable_leak_count_detection": false,
      "host_display_text": ""
    },
    "players": [...]
  }
}
```

---

## 测试结果

所有测试用例均通过 ✓

1. ✓ 创建房间时服务器分配 player_id (p1)
2. ✓ 获取房间信息包含 room_settings
3. ✓ 加入房间时服务器分配 player_id (p2, p3, p4)
4. ✓ 使用不存在的 player_id 更新失败 (400)
5. ✓ 使用正确的 player_id 更新成功
6. ✓ 房主可以更新房间设置
7. ✓ 非房主不能更新房间设置 (403)
8. ✓ 更新不存在的房间失败 (404)
9. ✓ 获取更新的房间信息
10. ✓ 支持最多 4 个玩家
11. ✓ 房间满员后拒绝加入 (400)
12. ✓ 获取所有房间列表
13. ✓ 删除房间

---

## 数据结构示例

### 完整的房间状态响应
```json
{
  "success": true,
  "data": {
    "room_id": "ABC123",
    "host_player_id": "p1",
    "updated_at": 1710280306000,
    "room_static": {
      "boss": "卢西恩",
      "ban_list": ["萨尔贡", "奥术", "突袭"],
      "enemy_type": ["飞行", "隐匿", "元素"]
    },
    "room_dynamic": {
      "phase": "battle",
      "round": "7",
      "battle_enemy_type": "飞行",
      "encountered_enemy_types": ["飞行", "隐匿"],
      "active_global_buffs": ["进攻强化", "部署回费"],
      "bonus_type": "shop",
      "bonus_options": ["紧急调度券", "精准狙击镜", "防暴盾"]
    },
    "room_settings": {
      "max_players": 4,
      "enable_battle_progress_detection": true,
      "enable_leak_count_detection": true,
      "host_display_text": "ARK-12345"
    },
    "players": [
      {
        "player_id": "p1",
        "player_name": "玩家1",
        "static": {
          "strategy": "eco"
        },
        "dynamic": {
          "money": 38,
          "operators": [
            { "name": "能天使", "elite": true, "pos": "field" },
            { "name": "风笛", "elite": true, "pos": "field" },
            { "name": "白面鸮", "elite": false, "pos": "prepare" }
          ],
          "alliance_stack": {
            "奥术": { "level": 2, "status": "active" },
            "突袭": { "level": 1, "status": "inactive" }
          },
          "hp": 28,
          "leak_count": 1,
          "cc_level": 5,
          "battle_ratio": "67%",
          "bonus_choice_value": "精准狙击镜"
        },
        "is_host": true
      }
    ]
  }
}
```

---

## 注意事项

1. **player_id 管理**：所有 player_id 由服务器分配（p1, p2, p3, p4），客户端不能自定义
2. **权限控制**：只有房主可以更新 `room_static`、`room_dynamic` 和 `room_settings`
3. **房间有效期**：30 分钟无活动后自动清理，每次更新重置计时器
4. **人数限制**：默认最多 4 人，可通过 `room_settings.max_players` 调整
5. **错误处理**：所有错误返回标准的 HTTP 状态码和 JSON 响应

---

## 运行测试

```bash
# 启动服务器
node server.js

# 运行测试
node test-updates.js
```

---

## 文件清单

- `server.js` - 服务器主文件（已更新）
- `test-updates.js` - 新的测试脚本
- `IMPLEMENTATION_SUMMARY.md` - 本文档