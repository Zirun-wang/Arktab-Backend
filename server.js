const express = require('express');
const app = express();
const port = 3000;

// 提供静态文件服务
app.use(express.static('public'));

// 房间数据存储
const rooms = new Map();
const roomLastUpdated = new Map();

// 房间有效期（2小时）
const ROOM_EXPIRY_TIME = 2 * 60 * 60 * 1000; // 2小时，单位：毫秒

// 后端版本号
const SERVER_VERSION = 'v2.0';

// 清理过期房间的定时器
setInterval(() => {
  const now = Date.now();
  let cleanedCount = 0;
  
  for (const [roomId, roomData] of rooms.entries()) {
    if (now > roomData.expiresAt) {
      rooms.delete(roomId);
      roomLastUpdated.delete(roomId);
      cleanedCount++;
    }
  }
  
  if (cleanedCount > 0) {
    console.log(`[${new Date().toISOString()}] 清理了 ${cleanedCount} 个过期房间`);
  }
}, 5 * 60 * 1000); // 每5分钟清理一次

// 中间件：JSON解析和压缩
app.use(express.json());
app.use(require('compression')());

// 创建房间数据结构
function createRoom(roomId) {
  const now = Date.now();
  return {
    roomId,
    createdAt: now,
    expiresAt: now + ROOM_EXPIRY_TIME,
    room_static: {
      boss: null,
      ban_list: [],
      enemy_type: []
    },
    room_dynamic: {
      phase: 'lobby',
      round: '??'
    },
    players: {}
  };
}

// 健康检查接口
app.get('/', (req, res) => {
  res.json({
    status: 'running',
    version: SERVER_VERSION,
    message: '卫戍协议多人联机服务正常运行',
    protocol: 'REST API v2',
    stats: {
      totalRooms: rooms.size,
      roomExpiryTime: '2小时'
    }
  });
});

// ============ 房间管理接口 ============

// 更新房间状态（主接口）
app.post('/api/rooms/:roomId/update', (req, res) => {
  const { roomId } = req.params;
  const { player_id, room_static, room_dynamic, player_static, player_dynamic } = req.body;
  
  if (!player_id) {
    return res.status(400).json({
      success: false,
      message: '缺少必要参数: player_id'
    });
  }
  
  // 获取或创建房间
  let room = rooms.get(roomId);
  if (!room) {
    room = createRoom(roomId);
    room.hostPlayerId = player_id;
    rooms.set(roomId, room);
    console.log(`[${new Date().toISOString()}] 自动创建房间: ${roomId}, 房主: ${player_id}`);
  }
  
  // 更新房间静态状态
  if (room_static) {
    Object.assign(room.room_static, room_static);
  }
  
  // 更新房间动态状态
  if (room_dynamic) {
    Object.assign(room.room_dynamic, room_dynamic);
  }
  
  // 初始化玩家数据
  if (!room.players[player_id]) {
    room.players[player_id] = {
      player_id: player_id,
      static: {},
      dynamic: {},
      last_updated: Date.now()
    };
  }
  
  // 更新玩家静态状态
  if (player_static) {
    Object.assign(room.players[player_id].static, player_static);
  }
  
  // 更新玩家动态状态（支持部分更新）
  if (player_dynamic) {
    Object.assign(room.players[player_id].dynamic, player_dynamic);
  }
  
  room.players[player_id].last_updated = Date.now();
  roomLastUpdated.set(roomId, Date.now());
  
  res.json({
    success: true,
    message: '更新成功',
    data: {
      roomId: roomId,
      player_id: player_id,
      updated_at: roomLastUpdated.get(roomId)
    }
  });
});

