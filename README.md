# 卫戍协议多人联机服务

卫戍协议多人联机服务，基于RESTful API实现，用于管理房间和玩家状态的实时同步。

## ✨ 特性

### RESTful API v2
- 🌐 **RESTful接口** - 标准HTTP协议，易于集成
- 👥 **多人联机** - 支持多玩家同时在线
- 🏠 **房间管理** - 创建、加入、更新、删除房间
- 🔄 **状态同步** - 房间状态和玩家状态实时同步
- 👑 **房主权限** - 房主可管理房间状态
- 💾 **内存存储** - 快速响应，无需数据库
- 🌐 **局域网支持** - 支持多设备访问
- ⏰ **2小时有效期** - 自动清理过期房间

## 🚀 快速开始

### 安装依赖

```bash
npm install
```

### 启动服务器

```bash
npm start
```

服务器将在 `http://localhost:3000` 启动。

## 📖 API 接口

### 1. 更新房间/玩家状态（主接口）⭐

**接口**：`POST /api/rooms/:roomId/update`

**请求体**：
```json
{
  "player_id": "player_123",
  "room_static": {
    "boss": "昆图斯",
    "ban_list": ["拉特兰", "卡西米尔"],
    "enemy_type": ["隐匿", "折射"]
  },
  "room_dynamic": {
    "phase": "battle",
    "round": "11"
  },
  "player_static": {
    "strategy": "文火慢炖"
  },
  "player_dynamic": {
    "money": 30,
    "operators": [
      {"name": "山"},
      {"name": "能天使"}
    ],
    "alliance_stack": {
      "卡西米尔": 2,
      "坚守": 1
    },
    "leak_count": 1,
    "cc_level": 5
  }
}
```

**响应**：
```json
{
  "success": true,
  "message": "更新成功",
  "data": {
    "roomId": "ROOM01",
    "player_id": "player_123",
    "updated_at": 1710280305000
  }
}
```

**说明**：
- 如果房间不存在，会自动创建
- 支持部分字段更新，只需发送需要更新的字段
- `room_static` 和 `room_dynamic` 只有房主可以更新

### 2. 获取房间信息

**接口**：`GET /api/rooms/:roomId?since=1710280305000`

**参数**：
- `since`（可选）：时间戳，只返回该时间之后更新的数据，未更新则返回304

**响应**：
```json
{
  "success": true,
  "data": {
    "room_id": "ROOM01",
    "host_player_id": "player_123",
    "updated_at": 1710280305000,
    "room_static": {
      "boss": "昆图斯",
      "ban_list": ["拉特兰", "卡西米尔"],
      "enemy_type": ["隐匿", "折射"]
    },
    "room_dynamic": {
      "phase": "battle",
      "round": "11"
    },
    "players": [
      {
        "player_id": "player_123",
        "static": {
          "strategy": "文火慢炖"
        },
        "dynamic": {
          "money": 30,
          "operators": [...],
          "alliance_stack": {...},
          "leak_count": 1,
          "cc_level": 5
        },
        "is_host": true
      }
    ]
  }
}
```

### 3. 创建房间

**接口**：`POST /api/rooms`

**请求体**：
```json
{
  "player_id": "player_123",
  "player_name": "玩家名称"
}
```

**响应**：
```json
{
  "success": true,
  "data": {
    "room_id": "ABC123",
    "host_player_id": "player_123",
    "players": [
      {
        "player_id": "player_123",
        "player_name": "玩家名称",
        "is_host": true
      }
    ]
  }
}
```

### 4. 删除房间

**接口**：`DELETE /api/rooms/:roomId`

**响应**：
```json
{
  "success": true,
  "message": "房间已删除"
}
```

### 5. 获取所有房间（调试）

**接口**：`GET /api/rooms`

**响应**：
```json
{
  "success": true,
  "data": [
    {
      "room_id": "ROOM01",
      "host_player_id": "player_123",
      "player_count": 4,
      "created_at": 1710280300000,
      "expires_at": 1710287500000,
      "remaining_time": 7200000
    }
  ]
}
```

## 📋 快速测试

### curl命令示例

**1. 创建房间**

```bash
curl -X POST http://localhost:3000/api/rooms -H "Content-Type: application/json" -d '{"player_id":"p1","player_name":"玩家1"}'
```

**2. 更新房间状态（房主）**

```bash
curl -X POST http://localhost:3000/api/rooms/ROOM01/update -H "Content-Type: application/json" -d '{"player_id":"p1","room_static":{"boss":"昆图斯"},"room_dynamic":{"phase":"battle","round":"1"}}'
```

**3. 获取房间信息**

```bash
curl http://localhost:3000/api/rooms/ROOM01
```

**4. 增量更新（返回304表示未更新）**

```bash
curl "http://localhost:3000/api/rooms/ROOM01?since=1773659567156"
```

**5. 获取所有房间**

```bash
curl http://localhost:3000/api/rooms
```

**6. 删除房间**

```bash
curl -X DELETE http://localhost:3000/api/rooms/ROOM01
```

## 📋 数据结构

### 房间状态（room_static + room_dynamic）

