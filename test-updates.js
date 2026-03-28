const http = require('http');

const BASE_URL = 'http://localhost:3000';

// Helper function to make HTTP requests
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
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(body);
          resolve({ status: res.statusCode, data: json });
        } catch (e) {
          resolve({ status: res.statusCode, data: body });
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

async function runTests() {
  console.log('=== Testing Updated Server API ===\n');

  // Test 1: Create room (only player_name, no player_id)
  console.log('Test 1: Create room with only player_name');
  const createRes = await request('POST', '/api/rooms', { player_name: 'Player1' });
  console.log('Status:', createRes.status);
  console.log('Response:', JSON.stringify(createRes.data, null, 2));
  const roomId = createRes.data.data.room_id;
  const player1Id = createRes.data.data.player_id;
  console.log('✓ Room created:', roomId, 'Player1 ID:', player1Id);
  console.log('Expected player_id: p1, Actual:', player1Id, player1Id === 'p1' ? '✓ PASS' : '✗ FAIL');
  console.log();

  // Test 2: Get room info (should include room_settings)
  console.log('Test 2: Get room info');
  const getRes = await request('GET', `/api/rooms/${roomId}`);
  console.log('Status:', getRes.status);
  console.log('Has room_settings:', !!getRes.data.data.room_settings);
  console.log('Room settings:', JSON.stringify(getRes.data.data.room_settings, null, 2));
  console.log(getRes.data.data.room_settings ? '✓ PASS' : '✗ FAIL');
  console.log();

  // Test 3: Join room (should assign p2)
  console.log('Test 3: Join room');
  const joinRes = await request('POST', `/api/rooms/${roomId}/join`, { player_name: 'Player2' });
  console.log('Status:', joinRes.status);
  console.log('Response:', JSON.stringify(joinRes.data, null, 2));
  const player2Id = joinRes.data.data.player_id;
  console.log('Expected player_id: p2, Actual:', player2Id, player2Id === 'p2' ? '✓ PASS' : '✗ FAIL');
  console.log();

  // Test 4: Update room with non-existent player (should fail)
  console.log('Test 4: Try to update with non-existent player_id');
  const updateFailRes = await request('POST', `/api/rooms/${roomId}/update`, {
    player_id: 'p3',
    player_dynamic: { money: 100 }
  });
  console.log('Status:', updateFailRes.status);
  console.log('Expected: 400, Actual:', updateFailRes.status, updateFailRes.status === 400 ? '✓ PASS' : '✗ FAIL');
  console.log();

  // Test 5: Update with correct player_id
  console.log('Test 5: Update with correct player_id (p1)');
  const updateRes = await request('POST', `/api/rooms/${roomId}/update`, {
    player_id: player1Id,
    room_static: { boss: '卢西恩' },
    player_dynamic: { money: 50, operators: [{ name: '能天使', elite: true, pos: 'field' }] }
  });
  console.log('Status:', updateRes.status);
  console.log('Response:', JSON.stringify(updateRes.data, null, 2));
  console.log(updateRes.status === 200 ? '✓ PASS' : '✗ FAIL');
  console.log();

  // Test 6: Update room settings (only host can do this)
  console.log('Test 6: Update room settings as host');
  const settingsRes = await request('POST', `/api/rooms/${roomId}/update`, {
    player_id: player1Id,
    room_settings: {
      max_players: 4,
      enable_battle_progress_detection: true,
      enable_leak_count_detection: true,
      host_display_text: 'ARK-12345'
    }
  });
  console.log('Status:', settingsRes.status);
  console.log('Response:', JSON.stringify(settingsRes.data, null, 2));
  console.log(settingsRes.status === 200 ? '✓ PASS' : '✗ FAIL');
  console.log();

  // Test 7: Try to update room settings as non-host (should fail)
  console.log('Test 7: Try to update room settings as non-host');
  const settingsFailRes = await request('POST', `/api/rooms/${roomId}/update`, {
    player_id: player2Id,
    room_settings: { max_players: 3 }
  });
  console.log('Status:', settingsFailRes.status);
  console.log('Expected: 403, Actual:', settingsFailRes.status, settingsFailRes.status === 403 ? '✓ PASS' : '✗ FAIL');
  console.log();

  // Test 8: Try to update room with wrong room ID (should fail)
  console.log('Test 8: Try to update non-existent room');
  const wrongRoomRes = await request('POST', `/api/rooms/WRONGID/update`, {
    player_id: player1Id,
    player_dynamic: { money: 60 }
  });
  console.log('Status:', wrongRoomRes.status);
  console.log('Expected: 404, Actual:', wrongRoomRes.status, wrongRoomRes.status === 404 ? '✓ PASS' : '✗ FAIL');
  console.log();

  // Test 9: Get updated room info
  console.log('Test 9: Get updated room info');
  const getUpdatedRes = await request('GET', `/api/rooms/${roomId}`);
  console.log('Status:', getUpdatedRes.status);
  console.log('Room settings:', JSON.stringify(getUpdatedRes.data.data.room_settings, null, 2));
  console.log('Players:', JSON.stringify(getUpdatedRes.data.data.players, null, 2));
  console.log(getUpdatedRes.status === 200 ? '✓ PASS' : '✗ FAIL');
  console.log();

  // Test 10: Join third player
  console.log('Test 10: Join third player');
  const join3Res = await request('POST', `/api/rooms/${roomId}/join`, { player_name: 'Player3' });
  console.log('Status:', join3Res.status);
  console.log('Response:', JSON.stringify(join3Res.data, null, 2));
  const player3Id = join3Res.data.data.player_id;
  console.log('Expected player_id: p3, Actual:', player3Id, player3Id === 'p3' ? '✓ PASS' : '✗ FAIL');
  console.log();

  // Test 11: Join fourth player
  console.log('Test 11: Join fourth player');
  const join4Res = await request('POST', `/api/rooms/${roomId}/join`, { player_name: 'Player4' });
  console.log('Status:', join4Res.status);
  console.log('Response:', JSON.stringify(join4Res.data, null, 2));
  const player4Id = join4Res.data.data.player_id;
  console.log('Expected player_id: p4, Actual:', player4Id, player4Id === 'p4' ? '✓ PASS' : '✗ FAIL');
  console.log();

  // Test 12: Try to join when room is full (should fail)
  console.log('Test 12: Try to join when room is full');
  const joinFullRes = await request('POST', `/api/rooms/${roomId}/join`, { player_name: 'Player5' });
  console.log('Status:', joinFullRes.status);
  console.log('Expected: 400, Actual:', joinFullRes.status, joinFullRes.status === 400 ? '✓ PASS' : '✗ FAIL');
  console.log();

  // Test 13: Get all rooms (debug)
  console.log('Test 13: Get all rooms');
  const getAllRes = await request('GET', '/api/rooms');
  console.log('Status:', getAllRes.status);
  console.log('Room count:', getAllRes.data.data.length);
  console.log(getAllRes.status === 200 ? '✓ PASS' : '✗ FAIL');
  console.log();

  // Cleanup
  console.log('Cleanup: Delete test room');
  const deleteRes = await request('DELETE', `/api/rooms/${roomId}`);
  console.log('Status:', deleteRes.status);
  console.log();

  console.log('=== All Tests Completed ===');
}

runTests().catch(console.error);