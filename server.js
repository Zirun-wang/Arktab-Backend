const express = require('express');
const app = express();
const port = 3000;

// 提供静态文件服务
app.use(express.static('public'));

// 房间数据存储
const rooms = new Map();
const roomLastUpdated = new Map();

// 房间有效期（30分钟，从最后一次更新开始计算）
const ROOM_EXPIRY_TIME = 30 * 60 * 1000; // 30分钟，单位：毫秒

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
    room_settings: {
      max_players: 4,
      enable_battle_progress_detection: false,
      enable_leak_count_detection: false,
      host_display_text: ''
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
  const { player_id, static: player_static, dynamic: player_dynamic, room_settings } = req.body;
  
  if (!player_id) {
    return res.status(400).json({
      success: false,
      message: '缺少必要参数: player_id'
    });
  }
  
  // 获取房间（不存在则返回404）
  const room = rooms.get(roomId);
  if (!room) {
    return res.status(404).json({
      success: false,
      message: '房间不存在'
    });
  }
  
  // 检查玩家是否在房间内
  if (!room.players[player_id]) {
    return res.status(400).json({
      success: false,
      message: '玩家不在房间内'
    });
  }
  
  // 更新房间设置（只有房主可以更新）
  if (room_settings) {
    if (player_id !== room.hostPlayerId) {
      return res.status(403).json({
        success: false,
        message: '只有房主可以更新房间设置'
      });
    }
    Object.assign(room.room_settings, room_settings);
  }
  
  // 更新玩家静态状态（包括房间级别字段）
  if (player_static) {
    Object.assign(room.players[player_id].static, player_static);
  }
  
  // 更新玩家动态状态（包括房间级别字段）
  if (player_dynamic) {
    Object.assign(room.players[player_id].dynamic, player_dynamic);
  }
  
  room.players[player_id].last_updated = Date.now();
  roomLastUpdated.set(roomId, Date.now());
  room.expiresAt = Date.now() + ROOM_EXPIRY_TIME; // 更新过期时间
  
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
    player_name: player.player_name,
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
      room_settings: room.room_settings,
      players: players
    }
  });
});