// 获取房间信息（支持增量更新）
app.get('/api/rooms/:roomId', (req, res) => {
  const { roomId } = req.params;
  const { since } = req.query;
  
  const room = rooms.get(roomId);
  if (!room) {
    return res.status(404).json({
      success: false,
      message: '房间不存在'
    });
  }
  
  const lastUpdated = roomLastUpdated.get(roomId) || room.createdAt;
  
  // 如果有since参数且未更新，返回304
  if (since && parseInt(since) >= lastUpdated) {
    return res.status(304).end();
  }
  
  // 构建玩家列表
  const players = Object.values(room.players).map(player => ({
    player_id: player.player_id,
    static: player.static,
    dynamic: player.dynamic,
    is_host: player.player_id === room.hostPlayerId
  }));
  
  res.json({
    success: true,
    data: {
      room_id: roomId,
      host_player_id: room.hostPlayerId,
      updated_at: lastUpdated,
      room_static: room.room_static,
      room_dynamic: room.room_dynamic,
      players: players
    }
  });
});

// 创建房间
app.post('/api/rooms', (req, res) => {
  const { player_id, player_name } = req.body;
  
  if (!player_id || !player_name) {
    return res.status(400).json({
      success: false,
      message: '缺少必要参数: player_id, player_name'
    });
  }
  
  // 生成随机房间号
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let roomId = '';
  for (let i = 0; i < 6; i++) {
    roomId += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  
  // 创建房间
  const room = createRoom(roomId);
  room.hostPlayerId = player_id;
  room.players[player_id] = {
    player_id: player_id,
    player_name: player_name,
    static: {},
    dynamic: {},
    last_updated: Date.now()
  };
  
  rooms.set(roomId, room);
  roomLastUpdated.set(roomId, Date.now());
  
  console.log(`[${new Date().toISOString()}] 创建房间: ${roomId}, 房主: ${player_name}(${player_id})`);
  
  res.json({
    success: true,
    data: {
      room_id: roomId,
      host_player_id: player_id,
      players: [{
        player_id: player_id,
        player_name: player_name,
        is_host: true
      }]
    }
  });
});

// 删除房间
app.delete('/api/rooms/:roomId', (req, res) => {
  const { roomId } = req.params;
  
  if (rooms.has(roomId)) {
    rooms.delete(roomId);
    roomLastUpdated.delete(roomId);
    console.log(`[${new Date().toISOString()}] 删除房间: ${roomId}`);
    res.json({
      success: true,
      message: '房间已删除'
    });
  } else {
    res.status(404).json({
      success: false,
      message: '房间不存在'
    });
  }
});

// 获取所有房间（调试接口）
app.get('/api/rooms', (req, res) => {
  const roomList = Array.from(rooms.values()).map(room => ({
    room_id: room.roomId,
    host_player_id: room.hostPlayerId,
    player_count: Object.keys(room.players).length,
    created_at: room.createdAt,
    expires_at: room.expiresAt,
    remaining_time: Math.max(0, room.expiresAt - Date.now())
  }));
  
  res.json({
    success: true,
    data: roomList
  });
});

// 错误处理中间件
app.use((err, req, res, next) => {
  console.error('服务器错误:', err);
  res.status(500).json({
    success: false,
    message: '服务器内部错误'
  });
});

// 启动服务器
app.listen(port, () => {
  console.log('='.repeat(60));
  console.log(`卫戍协议多人联机服务已启动 (v${SERVER_VERSION})`);
  console.log(`服务地址: http://localhost:${port}`);
  console.log('='.repeat(60));
  console.log('REST API 接口:');
  console.log('  房间管理:');
  console.log('    POST   /api/rooms                    创建房间');
  console.log('    GET    /api/rooms                    获取所有房间');
  console.log('    GET    /api/rooms/:roomId            获取房间信息');
  console.log('    DELETE /api/rooms/:roomId            删除房间');
  console.log('    POST   /api/rooms/:roomId/update     更新房间/玩家状态');
  console.log('='.repeat(60));
  console.log(`房间有效期: 2小时`);
  console.log(`数据格式: JSON (UTF-8)`);
  console.log('='.repeat(60));
});
