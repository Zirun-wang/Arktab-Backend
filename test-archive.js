/**
 * 测试房间归档功能
 * 
 * 用法：
 * 1. 启动服务器：node server.js
 * 2. 在另一个终端运行：node test-archive.js
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

// 测试用例
async function runTests() {
  console.log('='.repeat(60));
  console.log('开始测试房间归档功能');
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

    // 步骤4: 更新玩家状态
    console.log('\n[步骤4] 更新玩家状态...');
    await request('POST', `/api/rooms/${roomId}/update`, {
      player_id: 'p2',
      static: {
        strategy: '文火慢炖'
      },
      dynamic: {
        money: 25,
        leak_count: 0
      }
    });
    console.log('✓ 玩家状态已更新');

    // 步骤5: 获取房间信息
    console.log('\n[步骤5] 获取房间信息...');
    const getResponse = await request('GET', `/api/rooms/${roomId}`);
    console.log('房间信息:', JSON.stringify(getResponse.data, null, 2));

    // 步骤6: 手动设置房间过期时间（用于测试）
    console.log('\n[步骤6] 设置房间为即将过期状态...');
    console.log('⚠️  注意：房间将在30分钟后自动过期并归档');
    console.log('⚠️  要立即测试归档功能，请手动修改 server.js 中的 ROOM_EXPIRY_TIME');
    console.log('⚠️  或者等待30分钟后观察 archived_rooms 目录');

    console.log('\n' + '='.repeat(60));
    console.log('测试完成！');
    console.log('='.repeat(60));
    console.log('\n预期行为：');
    console.log('1. 房间将在30分钟后自动过期');
    console.log('2. 过期前会自动归档到 ./archived_rooms/ 目录');
    console.log('3. 归档文件名格式：时间戳_房间ID_房主名.json');
    console.log('4. 归档文件包含完整的房间和玩家数据');
    console.log('\n观察归档目录：');
    console.log('$ ls -la archived_rooms/');
    console.log('\n查看归档内容：');
    console.log('$ cat archived_rooms/*.json');

  } catch (error) {
    console.error('\n❌ 测试失败:', error.message);
    console.error(error);
    process.exit(1);
  }
}

// 快速测试：创建一个会立即过期的房间
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
    console.log(`1. 修改 server.js 中的 ROOM_EXPIRY_TIME 为较小的值（如 10秒）`);
    console.log(`2. 重启服务器`);
    console.log(`3. 等待房间过期`);
    console.log(`4. 检查 archived_rooms/ 目录`);
    console.log(`5. 记得改回 ROOM_EXPIRY_TIME = 30 * 60 * 1000`);
  }
}

// 根据命令行参数选择测试模式
const args = process.argv.slice(2);
if (args.includes('--quick')) {
  quickTest();
} else {
  runTests();
}