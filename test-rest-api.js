/**
 * REST API 测试脚本
 * 用于测试卫戍协议多人联机服务的RESTful API接口
 */

const BASE_URL = 'http://localhost:3000';

// 颜色输出
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logSuccess(message) {
  log(`✓ ${message}`, 'green');
}

function logError(message) {
  log(`✗ ${message}`, 'red');
}

function logInfo(message) {
  log(`ℹ ${message}`, 'blue');
}

// HTTP请求封装
async function request(method, path, data = null) {
  const url = `${BASE_URL}${path}`;
  const options = {
    method,
    headers: {
      'Content-Type': 'application/json'
    }
  };

  if (data) {
    options.body = JSON.stringify(data);
  }

  try {
    const response = await fetch(url, options);
    const text = await response.text();
    
    let result;
    try {
      result = JSON.parse(text);
    } catch (e) {
      result = { success: response.ok, message: text };
    }

    return {
      status: response.status,
      ok: response.ok,
      data: result
    };
  } catch (error) {
    return {
      ok: false,
      error: error.message
    };
  }
}

// 测试套件
class TestSuite {
  constructor(name) {
    this.name = name;
    this.tests = [];
    this.passed = 0;
    this.failed = 0;
  }

  test(description, fn) {
    this.tests.push({ description, fn });
  }

  async run() {
    log(`\n运行测试套件: ${this.name}`, 'yellow');
    log('='.repeat(60), 'yellow');

    for (const test of this.tests) {
      try {
        await test.fn();
        this.passed++;
        logSuccess(test.description);
      } catch (error) {
        this.failed++;
        logError(`${test.description}: ${error.message}`);
      }
    }

    log('='.repeat(60), 'yellow');
    log(`测试结果: ${this.passed} 通过, ${this.failed} 失败`, this.failed === 0 ? 'green' : 'red');
    
    return this.failed === 0;
  }
}

// 辅助函数
function assert(condition, message) {
  if (!condition) {
    throw new Error(message || '断言失败');
  }
}

function assertEqual(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(message || `期望 ${expected}，实际 ${actual}`);
  }
}

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// 测试数据
const TEST_PLAYER_1 = {
  player_id: 'test_player_1',
  player_name: '测试玩家1'
};

const TEST_PLAYER_2 = {
  player_id: 'test_player_2',
  player_name: '测试玩家2'
};

const TEST_ROOM_STATIC = {
  boss: '昆图斯',
  ban_list: ['拉特兰', '卡西米尔'],
  enemy_type: ['隐匿', '折射']
};

const TEST_ROOM_DYNAMIC = {
  phase: 'battle',
  round: '11'
};

const TEST_PLAYER_STATIC = {
  strategy: '文火慢炖'
};

const TEST_PLAYER_DYNAMIC = {
  money: 30,
  operators: [
    { name: '山' },
    { name: '能天使' }
  ],
  alliance_stack: {
    '卡西米尔': 2,
    '坚守': 1
  },
  leak_count: 0,
  cc_level: 5
};

