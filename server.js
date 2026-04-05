// 加载环境变量
require('dotenv').config();

const express = require('express');
const fs = require('fs');
const path = require('path');
const app = express();
const port = process.env.PORT || 3000;

// 确保归档目录存在
const ARCHIVED_ROOMS_DIR = path.join(__dirname, 'archived_rooms');
if (!fs.existsSync(ARCHIVED_ROOMS_DIR)) {
  fs.mkdirSync(ARCHIVED_ROOMS_DIR, { recursive: true });
}

// 房间数据存储
const rooms = new Map();
const roomLastUpdated = new Map();

// 房间有效期（30分钟，从最后一次更新开始计算）
const ROOM_EXPIRY_TIME = 30 * 60 * 1000; // 30分钟，单位：毫秒

// 后端版本号
const SERVER_VERSION = 'v2.0';

// 客户端当前版本号
const CLIENT_LATEST_VERSION = '26033001';

// 管理员密码（从环境变量读取，默认为空字符串）
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || '';

// 简单的会话存储（内存中，重启后失效）
const sessions = new Map();

// 统计数据
let requestCount = 0;
let bytesTransferred = 0;
let qpsHistory = [];
const MAX_HISTORY_POINTS = 300; // 保存最近5分钟的数据（每秒一次）

// 归档房间数据到文件
function archiveRoom(room, reason = 'T') {
  try {
    const now = new Date();
    const timestamp = now.toISOString().replace(/[:.]/g, '-').substring(0, 19);
    
    // 获取房主名称
    const hostPlayer = Object.values(room.players).find(p => p.player_id === room.hostPlayerId);
    const hostName = hostPlayer ? hostPlayer.player_name : 'unknown';
    
    // reason: T=超时, D=主动解散
    // 生成文件名：时间戳 + 原因 + 房间ID + 房主名
    const fileName = `${timestamp}_${reason}_${room.roomId}_${hostName}.json`;
    const filePath = path.join(ARCHIVED_ROOMS_DIR, fileName);
    
    // 构建归档数据（完整快照）
    const archivedData = {
      archived_at: now.toISOString(),
      room_id: room.roomId,
      host_player_id: room.hostPlayerId,
      created_at: new Date(room.createdAt).toISOString(),
      expires_at: new Date(room.expiresAt).toISOString(),
      duration_ms: room.expiresAt - room.createdAt,
      duration_hours: ((room.expiresAt - room.createdAt) / (1000 * 60 * 60)).toFixed(2),
      room_settings: room.room_settings,
      player_count: Object.keys(room.players).length,
      players: Object.values(room.players).map(player => ({
        player_id: player.player_id,
        player_name: player.player_name,
        static: player.static,
        dynamic: player.dynamic,
        is_host: player.player_id === room.hostPlayerId,
        last_updated: new Date(player.last_updated).toISOString()
      }))
    };
    
    // 写入文件
    fs.writeFileSync(filePath, JSON.stringify(archivedData, null, 2), 'utf8');
    
    console.log(`[${now.toISOString()}] 房间已归档: ${room.roomId} -> ${fileName}`);
    return true;
  } catch (error) {
    console.error(`[${new Date().toISOString()}] 归档房间失败: ${room.roomId}`, error);
    return false;
  }
}

// 清理过期房间的定时器
setInterval(() => {
  const now = Date.now();
  let cleanedCount = 0;
  let archivedCount = 0;
  
  for (const [roomId, roomData] of rooms.entries()) {
    if (now > roomData.expiresAt) {
      // 归档房间数据（超时归档）
      const archived = archiveRoom(roomData, 'T');
      if (archived) {
        archivedCount++;
      }
      
      rooms.delete(roomId);
      roomLastUpdated.delete(roomId);
      cleanedCount++;
    }
  }
  
  if (cleanedCount > 0) {
    console.log(`[${new Date().toISOString()}] 清理了 ${cleanedCount} 个过期房间，其中 ${archivedCount} 个已归档`);
  }
}, 5 * 60 * 1000); // 每5分钟清理一次

