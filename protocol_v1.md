# 卫戍协议多人联机插件

# 网络同步协议 v2 (REST API)

## 1. 设计目标

v2 协议设计目标：

* 支撑基础多人房间同步
* 区分 **房间状态** 与 **玩家状态**
* 区分 **静态信息** 与 **动态信息**
* 支持低频与高频同步
* 保持协议简单可扩展
* 基于标准HTTP协议，易于集成

协议主要用于同步 **游戏局势信息**，而不是完整战场镜像。

---

## 2. 传输约定

### 2.1 传输层

* 通信方式：HTTP/HTTPS (RESTful API)
* 数据格式：JSON
* 编码：UTF-8
* 压缩：Gzip

### 2.2 HTTP方法

| 方法 | 用途 |
|------|------|
| GET | 获取数据 |
| POST | 创建或更新数据 |
| DELETE | 删除数据 |

### 2.3 响应格式

成功响应（200）：
```json
{
  "success": true,
  "data": {
    // 响应数据
  }
}
```

错误响应（4xx/5xx）：
```json
{
  "success": false,
  "message": "错误描述"
}
```

未修改（304）：
- 当使用 `since` 参数且数据未更新时返回

---

## 3. 状态模型

同步信息分为四类：

| 类型     | 描述        |
| ------ | --------- |
| 房间静态状态 | 整局基本不变化   |
| 房间动态状态 | 全房间共享但会变化 |
| 玩家静态状态 | 玩家信息，低频变化 |
| 玩家动态状态 | 玩家信息，高频变化 |

---

## 4. 字段总览

| 字段             | 类型            | 级别 | 分类 | 说明      |
| -------------- | ------------- | -- | -- | ------- |
| boss           | string        | 房间 | 静态 | 当前 Boss |
| ban_list       | string[]      | 房间 | 静态 | ban 位列表 |
| enemy_type     | string[]      | 房间 | 静态 | 敌方特化类型  |
| phase          | string        | 房间 | 动态 | 当前阶段    |
| round          | string        | 房间 | 动态 | 当前回合    |
| strategy       | string        | 玩家 | 静态 | 玩家策略    |
| money          | int           | 玩家 | 动态 | 剩余资金    |
| operators      | array         | 玩家 | 动态 | 场上干员    |
| alliance_stack | dict[str,int] | 玩家 | 动态 | 盟约层数    |
| leak_count     | int           | 玩家 | 动态 | 漏怪数     |
| cc_level       | int           | 玩家 | 动态 | 调度中心等级  |

---

## 5. 房间状态

### 5.1 boss

```json
"boss": "昆图斯"
```

说明：

* 当前关卡 Boss
* 开局识别一次即可

类型：

```
string
```

---

### 5.2 ban_list

```json
"ban_list": ["拉特兰", "卡西米尔"]
```

说明：

* ban 位列表
* 开局确定

类型：

```
string[]
```

---

### 5.3 enemy_type

```json
"enemy_type": ["隐匿", "折射"]
```

说明：

* 敌方特化类型
* 可以有多个

类型：

```
string[]
```

---

### 5.4 phase

```json
"phase": "battle"
```

说明：

当前游戏阶段。

推荐枚举：

```
lobby
room
enemy_info
strategy
prepare
battle
extra
result
unknown
```

---

### 5.5 round

```json
"round": "11"
```

说明：

当前回合。

采用字符串类型是为了支持：

```
??
```

类型：

```
string
```

---

## 6. 玩家状态

### 6.1 strategy

```json
"strategy": "文火慢炖"
```

说明：

玩家策略。

通常在开局或策略阶段确定。

类型：

```
string
```

---

### 6.2 money

```json
"money": 27
```

说明：

当前资金。

类型：

```
int
```

---

### 6.3 operators

表示当前场上干员。

推荐结构：

```json
"operators": [
  {
    "name": "山"
  },
  {
    "name": "能天使"
  }
]
```

扩展结构：

```json
"operators": [
  {
    "name": "山",
    "elite": 2
  }
]
```

