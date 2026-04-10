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

  // 版本信息配置文件路径
  const VERSION_CONFIG_FILE = path.join(__dirname, 'version_info.json');

  // 默认版本配置
  const DEFAULT_VERSION_CONFIG = {
    CLIENT_LATEST_VERSION: '26033001',
    SERVER_VERSION: 'v2.0',
    VERSION_MESSAGE: '此处为占位字符'
  };

  // 内存中的版本配置
  let versionConfig = { ...DEFAULT_VERSION_CONFIG };

  // 读取版本配置文件
  function loadVersionConfig() {
    try {
      if (fs.existsSync(VERSION_CONFIG_FILE)) {
        const data = fs.readFileSync(VERSION_CONFIG_FILE, 'utf8');
        versionConfig = JSON.parse(data);
        console.log(`[${new Date().toISOString()}] 版本配置已加载:`, versionConfig);
      } else {
        // 文件不存在，创建默认配置
        fs.writeFileSync(VERSION_CONFIG_FILE, JSON.stringify(DEFAULT_VERSION_CONFIG, null, 2), 'utf8');
        console.log(`[${new Date().toISOString()}] 版本配置文件不存在，已创建默认配置`);
      }
    } catch (error) {
      console.error(`[${new Date().toISOString()}] 读取版本配置文件失败:`, error);
      // 使用默认配置
      versionConfig = { ...DEFAULT_VERSION_CONFIG };
    }
  }

  // 保存版本配置文件（带备份机制）
  function saveVersionConfig(newConfig) {
    try {
      // 验证JSON格式
      JSON.parse(JSON.stringify(newConfig));

      // 生成备份文件
      const backupFile = VERSION_CONFIG_FILE + '.bak';
      if (fs.existsSync(VERSION_CONFIG_FILE)) {
        fs.copyFileSync(VERSION_CONFIG_FILE, backupFile);
        console.log(`[${new Date().toISOString()}] 已创建备份文件: ${backupFile}`);
      }

      // 写入新配置
      fs.writeFileSync(VERSION_CONFIG_FILE, JSON.stringify(newConfig, null, 2), 'utf8');
      
      // 更新内存中的配置
      versionConfig = { ...newConfig };
      
      // 删除备份文件
      if (fs.existsSync(backupFile)) {
        fs.unlinkSync(backupFile);
        console.log(`[${new Date().toISOString()}] 备份文件已删除: ${backupFile}`);
      }

      return true;
    } catch (error) {
      console.error(`[${new Date().toISOString()}] 保存版本配置失败:`, error);
      
      // 如果有备份文件，尝试恢复
      const backupFile = VERSION_CONFIG_FILE + '.bak';
      if (fs.existsSync(backupFile)) {
        try {
          fs.copyFileSync(backupFile, VERSION_CONFIG_FILE);
          console.log(`[${new Date().toISOString()}] 已从备份文件恢复配置`);
        } catch (restoreError) {
          console.error(`[${new Date().toISOString()}] 恢复备份文件失败:`, restoreError);
        }
      }

      return false;
    }
  }

  // 初始化时加载版本配置
  loadVersionConfig();

// 房间数据存储
const rooms = new Map();
const roomLastUpdated = new Map();
// 房间快照定时器存储
const roomSnapshotTimers = new Map();
// 房间快照计数器存储
const roomSnapshotCounts = new Map();

// 房间有效期（30分钟，从最后一次更新开始计算）
const ROOM_EXPIRY_TIME = 30 * 60 * 1000; // 30分钟，单位：毫秒

// 从配置文件读取版本号（由 loadVersionConfig() 初始化）
const SERVER_VERSION = () => versionConfig.SERVER_VERSION;
const CLIENT_LATEST_VERSION = () => versionConfig.CLIENT_LATEST_VERSION;
const VERSION_MESSAGE = () => versionConfig.VERSION_MESSAGE;

// 管理员密码（从环境变量读取，默认为空字符串）
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || '';

// 简单的会话存储（内存中，重启后失效）
const sessions = new Map();

// 统计数据
let requestCount = 0;
let bytesTransferred = 0;
let qpsHistory = [];
const MAX_HISTORY_POINTS = 300; // 保存最近5分钟的数据（每秒一次）