// 中间件：JSON解析和压缩
app.use(express.json());
app.use(require('compression')());

// 统计中间件：记录请求和带宽
app.use((req, res, next) => {
  requestCount++;
  
  // 拦截 res.send 和 res.json 来统计传输字节数
  const originalSend = res.send;
  const originalJson = res.json;
  
  res.send = function(data) {
    const chunk = Buffer.isBuffer(data) ? data : Buffer.from(JSON.stringify(data));
    bytesTransferred += chunk.length;
    return originalSend.call(this, data);
  };
  
  res.json = function(data) {
    const chunk = Buffer.from(JSON.stringify(data));
    bytesTransferred += chunk.length;
    return originalJson.call(this, data);
  };
  
  next();
});

// 每秒更新 QPS 历史数据
setInterval(() => {
  const now = Date.now();
  const qps = requestCount;
  
  qpsHistory.push({
    timestamp: now,
    qps: qps
  });
  
  // 保持最近 300 个数据点（5 分钟）
  if (qpsHistory.length > MAX_HISTORY_POINTS) {
    qpsHistory.shift();
  }
  
  // 重置计数器
  requestCount = 0;
  const bytesThisSecond = bytesTransferred;
  bytesTransferred = 0;
  
  console.log(`[${new Date().toISOString()}] QPS: ${qps}, 带宽: ${(bytesThisSecond / 1024).toFixed(2)} KB/s`);
}, 1000); // 每秒更新一次

// 辅助函数：统计目录大小
function getDirSize(dirPath) {
  let totalSize = 0;
  
  try {
    const files = fs.readdirSync(dirPath);
    
    for (const file of files) {
      const filePath = path.join(dirPath, file);
      const stats = fs.statSync(filePath);
      
      if (stats.isDirectory()) {
        totalSize += getDirSize(filePath); // 递归
      } else {
        totalSize += stats.size;
      }
    }
  } catch (error) {
    console.error(`统计目录大小失败: ${dirPath}`, error);
  }
  
  return totalSize;
}

// 认证中间件
function requireAuth(req, res, next) {
  const token = req.headers['authorization'];
  
  if (!token) {
    return res.status(401).json({
      success: false,
      message: '需要登录'
    });
  }
  
  const session = sessions.get(token);
  
  if (!session) {
    return res.status(401).json({
      success: false,
      message: '会话已过期或无效'
    });
  }
  
  // 检查会话是否过期（24小时）
  if (Date.now() > session.expiresAt) {
    sessions.delete(token);
    return res.status(401).json({
      success: false,
      message: '会话已过期，请重新登录'
    });
  }
  
  // 刷新会话过期时间
  session.expiresAt = Date.now() + 24 * 60 * 60 * 1000;
  
  next();
}

// 登录接口
app.post('/api/admin/login', (req, res) => {
  const { password } = req.body;
  
  if (!password) {
    return res.status(400).json({
      success: false,
      message: '缺少必要参数: password'
    });
  }
  
  // 检查密码是否匹配
  if (password !== ADMIN_PASSWORD) {
    return res.status(401).json({
      success: false,
      message: '密码错误'
    });
  }
  
  // 生成会话令牌
  const token = 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  sessions.set(token, {
    createdAt: Date.now(),
    expiresAt: Date.now() + 24 * 60 * 60 * 1000 // 24小时后过期
  });
  
  res.json({
    success: true,
    message: '登录成功',
    data: {
      token: token
    }
  });
});

// 登出接口
app.post('/api/admin/logout', requireAuth, (req, res) => {
  const token = req.headers['authorization'];
  sessions.delete(token);
  
  res.json({
    success: true,
    message: '登出成功'
  });
});