// 创建房间
app.post('/api/rooms', (req, res) => {
  const { player_name } = req.body;
  
  if (!player_name) {
    return res.status(400).json({
      success: false,
      message: '缺少必要参数: player_name'
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
  
  // 服务器分配player_id（第一个玩家是p1）
  const playerId = 'p1';
  room.hostPlayerId = playerId;
  room.players[playerId] = {
    player_id: playerId,
    player_name: player_name,
    static: {},
    dynamic: {},
    last_updated: Date.now()
  };
  
  rooms.set(roomId, room);
  roomLastUpdated.set(roomId, Date.now());
  
  console.log(`[${new Date().toISOString()}] 创建房间: ${roomId}, 房主: ${player_name}(${playerId})`);
  
  res.json({
    success: true,
    data: {
      room_id: roomId,
      host_player_id: playerId,
      player_id: playerId,
      player_name: player_name,
      players: [{
        player_id: playerId,
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

// 加入房间
app.post('/api/rooms/:roomId/join', (req, res) => {
  const { roomId } = req.params;
  const { player_name } = req.body;
  
  if (!player_name) {
    return res.status(400).json({
      success: false,
      message: '缺少必要参数: player_name'
    });
  }
  
  // 获取房间
  const room = rooms.get(roomId);
  if (!room) {
    return res.status(404).json({
      success: false,
      message: '房间不存在'
    });
  }
  
  // 检查是否达到人数上限
  const currentPlayers = Object.keys(room.players).length;
  if (currentPlayers >= room.room_settings.max_players) {
    return res.status(400).json({
      success: false,
      message: '房间已满'
    });
  }
  
  // 生成player_id（p1, p2, p3, p4）
  let playerId = null;
  for (let i = 1; i <= 4; i++) {
    const candidateId = `p${i}`;
    if (!room.players[candidateId]) {
      playerId = candidateId;
      break;
    }
  }
  
  if (!playerId) {
    return res.status(400).json({
      success: false,
      message: '房间已满'
    });
  }
  
  // 添加玩家到房间
  room.players[playerId] = {
    player_id: playerId,
    player_name: player_name,
    static: {},
    dynamic: {},
    last_updated: Date.now()
  };
  
  roomLastUpdated.set(roomId, Date.now());
  room.expiresAt = Date.now() + ROOM_EXPIRY_TIME; // 更新过期时间
  
  console.log(`[${new Date().toISOString()}] 玩家加入房间: ${roomId}, 玩家: ${player_name}(${playerId})`);
  
  res.json({
    success: true,
    message: '加入房间成功',
    data: {
      room_id: roomId,
      host_player_id: room.hostPlayerId,
      player_id: playerId,
      player_name: player_name,
      room_settings: room.room_settings,
      players: Object.values(room.players).map(player => ({
        player_id: player.player_id,
        player_name: player.player_name,
        is_host: player.player_id === room.hostPlayerId
      }))
    }
  });
});

// 退出房间
app.post('/api/rooms/:roomId/leave', (req, res) => {
  const { roomId } = req.params;
  const { player_id } = req.body;
  
  if (!player_id) {
    return res.status(400).json({
      success: false,
      message: '缺少必要参数: player_id'
    });
  }
  
  // 获取房间
  const room = rooms.get(roomId);
  if (!room) {
    return res.status(404).json({
      success: false,
      message: '房间不存在'
    });
  }
  
  // 检查玩家是否在房间内
  if (!room.players[player_id]) {
    return res.status(400).json({
      success: false,
      message: '玩家不在房间内'
    });
  }
  
  const playerName = room.players[player_id].player_name;
  const isHost = (player_id === room.hostPlayerId);
  
  // 移除玩家
  delete room.players[player_id];
  
  // 如果是房主退出，转移房主给下一个玩家
  if (isHost) {
    const remainingPlayers = Object.keys(room.players);
    
    if (remainingPlayers.length === 0) {
      // 没有其他玩家，删除房间
      rooms.delete(roomId);
      roomLastUpdated.delete(roomId);
      console.log(`[${new Date().toISOString()}] 房主退出，无其他玩家，删除房间: ${roomId}, 房主: ${playerName}(${player_id})`);
      
      return res.json({
        success: true,
        message: '房主退出，房间已解散',
        data: {
          room_deleted: true,
          room_id: roomId,
          host_transferred: false
        }
      });
    }
    
    // 找到下一个玩家（player_id最小的一个）
    const nextHostId = remainingPlayers.sort((a, b) => {
      const aNum = parseInt(a.substring(1));
      const bNum = parseInt(b.substring(1));
      return aNum - bNum;
    })[0];
    
    const newHostName = room.players[nextHostId].player_name;
    room.hostPlayerId = nextHostId;
    
    roomLastUpdated.set(roomId, Date.now());
    room.expiresAt = Date.now() + ROOM_EXPIRY_TIME;
    
    console.log(`[${new Date().toISOString()}] 房主退出，转移房主给: ${newHostName}(${nextHostId}), 原房主: ${playerName}(${player_id})`);
    
    res.json({
      success: true,
      message: '房主退出，房主已转移',
      data: {
        room_id: roomId,
        player_id: player_id,
        host_transferred: true,
        new_host_id: nextHostId,
        new_host_name: newHostName,
        player_count: remainingPlayers.length
      }
    });
  } else {
    // 普通玩家退出
    roomLastUpdated.set(roomId, Date.now());
    room.expiresAt = Date.now() + ROOM_EXPIRY_TIME; // 更新过期时间
    
    console.log(`[${new Date().toISOString()}] 玩家退出房间: ${roomId}, 玩家: ${playerName}(${player_id})`);
    
    res.json({
      success: true,
      message: '退出房间成功',
      data: {
        room_id: roomId,
        player_id: player_id,
        player_count: Object.keys(room.players).length
      }
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
  console.log('    POST   /api/rooms/:roomId/join       加入房间');
  console.log('    POST   /api/rooms/:roomId/leave      退出房间');
  console.log('    GET    /api/rooms                    获取所有房间');
  console.log('    GET    /api/rooms/:roomId            获取房间信息');
  console.log('    DELETE /api/rooms/:roomId            删除房间');
  console.log('    POST   /api/rooms/:roomId/update     更新房间/玩家状态');
  console.log('='.repeat(60));
  console.log(`房间有效期: 30分钟（从最后一次更新开始计算）`);
  console.log(`数据格式: JSON (UTF-8)`);
  console.log('='.repeat(60));
});