// 归档房间数据到文件（定期快照）
function archiveRoom(room) {
  try {
    const now = new Date();
    const timestamp = now.toISOString().replace(/[:.]/g, '-').substring(0, 19);
    
    // 获取或初始化快照序号
    let snapshotNumber = roomSnapshotCounts.get(room.roomId) || 0;
    snapshotNumber++;
    roomSnapshotCounts.set(room.roomId, snapshotNumber);
    
    // 生成文件名：时间戳 + 序号 + 房间ID
    const fileName = `${timestamp}_${String(snapshotNumber).padStart(3, '0')}_${room.roomId}.json`;
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
        static: player.static,
        dynamic: player.dynamic,
        is_host: player.player_id === room.hostPlayerId,
        last_updated: new Date(player.last_updated).toISOString()
      }))
    };
    
    // 写入文件
    fs.writeFileSync(filePath, JSON.stringify(archivedData, null, 2), 'utf8');
    
    console.log(`[${now.toISOString()}] 房间快照已保存: ${room.roomId} -> ${fileName} (第${snapshotNumber}次快照)`);
    return true;
  } catch (error) {
    console.error(`[${new Date().toISOString()}] 归档房间失败: ${room.roomId}`, error);
    return false;
  }
}

// 启动房间快照定时器
function startRoomSnapshotTimer(roomId) {
  // 清除旧的定时器（如果存在）
  const existingTimer = roomSnapshotTimers.get(roomId);
  if (existingTimer) {
    clearTimeout(existingTimer);
  }
  
  // 创建新的定时器：5分钟后第一次快照，之后每5分钟一次
  const timerId = setTimeout(() => {
    const room = rooms.get(roomId);
    if (room) {
      // 保存快照
      archiveRoom(room);
      
      // 继续下一个5分钟定时器
      startRoomSnapshotTimer(roomId);
    }
  }, 5 * 60 * 1000); // 5分钟
  
  roomSnapshotTimers.set(roomId, timerId);
  console.log(`[${new Date().toISOString()}] 房间 ${roomId} 快照定时器已启动，5分钟后第一次快照`);
}

// 清理过期房间的定时器
setInterval(() => {
  const now = Date.now();
  let cleanedCount = 0;
  
  for (const [roomId, roomData] of rooms.entries()) {
    if (now > roomData.expiresAt) {
      // 清除快照定时器
      const timerId = roomSnapshotTimers.get(roomId);
      if (timerId) {
        clearTimeout(timerId);
        roomSnapshotTimers.delete(roomId);
      }
      
      // 清除快照计数器
      roomSnapshotCounts.delete(roomId);
      
      // 删除房间
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
    // 先获取总数（不解析JSON，只统计文件数）
    const allFiles = fs.readdirSync(ARCHIVED_ROOMS_DIR)
      .filter(file => file.endsWith('.json'));
    const totalCount = allFiles.length;
    
    // 只处理前100个文件
    let files = allFiles.slice(0, 100)
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
          host_player_id: fileData.host_player_id,
          player_count: fileData.player_count,
          duration_hours: fileData.duration_hours
        };
      })
      .sort((a, b) => new Date(b.archived_at) - new Date(a.archived_at)); // 按时间倒序
    
    res.json({
      success: true,
      data: {
        total: totalCount, // 实际总数
        displayed: files.length, // 实际显示的数量
        display_limit: 100,
        has_more: totalCount > 100, // 是否还有更多
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
    
    // 获取系统监控数据
    const cpuInfo = os.cpus()[0];
    const cpuCores = os.cpus().length;
    const cpuModel = cpuInfo.model;
    
    // 获取内存信息
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = totalMem - freeMem;
    const memUsagePercent = (usedMem / totalMem) * 100;
    
    // 获取硬盘使用率
    let diskUsage = { total: '0', used: '0', free: '0', usagePercent: 0 };
    try {
      const { execSync } = require('child_process');
      const diskStats = execSync('df -h /', { encoding: 'utf8' });
      const lines = diskStats.split('\n');
      if (lines.length > 1) {
        const parts = lines[1].split(/\s+/);
        diskUsage = {
          total: parts[1],
          used: parts[2],
          free: parts[3],
          usagePercent: parseFloat(parts[4]) || 0
        };
      }
    } catch (error) {
      console.error('获取硬盘信息失败:', error);
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
        })),
        // 系统监控数据
        system: {
          cpu: {
            model: cpuModel,
            cores: cpuCores,
            usagePercent: 0  // CPU使用率需要异步采样，这里先返回0
          },
          memory: {
            total: (totalMem / 1024 / 1024 / 1024).toFixed(2) + ' GB',
            used: (usedMem / 1024 / 1024 / 1024).toFixed(2) + ' GB',
            free: (freeMem / 1024 / 1024 / 1024).toFixed(2) + ' GB',
            usagePercent: memUsagePercent.toFixed(2)
          },
          disk: {
            total: diskUsage.total,
            used: diskUsage.used,
            free: diskUsage.free,
            usagePercent: diskUsage.usagePercent
          }
        }
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
      enable_leak_count_detection: false
    },
    players: {}
  };
}