// 获取归档文件列表（需要认证）
app.get('/api/admin/archives', requireAuth, (req, res) => {
  try {
    const files = fs.readdirSync(ARCHIVED_ROOMS_DIR)
      .filter(file => file.endsWith('.json'))
      .map(file => {
        const filePath = path.join(ARCHIVED_ROOMS_DIR, file);
        const stats = fs.statSync(filePath);
        
        // 读取文件基本信息
        const fileData = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        
        return {
          filename: file,
          size: stats.size,
          created_at: stats.mtime.toISOString(),
          archived_at: fileData.archived_at,
          room_id: fileData.room_id,
          host_name: fileData.players?.find(p => p.is_host)?.player_name || 'unknown',
          player_count: fileData.player_count,
          duration_hours: fileData.duration_hours
        };
      })
      .sort((a, b) => new Date(b.archived_at) - new Date(a.archived_at)); // 按时间倒序
    
    res.json({
      success: true,
      data: {
        total: files.length,
        files: files
      }
    });
  } catch (error) {
    console.error('获取归档列表失败:', error);
    res.status(500).json({
      success: false,
      message: '获取归档列表失败'
    });
  }
});

// 下载归档文件（需要认证）
app.get('/api/admin/archives/:filename', requireAuth, (req, res) => {
  const { filename } = req.params;
  
  // 安全检查：防止路径遍历攻击
  if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
    return res.status(400).json({
      success: false,
      message: '非法文件名'
    });
  }
  
  const filePath = path.join(ARCHIVED_ROOMS_DIR, filename);
  
  // 检查文件是否存在
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({
      success: false,
      message: '文件不存在'
    });
  }
  
  // 检查是否为JSON文件
  if (!filename.endsWith('.json')) {
    return res.status(400).json({
      success: false,
      message: '只允许下载JSON文件'
    });
  }
  
  // 发送文件
  res.download(filePath, filename, (err) => {
    if (err) {
      console.error('下载文件失败:', err);
      if (!res.headersSent) {
        res.status(500).json({
          success: false,
          message: '下载文件失败'
        });
      }
    } else {
      console.log(`[${new Date().toISOString()}] 文件下载: ${filename}`);
    }
  });
});

// 删除归档文件（需要认证）
app.delete('/api/admin/archives/:filename', requireAuth, (req, res) => {
  const { filename } = req.params;
  
  // 安全检查：防止路径遍历攻击
  if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
    return res.status(400).json({
      success: false,
      message: '非法文件名'
    });
  }
  
  const filePath = path.join(ARCHIVED_ROOMS_DIR, filename);
  
  // 检查文件是否存在
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({
      success: false,
      message: '文件不存在'
    });
  }
  
  // 检查是否为JSON文件
  if (!filename.endsWith('.json')) {
    return res.status(400).json({
      success: false,
      message: '只允许删除JSON文件'
    });
  }
  
  try {
    fs.unlinkSync(filePath);
    console.log(`[${new Date().toISOString()}] 归档文件已删除: ${filename}`);
    
    res.json({
      success: true,
      message: '文件已删除'
    });
  } catch (error) {
    console.error('删除归档文件失败:', error);
    res.status(500).json({
      success: false,
      message: '删除文件失败'
    });
  }
});

// 检查登录状态
app.get('/api/admin/check', requireAuth, (req, res) => {
  res.json({
    success: true,
    message: '已登录'
  });
});