字段：

| 字段    | 类型     | 必填 |
| ----- | ------ | -- |
| name  | string | 是  |
| elite | int    | 否  |

---

### 6.4 alliance_stack

```json
"alliance_stack": {
  "卡西米尔": 2,
  "坚守": 1
}
```

说明：

各盟约层数。

类型：

```
dict[str,int]
```

示例：

```
盟约名 -> 层数
```

---

### 6.5 leak_count

```json
"leak_count": 1
```

说明：

漏怪数量。

类型：

```
int
```

---

### 6.6 cc_level

```json
"cc_level": 5
```

说明：

玩家调度中心等级。

属于动态信息，因为游戏过程中可能变化。

类型：

```
int
```

---

## 7. API 接口

### 7.1 更新房间/玩家状态（主接口）

**请求**：
```
POST /api/rooms/:roomId/update
Content-Type: application/json

{
  "player_id": "p1",
  "room_static": {
    "boss": "昆图斯",
    "ban_list": ["谢拉格", "萨尔贡"],
    "enemy_type": ["折射"]
  },
  "room_dynamic": {
    "phase": "battle",
    "round": "11"
  },
  "player_static": {
    "strategy": "文火慢炖"
  },
  "player_dynamic": {
    "money": 27,
    "operators": [
      {"name": "山"}
    ],
    "alliance_stack": {
      "投资人": 2
    },
    "leak_count": 0,
    "cc_level": 5
  }
}
```

**响应**（200 OK）：
```json
{
  "success": true,
  "message": "更新成功",
  "data": {
    "roomId": "ROOM01",
    "player_id": "p1",
    "updated_at": 1710280305000
  }
}
```

**说明**：
- 如果房间不存在，会自动创建
- 支持部分字段更新
- `room_static` 和 `room_dynamic` 只有房主可以更新
- `player_static` 和 `player_dynamic` 玩家只能更新自己的

---

### 7.2 获取房间信息

**请求**：
```
GET /api/rooms/:roomId?since=1710280305000
```

**参数**：
- `since`（可选）：时间戳，只返回该时间之后更新的数据

**响应**（200 OK）：
```json
{
  "success": true,
  "data": {
    "room_id": "ROOM01",
    "host_player_id": "p1",
    "updated_at": 1710280306000,
    "room_static": {
      "boss": "昆图斯",
      "ban_list": ["谢拉格", "萨尔贡"],
      "enemy_type": ["折射"]
    },
    "room_dynamic": {
      "phase": "battle",
      "round": "11"
    },
    "players": [
      {
        "player_id": "p1",
        "static": {
          "strategy": "文火慢炖"
        },
        "dynamic": {
          "money": 27,
          "operators": [{"name": "山"}],
          "alliance_stack": {"投资人": 2},
          "leak_count": 0,
          "cc_level": 5
        },
        "is_host": true
      }
    ]
  }
}
```

**响应**（304 Not Modified）：
- 如果有 `since` 参数且数据未更新，返回 304

---

### 7.3 创建房间

**请求**：
```
POST /api/rooms
Content-Type: application/json

{
  "player_id": "p1",
  "player_name": "玩家名称"
}
```

**响应**（200 OK）：
```json
{
  "success": true,
  "data": {
    "room_id": "ABC123",
    "host_player_id": "p1",
    "players": [
      {
        "player_id": "p1",
        "player_name": "玩家名称",
        "is_host": true
      }
    ]
  }
}
```

**说明**：
- 房间号自动生成（6位字母数字组合）
- 创建者自动成为房主

---

### 7.4 删除房间

**请求**：
```
DELETE /api/rooms/:roomId
```

**响应**（200 OK）：
```json
{
  "success": true,
  "message": "房间已删除"
}
```

---

### 7.5 获取所有房间（调试）

**请求**：
```
GET /api/rooms
```

**响应**（200 OK）：
```json
{
  "success": true,
  "data": [
    {
      "room_id": "ROOM01",
      "host_player_id": "p1",
      "player_count": 4,
      "created_at": 1710280300000,
      "expires_at": 1710287500000,
      "remaining_time": 7200000
    }
  ]
}
```