// 根页面 - 入口页面
app.get('/', (req, res) => {
  res.sendFile(__dirname + '/public/index.html');
});

// 开发文档页面
app.get('/developer', (req, res) => {
  res.sendFile(__dirname + '/public/developer.html');
});

// 提供静态文件服务（放在根路由之后，这样 / 会返回简单页面，但 /index.html 可以访问开发文档）
app.use(express.static('public'));

// 健康检查接口
app.get('/health', (req, res) => {
  res.json({
    status: 'running',
    version: SERVER_VERSION(),
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
  const isLatest = !client_version || client_version === CLIENT_LATEST_VERSION();
  
  res.json({
    success: true,
    data: {
      is_latest: isLatest,
      current_version: CLIENT_LATEST_VERSION(),
      message: VERSION_MESSAGE()
    }
  });
});

// 获取版本配置（需要认证）
app.get('/api/admin/version-config', requireAuth, (req, res) => {
  res.json({
    success: true,
    data: versionConfig
  });
});

// 更新版本配置（需要认证）
app.post('/api/admin/version-config', requireAuth, (req, res) => {
  const { CLIENT_LATEST_VERSION: clientVersion, SERVER_VERSION: serverVersion, VERSION_MESSAGE: versionMessage } = req.body;
  
  // 验证参数
  if (!clientVersion || !serverVersion || versionMessage === undefined) {
    return res.status(400).json({
      success: false,
      message: '缺少必要参数'
    });
  }
  
  // 构建新配置
  const newConfig = {
    CLIENT_LATEST_VERSION: clientVersion,
    SERVER_VERSION: serverVersion,
    VERSION_MESSAGE: versionMessage
  };
  
  // 保存配置（带备份和热更新）
  const saved = saveVersionConfig(newConfig);
  
  if (saved) {
    res.json({
      success: true,
      message: '版本配置已更新'
    });
  } else {
    res.status(500).json({
      success: false,
      message: '保存配置失败，请查看服务器日志'
    });
  }
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
  
  // 初始化快照计数器
  roomSnapshotCounts.set(roomId, 0);
  
  // 启动快照定时器（5分钟后第一次快照）
  startRoomSnapshotTimer(roomId);
  
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
      // 没有其他玩家，删除房间（不再归档）
      // 清除快照定时器
      const timerId = roomSnapshotTimers.get(roomId);
      if (timerId) {
        clearTimeout(timerId);
        roomSnapshotTimers.delete(roomId);
      }
      
      // 清除快照计数器
      roomSnapshotCounts.delete(roomId);
      
      // 删除房间
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
  console.log(`快照规则: 房间创建后第5分钟开始，每5分钟自动保存快照`);
  console.log(`快照命名: 时间戳_序号_房间ID.json`);
  console.log(`快照存储: ./archived_rooms/`);
  console.log(`数据格式: JSON (UTF-8)`);
  if (ADMIN_PASSWORD) {
    console.log(`管理员密码: 已配置（使用环境变量 ADMIN_PASSWORD）`);
  } else {
    console.log(`⚠️  警告: 未配置管理员密码，管理功能将无法使用`);
    console.log(`请在 .env 文件中设置 ADMIN_PASSWORD=你的密码`);
  }
  console.log('='.repeat(60));
});