// 获取服务器统计信息（需要认证）
app.get('/api/admin/stats', requireAuth, (req, res) => {
  try {
    // 统计总玩家数
    let totalPlayers = 0;
    for (const room of rooms.values()) {
      totalPlayers += Object.keys(room.players).length;
    }
    
    // 统计归档目录大小
    const archiveSize = getDirSize(ARCHIVED_ROOMS_DIR);
    const archiveSizeMB = (archiveSize / 1024 / 1024).toFixed(2);
    
    // 获取当前 QPS（最近一秒）
    const currentQPS = qpsHistory.length > 0 ? qpsHistory[qpsHistory.length - 1].qps : 0;
    
    // 计算最近 5 秒的平均 QPS
    let avgQPS5s = 0;
    const recentQPS5 = qpsHistory.slice(-5);
    if (recentQPS5.length > 0) {
      avgQPS5s = recentQPS5.reduce((sum, item) => sum + item.qps, 0) / recentQPS5.length;
    }
    
    // 计算最近 60 秒的平均 QPS
    let avgQPS60s = 0;
    const recentQPS60 = qpsHistory.slice(-60);
    if (recentQPS60.length > 0) {
      avgQPS60s = recentQPS60.reduce((sum, item) => sum + item.qps, 0) / recentQPS60.length;
    }
    
    res.json({
      success: true,
      data: {
        timestamp: Date.now(),
        rooms: rooms.size,
        players: totalPlayers,
        qps: currentQPS,
        avgQPS5s: avgQPS5s.toFixed(2),
        avgQPS60s: avgQPS60s.toFixed(2),
        archiveSizeBytes: archiveSize,
        archiveSizeMB: archiveSizeMB,
        qpsHistory: qpsHistory.map(item => ({
          timestamp: item.timestamp,
          qps: item.qps
        }))
      }
    });
  } catch (error) {
    console.error('获取统计信息失败:', error);
    res.status(500).json({
      success: false,
      message: '获取统计信息失败'
    });
  }
});

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

// 根页面 - 简单页面
app.get('/', (req, res) => {
  res.send('<!DOCTYPE html><html><head><meta charset="UTF-8"><title>卫戍协议</title></head><body style="display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; font-family: Arial, sans-serif; font-size: 24px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white;">卫戍协议tab</body></html>');
});

// 开发文档页面
app.get('/developer', (req, res) => {
  res.sendFile(__dirname + '/public/index.html');
});

// 提供静态文件服务（放在根路由之后，这样 / 会返回简单页面，但 /index.html 可以访问开发文档）
app.use(express.static('public'));

// 健康检查接口
app.get('/health', (req, res) => {
  res.json({
    status: 'running',
    version: SERVER_VERSION,
    message: '卫戍协议多人联机服务正常运行',
    protocol: 'REST API v2',
    stats: {
      totalRooms: rooms.size,
      roomExpiryTime: '30分钟'
    }
  });
});

// 客户端版本检查接口
app.post('/api/check-version', (req, res) => {
  const { client_version } = req.body;
  
  // 检查是否是最新版本
  const isLatest = !client_version || client_version === CLIENT_LATEST_VERSION;
  
  res.json({
    success: true,
    data: {
      is_latest: isLatest,
      current_version: CLIENT_LATEST_VERSION,
      message: '此处为占位字符'
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
      // 没有其他玩家，先归档再删除房间（主动解散）
      archiveRoom(room, 'D');
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
  console.log('    POST   /api/rooms/:roomId/update     更新房间/玩家状态');
  console.log('='.repeat(60));
  console.log('管理员接口:');
  console.log('    POST   /api/admin/login              登录');
  console.log('    POST   /api/admin/logout             登出');
  console.log('    GET    /api/admin/check              检查登录状态');
  console.log('    GET    /api/admin/archives           获取归档列表');
  console.log('    GET    /api/admin/archives/:filename  下载归档文件');
  console.log('    DELETE /api/admin/archives/:filename  删除归档文件');
  console.log('='.repeat(60));
  console.log(`房间有效期: 30分钟（从最后一次更新开始计算）`);
  console.log(`归档规则: 所有房间关闭都会归档（超时/主动解散）`);
  console.log(`归档命名: 时间戳_T_房间ID_房主名.json (超时)`);
  console.log(`归档命名: 时间戳_D_房间ID_房主名.json (主动解散)`);
  console.log(`过期房间归档: ./archived_rooms/`);
  console.log(`数据格式: JSON (UTF-8)`);
  if (ADMIN_PASSWORD) {
    console.log(`管理员密码: 已配置（使用环境变量 ADMIN_PASSWORD）`);
  } else {
    console.log(`⚠️  警告: 未配置管理员密码，管理功能将无法使用`);
    console.log(`请在 .env 文件中设置 ADMIN_PASSWORD=你的密码`);
  }
  console.log('='.repeat(60));
});