---

## 8. 更新规则

### 覆盖更新

如果消息包含字段：

```
money
```

则服务器直接覆盖该字段的值。

---

### 缺失字段不修改

例如：

服务器当前状态：

```json
{
  "money": 20,
  "leak_count": 1
}
```

收到更新：

```json
{
  "money": 25
}
```

结果：

```json
{
  "money": 25,
  "leak_count": 1
}
```

---

## 9. 权威来源

### 房间状态

由 **房主** 发送：

* room_static
* room_dynamic

---

### 玩家状态

由 **玩家本人** 发送：

* player_static
* player_dynamic

---

## 10. 同步策略

推荐策略：

### 房间静态

开局同步一次。

---

### 房间动态

仅在变化时同步：

* phase
* round

---

### 玩家静态

开局或变化时同步。

---

### 玩家动态

客户端每 **2s 轮询一次**

仅在字段变化时发送：

* money
* operators
* alliance_stack
* leak_count
* cc_level

---

## 11. 客户端实现示例

### 11.1 JavaScript/TypeScript

```javascript
class SyncClient {
  constructor(roomId, playerId) {
    this.roomId = roomId;
    this.playerId = playerId;
    this.lastUpdated = 0;
    this.pollInterval = 2000; // 2秒轮询一次
    this.pollTimer = null;
  }
  
  start() {
    this.poll();
    this.pollTimer = setInterval(() => this.poll(), this.pollInterval);
  }
  
  stop() {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
  }
  
  async poll() {
    try {
      const url = `/api/rooms/${this.roomId}?since=${this.lastUpdated}`;
      const response = await fetch(url);
      
      if (response.status === 304) {
        // 数据未更新，无需处理
        return;
      }
      
      const data = await response.json();
      if (data.success) {
        this.lastUpdated = data.data.updated_at;
        this.onUpdate(data.data);
      }
    } catch (error) {
      console.error('轮询失败:', error);
    }
  }
  
  async update(updates) {
    try {
      const response = await fetch(`/api/rooms/${this.roomId}/update`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          player_id: this.playerId,
          ...updates
        })
      });
      
      const data = await response.json();
      return data.success;
    } catch (error) {
      console.error('更新失败:', error);
      return false;
    }
  }
  
  onUpdate(roomData) {
    // 处理更新
    console.log('收到更新:', roomData);
    // 更新UI...
  }
}

// 使用示例
const client = new SyncClient('ROOM01', 'player_123');
client.start();

// 更新状态
client.update({
  player_dynamic: {
    money: 30,
    leak_count: 1
  }
});
```

---

## 12. v2 最终字段列表

### 房间静态

```
boss
ban_list
enemy_type
```

---

### 房间动态

```
phase
round
```

---

### 玩家静态

```
strategy
```

---

### 玩家动态

```
money
operators
alliance_stack
leak_count
cc_level
```

---

## 13. 性能建议

### 13.1 轮询频率

推荐：每2秒轮询一次

可根据实际需求调整：
- 实时性要求高：1秒
- 节省流量：3-5秒

### 13.2 增量更新

始终使用 `since` 参数，减少不必要的网络传输。

### 13.3 批量更新

一次请求中可以同时更新多个字段，减少请求次数。

---

## 14. 错误处理

### 14.1 常见错误码

| 状态码 | 说明 |
|--------|------|
| 400 | 请求参数错误 |
| 404 | 房间不存在 |
| 304 | 数据未修改 |
| 500 | 服务器内部错误 |

### 14.2 重试策略

- 网络错误：指数退避重试
- 500错误：最多重试3次
- 4xx错误：不重试，检查请求参数

---

## 15. 版本历史

### v2.0 (当前版本)
- 改为RESTful API协议
- 移除WebSocket
- 添加增量更新支持
- 优化轮询机制

### v1.0 (已废弃)
- WebSocket协议
- 实时双向通信