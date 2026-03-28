# 数据结构 v2.1 变更说明

## 概述

v2.1 版本对数据结构进行了重大重构，采用**玩家自维护**的数据模型，简化了服务器逻辑。

## 主要变更

### 移除的字段
- ❌ `room_static` - 房间静态状态
- ❌ `room_dynamic` - 房间动态状态

### 新的数据结构
所有字段现在都在每个玩家的以下对象中维护：
- ✅ `static` - 静态信息（整局基本不变化）
- ✅ `dynamic` - 动态信息（会频繁变化）
- ✅ `room_settings` - 房间设置（仅房主可更新）

## 字段分布

### static 对象（房主维护）
```json
{
  "boss": "卢西恩",
  "ban_list": ["萨尔贡", "奥术", "突袭"],
  "enemy_type": ["飞行", "隐匿", "元素"]
}
```

### static 对象（玩家本人维护）
```json
{
  "strategy": "eco"
}
```

### dynamic 对象（房主维护）
```json
{
  "phase": "battle",
  "round": "7"
}
```

### dynamic 对象（玩家本人维护）
```json
{
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
}
```

## 完整响应示例

```json
{
  "room_id": "ROOM01",
  "host_player_id": "p1",
  "updated_at": 1710280305000,
  "room_settings": {
    "max_players": 4,
    "enable_battle_progress_detection": true,
    "enable_leak_count_detection": true,
    "host_display_text": "ARK-12345"
  },
  "players": [
    {
      "player_id": "p1",
      "player_name": "房主昵称",
      "static": {
        "boss": "卢西恩",
        "ban_list": ["萨尔贡", "奥术", "突袭"],
        "enemy_type": ["飞行", "隐匿", "元素"],
        "strategy": "eco"
      },
      "dynamic": {
        "phase": "battle",
        "round": "7",
        "battle_enemy_type": "飞行",
        "encountered_enemy_types": ["飞行", "隐匿"],
        "active_global_buffs": ["进攻强化", "部署回费"],
        "bonus_type": "shop",
        "bonus_options": ["紧急调度券", "精准狙击镜", "防暴盾"],
        "money": 38,
        "operators": [...],
        "alliance_stack": {...},
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
```

## 更新请求示例

### 房主更新房间状态
```json
{
  "player_id": "p1",
  "static": {
    "boss": "昆图斯",
    "ban_list": ["拉特兰", "卡西米尔"],
    "enemy_type": ["隐匿", "折射"]
  },
  "dynamic": {
    "phase": "battle",
    "round": "11"
  }
}
```

### 玩家更新个人状态
```json
{
  "player_id": "p2",
  "static": {
    "strategy": "文火慢炖"
  },
  "dynamic": {
    "money": 30,
    "leak_count": 1
  }
}
```

## 优势

1. **简化服务器逻辑** - 不需要聚合房间状态
2. **提高可维护性** - 统一的数据结构
3. **降低复杂度** - 每个玩家独立维护自己的数据
4. **更好的扩展性** - 更容易添加新字段
5. **减少错误** - 避免了房间和玩家状态的混淆

## 权限控制

- ✅ 房主可以更新：房间级别的字段（boss, ban_list, enemy_type, phase, round）+ 自己的所有字段
- ✅ 普通玩家可以更新：自己的字段（strategy, money, operators, alliance_stack, leak_count, cc_level 等）
- ❌ 普通玩家不能更新：房间级别的字段

## 迁移指南

### 客户端需要修改的地方

1. **更新请求格式**
   - 从：`{ "room_static": {...}, "room_dynamic": {...}, "player_static": {...}, "player_dynamic": {...} }`
   - 到：`{ "static": {...}, "dynamic": {...} }`

2. **解析响应格式**
   - 房间级别的字段现在在 `players[].static` 和 `players[].dynamic` 中
   - 不再有顶层的 `room_static` 和 `room_dynamic`

3. **字段映射**
   - `room_static.boss` → `players[].static.boss`（房主的数据）
   - `room_dynamic.phase` → `players[].dynamic.phase`（房主的数据）
   - `player_static.strategy` → `players[].static.strategy`
   - `player_dynamic.money` → `players[].dynamic.money`

## 版本历史

- **v2.1** (2026-03-28) - 采用玩家自维护的数据结构
- **v2.0** (2026-03-15) - RESTful API 协议
- **v1.0** - WebSocket 协议（已废弃）

## 测试验证

所有测试用例均已通过：
- ✅ 创建房间（服务器分配 player_id）
- ✅ 加入房间（按顺序分配 p1-p4）
- ✅ 更新状态（新的 static/dynamic 结构）
- ✅ 房间设置（仅房主可更新）
- ✅ 错误处理（404, 400, 403）
- ✅ 房间满员检测
- ✅ 玩家退出房间（普通玩家和房主）
- ✅ 房主退出后房间删除
- ✅ 退出后状态验证

## 新增功能：退出房间

### API 接口

**接口**: `POST /api/rooms/:roomId/leave`

**请求**:
```json
{
  "player_id": "p2"
}
```

### 功能说明

**普通玩家退出**:
- 从房间中移除该玩家
- 返回剩余玩家数量
- 房间继续存在
- 房间的过期时间会更新

**房主退出**:
- **如果有其他玩家**：房主转移到剩余玩家中 player_id 最小的一个
  - 返回 `host_transferred: true` 标识
  - 包含新房主的 `new_host_id` 和 `new_host_name`
  - 房间继续存在，新房主拥有房主权限
- **如果没有其他玩家**：删除整个房间
  - 返回 `room_deleted: true` 标识
  - 返回 `host_transferred: false` 标识
  - 房间内的所有玩家被移除
  - 其他玩家无法再访问该房间

### 房主转移规则
- 房主退出时，房主会自动转移给剩余玩家中 player_id 最小的一个
- 例如：p1、p2、p3、p4在房间，p2和p3退出后，p1退出 → 房主转移到p4
- 新房主立即获得房主权限，可以更新房间设置

### 使用示例

```bash
# 普通玩家退出
curl -X POST http://localhost:3000/api/rooms/ABC123/leave \
  -H "Content-Type: application/json" \
  -d '{"player_id":"p2"}'

# 房主退出（解散房间）
curl -X POST http://localhost:3000/api/rooms/ABC123/leave \
  -H "Content-Type: application/json" \
  -d '{"player_id":"p1"}'
```

### 客户端实现

```javascript
async function leaveRoom(roomId, playerId) {
  const response = await fetch(`/api/rooms/${roomId}/leave`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ player_id: playerId })
  });
  
  const data = await response.json();
  
  if (data.success) {
    if (data.data.room_deleted) {
      // 房间已被删除，返回主菜单
      console.log('房间已解散');
      returnToMainMenu();
    } else {
      // 玩家已退出，但房间还存在
      console.log(`已退出房间，剩余玩家: ${data.data.player_count}`);
      returnToMainMenu();
    }
  } else {
    console.error('退出失败:', data.message);
  }
}
```

### 注意事项

1. **房主权限**：房主退出会删除整个房间，请谨慎操作
2. **player_id 验证**：必须使用服务器分配的 player_id
3. **状态同步**：其他玩家会在下次轮询时发现玩家已退出
4. **错误处理**：客户端应处理 404 和 400 错误
5. **UI 更新**：退出后应更新UI显示剩余玩家数量

### 详细的退出房间功能说明

请参考 `LEAVE_ROOM_FEATURE.md` 获取完整的功能文档和测试用例。
