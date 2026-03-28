#!/bin/bash

# 部署脚本 - 使用SCP上传项目到服务器并启动
# 使用方法: ./deploy.sh <服务器IP> <服务器用户名> <pem文件路径> [服务器项目路径]

set -e

# 颜色输出
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# 参数检查
if [ $# -lt 3 ]; then
    echo -e "${RED}错误: 参数不足${NC}"
    echo "使用方法: $0 <服务器IP> <服务器用户名> <pem文件路径> [服务器项目路径]"
    echo "示例: $0 123.45.67.89 ubuntu /path/to/server.pem /home/ubuntu/arktab"
    exit 1
fi

SERVER_IP=$1
SERVER_USER=$2
PEM_FILE=$3
REMOTE_PATH=${4:-/home/$SERVER_USER/arktab}

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}开始部署到服务器${NC}"
echo -e "${GREEN}========================================${NC}"
echo "服务器IP: $SERVER_IP"
echo "用户名: $SERVER_USER"
echo "PEM文件: $PEM_FILE"
echo "远程路径: $REMOTE_PATH"
echo ""

# 检查PEM文件是否存在
if [ ! -f "$PEM_FILE" ]; then
    echo -e "${RED}错误: PEM文件不存在: $PEM_FILE${NC}"
    exit 1
fi

# 设置PEM文件权限（确保只有所有者可读）
chmod 400 "$PEM_FILE"

# SSH配置
SSH="ssh -i $PEM_FILE -o StrictHostKeyChecking=no -o ConnectTimeout=10"
SCP="scp -i $PEM_FILE -o StrictHostKeyChecking=no"

# 测试连接
echo -e "${YELLOW}测试服务器连接...${NC}"
if $SSH $SERVER_USER@$SERVER_IP "echo '连接成功'" > /dev/null 2>&1; then
    echo -e "${GREEN}✓ 服务器连接成功${NC}"
else
    echo -e "${RED}✗ 服务器连接失败${NC}"
    echo "请检查："
    echo "  1. 服务器IP是否正确"
    echo "  2. PEM文件路径是否正确"
    echo "  3. PEM文件权限是否正确"
    echo "  4. 服务器安全组是否开放SSH端口(22)"
    exit 1
fi

# 创建远程目录
echo -e "${YELLOW}创建远程目录...${NC}"
$SSH $SERVER_USER@$SERVER_IP "mkdir -p $REMOTE_PATH"

# 备份现有代码（如果存在）
echo -e "${YELLOW}备份现有代码...${NC}"
$SSH $SERVER_USER@$SERVER_IP "cd $REMOTE_PATH/.. && if [ -d $REMOTE_PATH ]; then cp -r $REMOTE_PATH ${REMOTE_PATH}_backup_\$(date +%Y%m%d_%H%M%S) && echo '备份完成' || echo '首次部署，无需备份'; fi"

# 上传文件（排除node_modules和其他不需要的文件）
echo -e "${YELLOW}上传项目文件...${NC}"
echo "正在上传以下文件/目录:"
echo "  - package.json"
echo "  - server.js"
echo "  - public/"
echo "  - *.md (文档文件)"

$SCP package.json $SERVER_USER@$SERVER_IP:$REMOTE_PATH/
$SCP server.js $SERVER_USER@$SERVER_IP:$REMOTE_PATH/
$SCP -r public $SERVER_USER@$SERVER_IP:$REMOTE_PATH/

# 上传文档文件（可选）
for md_file in *.md; do
    if [ -f "$md_file" ]; then
        $SCP "$md_file" $SERVER_USER@$SERVER_IP:$REMOTE_PATH/
    fi
done

echo -e "${GREEN}✓ 文件上传完成${NC}"

# 在服务器上安装依赖
echo -e "${YELLOW}安装Node.js依赖...${NC}"
$SSH $SERVER_USER@$SERVER_IP "cd $REMOTE_PATH && npm install --production"
echo -e "${GREEN}✓ 依赖安装完成${NC}"

# 停止旧进程（如果有）
echo -e "${YELLOW}停止旧进程...${NC}"
$SSH $SERVER_USER@$SERVER_IP "cd $REMOTE_PATH && if [ -f .pid ]; then pid=\$(cat .pid); if ps -p \$pid > /dev/null 2>&1; then kill \$pid && echo '已停止旧进程 (PID: \$pid)'; fi; rm -f .pid; fi"

# 启动新进程
echo -e "${YELLOW}启动新进程...${NC}"
$SSH $SERVER_USER@$SERVER_IP "cd $REMOTE_PATH && nohup npm start > server.log 2>&1 & echo \$! > .pid && sleep 2 && if ps -p \$(cat .pid) > /dev/null; then echo '服务启动成功 (PID: '\$(cat .pid)')'; else echo '服务启动失败'; exit 1; fi"

# 检查服务状态
echo -e "${YELLOW}检查服务状态...${NC}"
$SSH $SERVER_USER@$SERVER_IP "cd $REMOTE_PATH && tail -n 20 server.log"

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}部署完成！${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo "服务地址: http://$SERVER_IP:3000"
echo "日志查看: ssh -i $PEM_FILE $SERVER_USER@$SERVER_IP 'tail -f $REMOTE_PATH/server.log'"
echo "停止服务: ssh -i $PEM_FILE $SERVER_USER@$SERVER_IP 'cd $REMOTE_PATH && kill \$(cat .pid)'"
echo ""
echo -e "${YELLOW}注意：请确保服务器安全组已开放3000端口${NC}"