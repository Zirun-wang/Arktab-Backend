/**
 * 测试退出房间功能
 */

const BASE_URL = 'http://localhost:3000';

// 辅助函数：发送HTTP请求
async function request(method, url, data = null) {
  const options = {
    method,
    headers: {
      'Content-Type': 'application/json'
    }
  };
  
  if (data) {
    options.body = JSON.stringify(data);
  }
  
  const response = await fetch(BASE_URL + url, options);
  const text = await response.text();
  
  try {
    return {
      status: response.status,
      data: JSON.parse(text)
    };
  } catch {
    return {
      status: response.status,
      data: null
    };
  }
}

// 测试函数
async function testLeaveRoom() {
  console.log('=== 测试退出房间功能 ===\n');
  
  let roomId = null;
  
  try {
    // 测试1：创建房间
    console.log('测试1：创建房间');
    const createResult = await request('POST', '/api/rooms', { player_name: 'TestHost' });
    console.log(`Status: ${createResult.status}`);
    console.log('Response:', JSON.stringify(createResult.data, null, 2));
    
    if (createResult.status === 200 && createResult.data.success) {
      roomId = createResult.data.data.room_id;
      console.log(`✓ 房间创建成功: ${roomId}\n`);
    } else {
      console.log('✗ 创建房间失败\n');
      return;
    }
    
    // 测试2：加入3个玩家
    console.log('测试2：加入3个玩家');
    for (let i = 2; i <= 4; i++) {
      const joinResult = await request('POST', `/api/rooms/${roomId}/join`, { 
        player_name: `Player${i}` 
      });
      console.log(`Player${i} 加入 - Status: ${joinResult.status}, player_id: ${joinResult.data.data.player_id}`);
    }
    console.log('✓ 所有玩家加入成功\n');
    
    // 测试3：尝试退出不存在的房间
    console.log('测试3：尝试退出不存在的房间');
    const leaveInvalidRoom = await request('POST', '/api/rooms/INVALID123/leave', { player_id: 'p1' });
    console.log(`Status: ${leaveInvalidRoom.status}`);
    console.log(`Expected: 404, Actual: ${leaveInvalidRoom.status} ${leaveInvalidRoom.status === 404 ? '✓ PASS' : '✗ FAIL'}\n`);
    
    // 测试4：尝试用不存在的player_id退出
    console.log('测试4：尝试用不存在的player_id退出');
    const leaveInvalidPlayer = await request('POST', `/api/rooms/${roomId}/leave`, { player_id: 'p5' });
    console.log(`Status: ${leaveInvalidPlayer.status}`);
    console.log(`Expected: 400, Actual: ${leaveInvalidPlayer.status} ${leaveInvalidPlayer.status === 400 ? '✓ PASS' : '✗ FAIL'}\n`);
    
    // 测试5：普通玩家退出
    console.log('测试5：普通玩家(p2)退出');
    const leavePlayer2 = await request('POST', `/api/rooms/${roomId}/leave`, { player_id: 'p2' });
    console.log(`Status: ${leavePlayer2.status}`);
    console.log('Response:', JSON.stringify(leavePlayer2.data, null, 2));
    console.log(`Expected: 200, Actual: ${leavePlayer2.status} ${leavePlayer2.status === 200 ? '✓ PASS' : '✗ FAIL'}`);
    console.log(`剩余玩家数: ${leavePlayer2.data.data.player_count} (Expected: 3)\n`);
    
    // 测试6：验证p2已退出
    console.log('测试6：验证p2已退出');
    const roomInfo = await request('GET', `/api/rooms/${roomId}`);
    const playerIds = roomInfo.data.data.players.map(p => p.player_id);
    const p2Exists = playerIds.includes('p2');
    console.log(`p2 是否仍在房间: ${p2Exists} (Expected: false) ${!p2Exists ? '✓ PASS' : '✗ FAIL'}\n`);
    
    // 测试7：另一个普通玩家退出
    console.log('测试7：普通玩家(p3)退出');
    const leavePlayer3 = await request('POST', `/api/rooms/${roomId}/leave`, { player_id: 'p3' });
    console.log(`Status: ${leavePlayer3.status}`);
    console.log(`剩余玩家数: ${leavePlayer3.data.data.player_count} (Expected: 2) ${leavePlayer3.data.data.player_count === 2 ? '✓ PASS' : '✗ FAIL'}\n`);
    
    // 测试8：房主退出（应该转移到下一个玩家）
    console.log('测试8：房主(p1)退出，房主应该转移到p4（因为p2和p3已退出）');
    const leaveHost = await request('POST', `/api/rooms/${roomId}/leave`, { player_id: 'p1' });
    console.log(`Status: ${leaveHost.status}`);
    console.log('Response:', JSON.stringify(leaveHost.data, null, 2));
    console.log(`Expected: 200, Actual: ${leaveHost.status} ${leaveHost.status === 200 ? '✓ PASS' : '✗ FAIL'}`);
    console.log(`房主是否转移: ${leaveHost.data.data.host_transferred} (Expected: true) ${leaveHost.data.data.host_transferred ? '✓ PASS' : '✗ FAIL'}`);
    console.log(`新房主ID: ${leaveHost.data.data.new_host_id} (Expected: p4) ${leaveHost.data.data.new_host_id === 'p4' ? '✓ PASS' : '✗ FAIL'}\n`);
    
    // 测试9：验证房主已转移
    console.log('测试9：验证房主已转移到p4');
    const roomAfterTransfer = await request('GET', `/api/rooms/${roomId}`);
    const newHostId = roomAfterTransfer.data.data.host_player_id;
    console.log(`新房主ID: ${newHostId} (Expected: p4) ${newHostId === 'p4' ? '✓ PASS' : '✗ FAIL'}`);
    const p4IsHost = roomAfterTransfer.data.data.players.find(p => p.player_id === 'p4').is_host;
    console.log(`p4是否为房主: ${p4IsHost} (Expected: true) ${p4IsHost ? '✓ PASS' : '✗ FAIL'}\n`);
    
    // 测试10：验证新房主可以更新房间设置
    console.log('测试10：验证新房主(p4)可以更新房间设置');
    const updateByNewHost = await request('POST', `/api/rooms/${roomId}/update`, {
      player_id: 'p4',
      room_settings: {
        max_players: 4,
        enable_battle_progress_detection: true,
        enable_leak_count_detection: true,
        host_display_text: 'UPDATED'
      }
    });
    console.log(`Status: ${updateByNewHost.status}`);
    console.log(`Expected: 200, Actual: ${updateByNewHost.status} ${updateByNewHost.status === 200 ? '✓ PASS' : '✗ FAIL'}\n`);
    
    // 测试11：新房主退出（因为只剩p4，所以房间应该被删除）
    console.log('测试11：新房主(p4)退出，房间应该被删除（因为已无其他玩家）');
    const leaveNewHost = await request('POST', `/api/rooms/${roomId}/leave`, { player_id: 'p4' });
    console.log(`Status: ${leaveNewHost.status}`);
    console.log(`房间是否被删除: ${leaveNewHost.data.data.room_deleted} (Expected: true) ${leaveNewHost.data.data.room_deleted ? '✓ PASS' : '✗ FAIL'}\n`);
    
    // 测试12：验证房间已被删除
    console.log('测试12：验证房间已被删除');
    const roomAfterDelete = await request('GET', `/api/rooms/${roomId}`);
    console.log(`Status: ${roomAfterDelete.status}`);
    console.log(`Expected: 404, Actual: ${roomAfterDelete.status} ${roomAfterDelete.status === 404 ? '✓ PASS' : '✗ FAIL'}\n`);
    
    console.log('=== 所有测试完成 ===');
    
  } catch (error) {
    console.error('测试过程中出错:', error);
  } finally {
    // 清理：如果房间还存在，删除它
    if (roomId) {
      try {
        const checkRoom = await request('GET', `/api/rooms/${roomId}`);
        if (checkRoom.status === 200) {
          await request('DELETE', `/api/rooms/${roomId}`);
          console.log('Cleanup: 房间已删除');
        }
      } catch (e) {
        // 忽略清理错误
      }
    }
  }
}

// 运行测试
testLeaveRoom();