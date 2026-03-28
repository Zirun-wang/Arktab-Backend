# 退出房间功能说明

## 概述

新增了玩家主动退出房间的API接口，允许玩家离开当前所在的房间。

## API 接口

### 接口定义

**方法**: `POST`
**路径**: `/api/rooms/:roomId/leave`
**Content-Type**: `application/json`

### 请求参数

```json
{
  "player_id": "p2"
}
```

### 响应

#### 普通玩家退出（200 OK）

```json
{
  "success": true,
  "message": "退出房间成功",
  "data": {
    "room_id": "ABC123",
    "player_id": "p2",
    "player_count": 3
  }
}
```

#### 房主退出 - 有其他玩家（200 OK）

```json
{
  "success": true,
  "message": "房主退出，房主已转移",
  "data": {
    "room_id": "ABC123",
    "player_id": "p1",
    "host_transferred": true,
    "new_host_id": "p2",
    "new_host_name": "玩家2",
    "player_count": 3
  }
}
```

#### 房主退出 - 无其他玩家（200 OK）

```json
{
  "success": true,
  "message": "房主退出，房间已解散",
  "data": {
    "room_deleted": true,
    "room_id": "ABC123",
    "host_transferred": false
  }
}
```

### 错误响应

#### 房间不存在（404）

```json
{
  "success": false,
  "message": "房间不存在"
}
```

#### 玩家不在房间内（400）

```json
{
  "success": false,
  "message": "玩家不在房间内"
}
```

## 功能特性

### 普通玩家退出
- 从房间中移除该玩家
- 返回剩余玩家数量
- 房间继续存在
- 房间的过期时间会更新（30分钟）

### 房主退出
- **如果有其他玩家**：房主转移到剩余玩家中player_id最小的一个
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

### 错误处理
- 房间不存在：返回 404
- player_id 不存在：返回 400
- 缺少 player_id 参数：返回 400

## 使用场景

### 场景1：玩家主动退出游戏

```bash
curl -X POST http://localhost:3000/api/rooms/ABC123/leave \
  -H "Content-Type: application/json" \
  -d '{"player_id":"p2"}'
```

### 场景2：房主退出（房主转移）

```bash
curl -X POST http://localhost:3000/api/rooms/ABC123/leave \
  -H "Content-Type: application/json" \
  -d '{"player_id":"p1"}'
```

如果有其他玩家，房主会转移到player_id最小的玩家。

### 场景3：客户端实现

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
    } else if (data.data.host_transferred) {
      // 房主已转移
      console.log(`房主退出，新房主是: ${data.data.new_host_name}`);
      if (playerId === data.data.new_host_id) {
        // 我成了新房主
        console.log('你现在是房主！');
        enableHostControls();
      }
      returnToMainMenu();
    } else {
      // 普通玩家退出
      console.log(`已退出房间，剩余玩家: ${data.data.player_count}`);
      returnToMainMenu();
    }
  } else {
    console.error('退出失败:', data.message);
  }
}
```

## 注意事项

1. **房主转移**：房主退出时，房主会自动转移给其他玩家，不会直接解散房间
2. **player_id 验证**：必须使用服务器分配的 player_id
3. **状态同步**：其他玩家会在下次轮询时发现玩家已退出或房主已转移
4. **错误处理**：客户端应处理 404 和 400 错误
5. **UI 更新**：退出后应更新UI显示剩余玩家数量和新房主信息
6. **权限更新**：新房主立即获得房主权限，可以更新房间设置

## 测试覆盖

已完成的测试用例：

1. ✅ 普通玩家退出
2. ✅ 验证玩家已退出（房间信息中不再包含）
3. ✅ 多个玩家依次退出
4. ✅ 房主退出 - 房主转移
5. ✅ 验证房主已转移到正确的玩家
6. ✅ 验证新房主可以更新房间设置
7. ✅ 房主退出 - 无其他玩家（房间被删除）
8. ✅ 验证房间已被删除
9. ✅ 退出不存在的房间（404）
10. ✅ 用不存在的 player_id 退出（400）
11. ✅ 剩余玩家数量正确
12. ✅ 房主转移规则正确（player_id最小的玩家成为新房主）

所有测试均已通过 ✓

## 版本历史

- **v2.2** (2026-03-28) - 修改房主退出逻辑，支持房主自动转移
- **v2.1** (2026-03-28) - 新增退出房间功能