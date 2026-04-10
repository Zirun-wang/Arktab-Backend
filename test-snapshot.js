/**
 * 测试房间快照功能
 * 
 * 用法：
 * 1. 启动服务器：node server.js
 * 2. 在另一个终端运行：node test-snapshot.js
 */

const http = require('http');

const BASE_URL = 'http://localhost:3000';

// 辅助函数：发送HTTP请求
function request(method, path, data = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);
    const options = {
      method: method,
      headers: {
        'Content-Type': 'application/json'
      }
    };

    const req = http.request(url, options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          resolve({
            status: res.statusCode,
            data: body ? JSON.parse(body) : null
          });
        } catch (e) {
          resolve({
            status: res.statusCode,
            data: body
          });
        }
      });
    });

    req.on('error', reject);

    if (data) {
      req.write(JSON.stringify(data));
    }

    req.end();
  });
}

// 测试快照功能
async function testSnapshot() {
  console.log('='.repeat(60));
  console.log('开始测试房间快照功能');
  console.log('='.repeat(60));

  try {
    // 步骤1: 创建房间
    console.log('\n[步骤1] 创建房间...');
    const createResponse = await request('POST', '/api/rooms', {
      player_name: '测试房主'
    });
    console.log('响应:', JSON.stringify(createResponse.data, null, 2));
    
    if (!createResponse.data.success) {
      throw new Error('创建房间失败');
    }

    const roomId = createResponse.data.data.room_id;
    const hostPlayerId = createResponse.data.data.player_id;
    console.log(`✓ 房间创建成功，房间ID: ${roomId}`);

    // 步骤2: 加入其他玩家
    console.log('\n[步骤2] 加入其他玩家...');
    for (let i = 2; i <= 3; i++) {
      const joinResponse = await request('POST', `/api/rooms/${roomId}/join`, {
        player_name: `玩家${i}`
      });
      console.log(`玩家${i} 加入:`, joinResponse.data.data.player_id);
    }

    // 步骤3: 更新房间状态
    console.log('\n[步骤3] 更新房间状态...');
    await request('POST', `/api/rooms/${roomId}/update`, {
      player_id: hostPlayerId,
      static: {
        boss: '昆图斯',
        ban_list: ['拉特兰', '卡西米尔'],
        enemy_type: ['隐匿', '折射']
      },
      dynamic: {
        phase: 'battle',
        round: '11'
      }
    });
    console.log('✓ 房间状态已更新');

    // 步骤4: 获取房间信息
    console.log('\n[步骤4] 获取房间信息...');
    const getResponse = await request('GET', `/api/rooms/${roomId}`);
    console.log('房间信息:', JSON.stringify(getResponse.data, null, 2));

    // 步骤5: 等待快照
    console.log('\n[步骤5] 快照说明...');
    console.log('⚠️  房间已创建，快照定时器已启动');
    console.log('⚠️  5分钟后将保存第1次快照');
    console.log('⚠️  之后每5分钟保存一次快照');
    console.log('⚠️  快照文件命名: 时间戳_序号_房间ID.json');
    console.log('⚠️  快照存储位置: ./archived_rooms/');
    
    console.log('\n' + '='.repeat(60));
    console.log('测试完成！');
    console.log('='.repeat(60));
    console.log('\n预期行为：');
    console.log('1. 房间创建时启动快照定时器');
    console.log('2. 5分钟后保存第1次快照');
    console.log('3. 之后每5分钟保存一次快照');
    console.log('4. 房间解散或超时时不归档');
    console.log('\n观察快照目录：');
    console.log('$ ls -la archived_rooms/');
    console.log('\n查看快照内容：');
    console.log('$ cat archived_rooms/*.json');

  } catch (error) {
    console.error('\n❌ 测试失败:', error.message);
    console.error(error);
    process.exit(1);
  }
}

// 快速测试：创建一个测试房间
async function quickTest() {
  console.log('='.repeat(60));
  console.log('快速测试：创建测试房间');
  console.log('='.repeat(60));

  const createResponse = await request('POST', '/api/rooms', {
    player_name: '快速测试房主'
  });

  if (createResponse.data.success) {
    const roomId = createResponse.data.data.room_id;
    console.log(`✓ 测试房间已创建: ${roomId}`);
    console.log(`\n提示：`);
    console.log(`1. 5分钟后将自动保存第1次快照`);
    console.log(`2. 之后每5分钟保存一次快照`);
    console.log(`3. 观察服务器日志确认快照保存`);
    console.log(`4. 检查 archived_rooms/ 目录`);
  }
}

// 根据命令行参数选择测试模式
const args = process.argv.slice(2);
if (args.includes('--quick')) {
  quickTest();
} else {
  testSnapshot();
}