```json
{
  "room_static": {
    "boss": "昆图斯",
    "ban_list": ["拉特兰", "卡西米尔"],
    "enemy_type": ["隐匿", "折射"]
  },
  "room_dynamic": {
    "phase": "battle",
    "round": "11"
  }
}
```

**phase 可选值**：
- `lobby` - 大厅
- `room` - 房间
- `enemy_info` - 敌方信息
- `strategy` - 策略
- `prepare` - 准备
- `battle` - 战斗
- `extra` - 额外
- `result` - 结果
- `unknown` - 未知

### 玩家状态（player_static + player_dynamic）

```json
{
  "static": {
    "strategy": "文火慢炖"
  },
  "dynamic": {
    "money": 30,
    "operators": [
      {"name": "山", "elite": 2},
      {"name": "能天使", "elite": 2}
    ],
    "alliance_stack": {
      "卡西米尔": 2,
      "坚守": 1
    },
    "leak_count": 1,
    "cc_level": 5
  }
}
```

## 💡 使用示例

### 场景：4人组队

**步骤1：玩家1创建房间**

```bash
curl -X POST http://localhost:3000/api/rooms -H "Content-Type: application/json" -d '{"player_id":"p1","player_name":"玩家1"}'
```

**步骤2：玩家1更新房间状态（房主）**

```bash
curl -X POST http://localhost:3000/api/rooms/ROOM01/update -H "Content-Type: application/json" -d '{"player_id":"p1","room_static":{"boss":"昆图斯"},"room_dynamic":{"phase":"battle","round":"1"}}'
```

**步骤3：玩家2加入房间（通过更新接口自动加入）**

```bash
curl -X POST http://localhost:3000/api/rooms/ROOM01/update -H "Content-Type: application/json" -d '{"player_id":"p2","player_static":{"strategy":"文火慢炖"},"player_dynamic":{"money":25}}'
```

**步骤4：玩家3加入房间**

```bash
curl -X POST http://localhost:3000/api/rooms/ROOM01/update -H "Content-Type: application/json" -d '{"player_id":"p3","player_dynamic":{"money":20}}'
```

**步骤5：玩家4加入房间**

```bash
curl -X POST http://localhost:3000/api/rooms/ROOM01/update -H "Content-Type: application/json" -d '{"player_id":"p4","player_dynamic":{"money":15}}'
```

**步骤6：查看完整房间信息**

```bash
curl http://localhost:3000/api/rooms/ROOM01
```

## 🌐 局域网访问

### 获取本机IP

```bash
# macOS/Linux
ifconfig | grep "inet " | grep -v 127.0.0.1

# Windows
ipconfig
```

### 访问地址

```
http://YOUR_IP:3000
```

例如：`http://192.168.2.163:3000`

## 🧪 测试

### REST API 测试

```bash
# 启动服务器
npm start

# 在另一个终端运行测试
node test-rest-api.js
```

## 🧩 客户端集成

### JavaScript/TypeScript 示例

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

## 🔧 配置

### 修改端口

编辑 `server.js`，修改端口：

```javascript
const port = 3000; // 改为你想要的端口
```

### 修改房间有效期

编辑 `server.js`，修改有效期：

```javascript
const ROOM_EXPIRY_TIME = 2 * 60 * 60 * 1000; // 2小时
```

单位：毫秒

## 📊 技术栈

- **Node.js** - 运行环境
- **Express** - Web框架
- **RESTful API** - HTTP接口
- **内存存储** - Map数据结构
- **Compression** - Gzip压缩

## 🎉 特性说明

### 自动创建房间

使用 `/api/rooms/:roomId/update` 时，如果房间不存在会自动创建。

### 部分更新支持

发送更新时只需包含需要更新的字段，未发送的字段保持不变。

### 增量更新

获取房间信息时使用 `since` 参数，可以减少不必要的数据传输。

### 权限控制

- 房间静态状态（`room_static`）：仅房主可更新
- 房间动态状态（`room_dynamic`）：仅房主可更新
- 玩家静态状态（`player_static`）：玩家只能更新自己的
- 玩家动态状态（`player_dynamic`）：玩家只能更新自己的

## 📝 更新规则

### 覆盖更新

如果消息包含字段，则直接覆盖该字段的值。

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

## ⚠️ 注意事项

1. **内存存储** - 服务器重启后所有数据丢失
2. **2小时有效期** - 房间2小时后自动过期
3. **定期轮询** - 建议客户端每2秒轮询一次
4. **数据验证** - 服务器会验证所有输入数据
5. **房主权限** - 只有房主可以更新房间状态

## 🐛 故障排除

### 端口被占用

```bash
# 查找占用端口的进程
lsof -i :3000

# 杀死进程
kill -9 <PID>
```

### 无法访问

1. 检查服务器是否运行
2. 检查防火墙设置
3. 确认IP地址正确
4. 尝试使用 `localhost:3000`

## 📄 许可证

MIT

## 🤝 贡献

欢迎提交问题和拉取请求！

## 📧 联系方式

如有问题，请提交Issue。

---

**版本**: 2.0  
**更新日期**: 2026-03-15  
**协议**: RESTful API