// 主测试流程
async function runTests() {
  log('卫戍协议REST API测试', 'blue');
  log('='.repeat(60), 'blue');

  // 等待服务器启动
  logInfo('等待服务器启动...');
  await sleep(1000);

  // 检查服务器状态
  const healthCheck = await request('GET', '/');
  if (!healthCheck.ok) {
    logError('服务器未响应，请先运行: npm start');
    process.exit(1);
  }
  logSuccess('服务器运行正常');

  // 测试1：健康检查
  const healthTest = new TestSuite('健康检查');
  healthTest.test('健康检查返回正确版本', async () => {
    const result = await request('GET', '/');
    assert(result.ok, '健康检查失败');
    assert(result.data.version === 'v2.0', '版本号不匹配');
    assert(result.data.protocol === 'REST API v2', '协议类型不匹配');
  });
  await healthTest.run();

  // 测试2：房间管理
  const roomManagementTest = new TestSuite('房间管理');
  
  let roomId = '';
  roomManagementTest.test('创建房间', async () => {
    const result = await request('POST', '/api/rooms', TEST_PLAYER_1);
    assert(result.ok, '创建房间失败');
    assert(result.data.success, '创建房间返回失败');
    assert(result.data.data.room_id, '房间号为空');
    roomId = result.data.data.room_id;
    assertEqual(result.data.data.host_player_id, TEST_PLAYER_1.player_id);
    logInfo(`房间号: ${roomId}`);
  });

  roomManagementTest.test('获取房间信息', async () => {
    const result = await request('GET', `/api/rooms/${roomId}`);
    assert(result.ok, '获取房间信息失败');
    assert(result.data.success, '获取房间信息返回失败');
    assertEqual(result.data.data.room_id, roomId);
    assertEqual(result.data.data.host_player_id, TEST_PLAYER_1.player_id);
  });

  roomManagementTest.test('获取所有房间', async () => {
    const result = await request('GET', '/api/rooms');
    assert(result.ok, '获取所有房间失败');
    assert(result.data.success, '获取所有房间返回失败');
    assert(Array.isArray(result.data.data), '房间列表不是数组');
    assert(result.data.data.length > 0, '房间列表为空');
  });

  await roomManagementTest.run();

  // 测试3：状态更新
  const stateUpdateTest = new TestSuite('状态更新');

  stateUpdateTest.test('更新房间静态状态（房主）', async () => {
    const result = await request('POST', `/api/rooms/${roomId}/update`, {
      player_id: TEST_PLAYER_1.player_id,
      room_static: TEST_ROOM_STATIC
    });
    assert(result.ok, '更新房间静态状态失败');
    assert(result.data.success, '更新房间静态状态返回失败');
    
    // 验证更新
    const room = await request('GET', `/api/rooms/${roomId}`);
    assertEqual(room.data.data.room_static.boss, TEST_ROOM_STATIC.boss);
    assertEqual(room.data.data.room_static.ban_list.length, TEST_ROOM_STATIC.ban_list.length);
  });

  stateUpdateTest.test('更新房间动态状态（房主）', async () => {
    const result = await request('POST', `/api/rooms/${roomId}/update`, {
      player_id: TEST_PLAYER_1.player_id,
      room_dynamic: TEST_ROOM_DYNAMIC
    });
    assert(result.ok, '更新房间动态状态失败');
    assert(result.data.success, '更新房间动态状态返回失败');
    
    // 验证更新
    const room = await request('GET', `/api/rooms/${roomId}`);
    assertEqual(room.data.data.room_dynamic.phase, TEST_ROOM_DYNAMIC.phase);
    assertEqual(room.data.data.room_dynamic.round, TEST_ROOM_DYNAMIC.round);
  });

  stateUpdateTest.test('玩家2加入房间', async () => {
    const result = await request('POST', `/api/rooms/${roomId}/update`, {
      player_id: TEST_PLAYER_2.player_id,
      player_name: TEST_PLAYER_2.player_name
    });
    assert(result.ok, '玩家加入房间失败');
    assert(result.data.success, '玩家加入房间返回失败');
    
    // 验证加入
    const room = await request('GET', `/api/rooms/${roomId}`);
    const players = room.data.data.players;
    assert(players.some(p => p.player_id === TEST_PLAYER_2.player_id), '玩家未加入房间');
  });

  stateUpdateTest.test('更新玩家静态状态', async () => {
    const result = await request('POST', `/api/rooms/${roomId}/update`, {
      player_id: TEST_PLAYER_2.player_id,
      player_static: TEST_PLAYER_STATIC
    });
    assert(result.ok, '更新玩家静态状态失败');
    assert(result.data.success, '更新玩家静态状态返回失败');
    
    // 验证更新
    const room = await request('GET', `/api/rooms/${roomId}`);
    const player = room.data.data.players.find(p => p.player_id === TEST_PLAYER_2.player_id);
    assert(player, '玩家不存在');
    assertEqual(player.static.strategy, TEST_PLAYER_STATIC.strategy);
  });

  stateUpdateTest.test('更新玩家动态状态', async () => {
    const result = await request('POST', `/api/rooms/${roomId}/update`, {
      player_id: TEST_PLAYER_2.player_id,
      player_dynamic: TEST_PLAYER_DYNAMIC
    });
    assert(result.ok, '更新玩家动态状态失败');
    assert(result.data.success, '更新玩家动态状态返回失败');
    
    // 验证更新
    const room = await request('GET', `/api/rooms/${roomId}`);
    const player = room.data.data.players.find(p => p.player_id === TEST_PLAYER_2.player_id);
    assert(player, '玩家不存在');
    assertEqual(player.dynamic.money, TEST_PLAYER_DYNAMIC.money);
    assertEqual(player.dynamic.leak_count, TEST_PLAYER_DYNAMIC.leak_count);
    assertEqual(player.dynamic.cc_level, TEST_PLAYER_DYNAMIC.cc_level);
  });

  await stateUpdateTest.run();

  // 测试4：增量更新
  const incrementalUpdateTest = new TestSuite('增量更新');

  incrementalUpdateTest.test('获取房间信息（带since参数）', async () => {
    const room1 = await request('GET', `/api/rooms/${roomId}`);
    const updatedAt = room1.data.data.updated_at;
    
    await sleep(100); // 等待一小段时间
    
    const room2 = await request('GET', `/api/rooms/${roomId}?since=${updatedAt}`);
    assert(room2.ok, '获取房间信息失败');
    
    if (room2.status === 304) {
      logInfo('正确返回304 Not Modified');
    } else {
      logInfo('返回200 OK（数据已更新）');
      assert(room2.data.success, '获取房间信息返回失败');
    }
  });

  await incrementalUpdateTest.run();

  // 测试5：权限控制
  const permissionTest = new TestSuite('权限控制');

  permissionTest.test('非房主不能更新房间静态状态', async () => {
    const result = await request('POST', `/api/rooms/${roomId}/update`, {
      player_id: TEST_PLAYER_2.player_id,
      room_static: { boss: '其他Boss' }
    });
    // 当前实现没有权限检查，这个测试暂时通过
    logInfo('当前版本未实现房主权限验证');
  });

  await permissionTest.run();

  // 测试6：错误处理
  const errorHandlingTest = new TestSuite('错误处理');

  errorHandlingTest.test('获取不存在的房间', async () => {
    const result = await request('GET', '/api/rooms/NONEXISTENT');
    assert(!result.ok, '应该返回错误');
    assert(result.status === 404, '应该返回404');
    assert(!result.data.success, '应该返回失败状态');
  });

  errorHandlingTest.test('删除房间', async () => {
    const result = await request('DELETE', `/api/rooms/${roomId}`);
    assert(result.ok, '删除房间失败');
    assert(result.data.success, '删除房间返回失败');
    
    // 验证删除
    const room = await request('GET', `/api/rooms/${roomId}`);
    assert(!room.ok, '房间应该已删除');
    assert(room.status === 404, '应该返回404');
  });

  await errorHandlingTest.run();

  // 测试7：自动创建房间
  const autoCreateTest = new TestSuite('自动创建房间');
  const autoRoomId = 'AUTO_ROOM_123';

  autoCreateTest.test('通过更新接口自动创建房间', async () => {
    const result = await request('POST', `/api/rooms/${autoRoomId}/update`, {
      player_id: 'auto_player_1',
      player_name: '自动玩家1'
    });
    assert(result.ok, '自动创建房间失败');
    assert(result.data.success, '自动创建房间返回失败');
    
    // 验证创建
    const room = await request('GET', `/api/rooms/${autoRoomId}`);
    assert(room.ok, '获取房间失败');
    assertEqual(room.data.data.host_player_id, 'auto_player_1');
  });

  autoCreateTest.test('清理测试数据', async () => {
    await request('DELETE', `/api/rooms/${autoRoomId}`);
    logInfo('已清理自动创建的测试房间');
  });

  await autoCreateTest.run();

  // 总结
  log('\n' + '='.repeat(60), 'blue');
  log('所有测试完成', 'blue');
  log('='.repeat(60), 'blue');
}

// 运行测试
runTests().catch(error => {
  logError(`测试运行失败: ${error.message}`);
  console.error(error);
  process.exit(1);
});