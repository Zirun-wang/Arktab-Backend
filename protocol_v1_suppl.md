## 4. 房间管理协议

---

## 4.1 创建房间

### 消息类型

`create_room`

### 方向

客户端 -> 服务器

### 结构

```json
{
  "type": "create_room",
  "data": {
    "room_id": "room123",
    "player_id": "p1",
    "player_name": "Alice"
  }
}
```

### 字段说明

| 字段          | 类型     | 必填 | 说明      |
| ----------- | ------ | -- | ------- |
| room_id     | string | 是  | 房间号     |
| player_id   | string | 是  | 玩家唯一 ID |
| player_name | string | 是  | 玩家显示名   |

### 说明

* 若房间不存在，则创建成功
* 创建者自动成为房主
* 创建成功后服务器应返回 `room_created`
* 同时将创建者加入房间玩家列表

---

## 4.2 创建房间成功响应

### 消息类型

`room_created`

### 方向

服务器 -> 客户端

### 结构

```json
{
  "type": "room_created",
  "ok": true,
  "data": {
    "room_id": "room123",
    "host_player_id": "p1",
    "players": [
      {
        "player_id": "p1",
        "player_name": "Alice",
        "is_host": true
      }
    ]
  }
}
```

---

## 4.3 加入房间

### 消息类型

`join_room`

### 方向

客户端 -> 服务器

### 结构

```json
{
  "type": "join_room",
  "data": {
    "room_id": "room123",
    "player_id": "p2",
    "player_name": "Bob"
  }
}
```

### 字段说明

| 字段          | 类型     | 必填 | 说明      |
| ----------- | ------ | -- | ------- |
| room_id     | string | 是  | 目标房间号   |
| player_id   | string | 是  | 玩家唯一 ID |
| player_name | string | 是  | 玩家显示名   |

---

## 4.4 加入房间成功响应

### 消息类型

`room_joined`

### 方向

服务器 -> 加入者

### 结构

```json
{
  "type": "room_joined",
  "ok": true,
  "data": {
    "room_id": "room123",
    "host_player_id": "p1",
    "players": [
      {
        "player_id": "p1",
        "player_name": "Alice",
        "is_host": true
      },
      {
        "player_id": "p2",
        "player_name": "Bob",
        "is_host": false
      }
    ],
    "room_static": {
      "boss": "昆图斯",
      "ban_list": ["谢拉格", "阿戈尔"],
      "enemy_type": ["持续"]
    },
    "room_dynamic": {
      "phase": "battle",
      "round": "1"
    },
    "player_states": {
      "p1": {
        "static": {
          "strategy": "大帝"
        },
        "dynamic": {
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
    }
  }
}
```

### 说明

* 加入成功后，服务器应把当前房间完整快照返回给加入者
* 这样新加入玩家不需要等待别人重新同步一遍
* `player_states` 可为空对象 `{}`

---

## 4.5 玩家加入广播

### 消息类型

`player_joined`

### 方向

服务器 -> 房间内其他玩家

### 结构

```json
{
  "type": "player_joined",
  "data": {
    "player_id": "p2",
    "player_name": "Bob",
    "is_host": false
  }
}
```

### 说明

* 某玩家加入房间后，服务器向房间内其他客户端广播
* 加入者本人通常不需要再收到这条广播，因为他已经收到 `room_joined`

---

## 4.6 离开房间

### 消息类型

`leave_room`

### 方向

客户端 -> 服务器

### 结构

```json
{
  "type": "leave_room",
  "data": {
    "room_id": "room123",
    "player_id": "p2"
  }
}
```

### 说明

* 玩家主动退出房间
* 服务器收到后将其从房间中移除
* 然后广播 `player_left`

---

## 4.7 玩家离开广播

### 消息类型

`player_left`

### 方向

服务器 -> 房间内其他玩家

### 结构

```json
{
  "type": "player_left",
  "data": {
    "player_id": "p2"
  }
}
```

### 说明

* 用于表示玩家主动退出、掉线超时、或被服务器移除

---

## 4.8 房主变更广播

### 消息类型

`host_changed`

### 方向

服务器 -> 房间内所有玩家

### 结构

```json
{
  "type": "host_changed",
  "data": {
    "host_player_id": "p3"
  }
}
```

### 说明

* 如果原房主离开，服务器应自动选择新房主
* v1 推荐策略：按加入顺序选择当前房间最早进入且仍在线的玩家作为新房主

---

## 4.9 房间关闭广播

### 消息类型

`room_closed`

### 方向

服务器 -> 房间内所有玩家

### 结构

```json
{
  "type": "room_closed",
  "data": {
    "room_id": "room123",
    "reason": "host_left_and_room_empty"
  }
}
```

### 说明

* 当房间无人时，服务器可直接删除房间
* 若业务上需要，也可在房主离开时关闭整个房间

