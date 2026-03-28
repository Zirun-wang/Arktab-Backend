# 服务器部署指南

本文档介绍如何将Arktab后端服务部署到服务器上。

## 目录
- [前置条件](#前置条件)
- [快速部署](#快速部署)
- [详细步骤](#详细步骤)
- [服务器配置](#服务器配置)
- [常用命令](#常用命令)
- [故障排查](#故障排查)

---

## 前置条件

### 1. 本地环境
- ✅ 已安装 Git
- ✅ 已安装 Node.js (v14+)
- ✅ 已安装 npm
- ✅ 已安装 SSH 客户端（macOS/Linux 自带，Windows 需安装 Git Bash 或 WSL）

### 2. 服务器环境
- ✅ 已购买服务器（推荐 Ubuntu 20.04/22.04）
- ✅ 已获取服务器IP地址
- ✅ 已获取服务器登录用户名（通常是 `ubuntu`、`ec2-user` 或 `root`）
- ✅ 已获取PEM密钥文件（`.pem` 格式）

### 3. 网络配置
- ✅ 服务器安全组已开放以下端口：
  - `22` - SSH端口
  - `3000` - 应用服务端口
  - `80` / `443` - HTTP/HTTPS端口（如果需要配置Nginx）

---

## 快速部署

### 使用自动部署脚本

项目已提供 `deploy.sh` 自动部署脚本，使用方法：

```bash
# 基本用法
./deploy.sh <服务器IP> <用户名> <pem文件路径> [服务器项目路径]

# 示例（AWS EC2）
./deploy.sh 123.45.67.89 ubuntu /path/to/server.pem

# 示例（指定远程路径）
./deploy.sh 123.45.67.89 ubuntu /path/to/server.pem /home/ubuntu/arktab
```

### 部署脚本功能
✅ 测试服务器连接  
✅ 自动备份现有代码  
✅ 上传项目文件  
✅ 安装Node.js依赖  
✅ 停止旧进程  
✅ 启动新进程  
✅ 检查服务状态  

---

## 详细步骤

### 步骤1: 确认PEM文件权限

PEM文件必须设置正确的权限：

```bash
# 设置PEM文件为只有所有者可读
chmod 400 /path/to/your-server.pem
```

### 步骤2: 测试SSH连接

在部署前，先测试能否连接到服务器：

```bash
# 测试连接
ssh -i /path/to/your-server.pem ubuntu@123.45.67.89

# 如果连接成功，会看到服务器的命令行提示符
# 输入 `exit` 退出
```

### 步骤3: 确认服务器已安装Node.js

```bash
# 登录服务器
ssh -i /path/to/your-server.pem ubuntu@123.45.67.89

# 检查Node.js版本
node --version

# 如果未安装，安装Node.js 18.x
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# 验证安装
node --version
npm --version
```

### 步骤4: 执行部署脚本

```bash
# 在项目根目录执行
./deploy.sh 123.45.67.89 ubuntu /path/to/your-server.pem
```

### 步骤5: 验证部署

```bash
# 访问服务
curl http://123.45.67.89:3000

# 或在浏览器打开
# http://123.45.67.89:3000
```

---

## 服务器配置

### 安装Node.js（如未安装）

```bash
# Ubuntu/Debian系统
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# CentOS/RHEL系统
curl -fsSL https://rpm.nodesource.com/setup_18.x | sudo bash -
sudo yum install -y nodejs
```

### 配置防火墙

```bash
# Ubuntu (UFW)
sudo ufw allow 22/tcp
sudo ufw allow 3000/tcp
sudo ufw enable

# CentOS (firewalld)
sudo firewall-cmd --permanent --add-port=22/tcp
sudo firewall-cmd --permanent --add-port=3000/tcp
sudo firewall-cmd --reload
```

### 配置PM2（生产环境推荐）

PM2 是一个进程管理器，可以保持服务持续运行：

```bash
# 全局安装PM2
npm install -g pm2

# 登录服务器后，使用PM2启动服务
cd /home/ubuntu/arktab
pm2 start server.js --name arktab

# 设置开机自启
pm2 startup
pm2 save

# 查看日志
pm2 logs arktab

# 查看状态
pm2 status

# 重启服务
pm2 restart arktab

# 停止服务
pm2 stop arktab
```

### 使用Nginx反向代理（可选）

如果需要使用域名和HTTPS，可以配置Nginx：

```bash
# 安装Nginx
sudo apt-get update
sudo apt-get install -y nginx

# 创建配置文件
sudo nano /etc/nginx/sites-available/arktab
```

配置内容：

```nginx
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

```bash
# 启用配置
sudo ln -s /etc/nginx/sites-available/arktab /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

---

## 常用命令

### 连接服务器

```bash
# 使用PEM文件连接
ssh -i /path/to/server.pem ubuntu@123.45.67.89
```

### 查看服务日志

```bash
# 实时查看日志
ssh -i /path/to/server.pem ubuntu@123.45.67.89 'tail -f /home/ubuntu/arktab/server.log'

# 查看最后50行
ssh -i /path/to/server.pem ubuntu@123.45.67.89 'tail -n 50 /home/ubuntu/arktab/server.log'
```

### 停止服务

```bash
ssh -i /path/to/server.pem ubuntu@123.45.67.89 'cd /home/ubuntu/arktab && kill $(cat .pid)'
```

### 重启服务

```bash
# 重新执行部署脚本
./deploy.sh 123.45.67.89 ubuntu /path/to/server.pem

# 或手动重启
ssh -i /path/to/server.pem ubuntu@123.45.67.89 'cd /home/ubuntu/arktab && kill $(cat .pid) && nohup npm start > server.log 2>&1 & echo $! > .pid'
```

### 更新代码

```bash
# 直接重新部署即可，脚本会自动备份旧代码
./deploy.sh 123.45.67.89 ubuntu /path/to/server.pem
```

---

## 故障排查

### 问题1: PEM文件权限错误

```
Permissions 0644 for 'server.pem' are too open.
```

**解决方案:**
```bash
chmod 400 /path/to/server.pem
```

### 问题2: 连接超时

```
ssh: connect to host 123.45.67.89 port 22: Connection timed out
```

**可能原因:**
- 服务器IP错误
- 服务器安全组未开放22端口
- 服务器防火墙拦截

**解决方案:**
1. 检查服务器IP是否正确
2. 登录云服务商控制台，确认安全组规则
3. 检查服务器防火墙设置

### 问题3: 服务启动失败

检查日志查看错误信息：
```bash
ssh -i /path/to/server.pem ubuntu@123.45.67.89 'cat /home/ubuntu/arktab/server.log'
```

常见问题：
- Node.js未安装
- 端口3000被占用
- 依赖安装失败

### 问题4: 端口3000无法访问

**检查清单:**
1. 服务是否正在运行
   ```bash
   ssh -i /path/to/server.pem ubuntu@123.45.67.89 'ps aux | grep node'
   ```

2. 端口是否监听
   ```bash
   ssh -i /path/to/server.pem ubuntu@123.45.67.89 'netstat -tlnp | grep 3000'
   ```

3. 安全组是否开放3000端口
   - 登录云服务商控制台检查

4. 防火墙是否允许3000端口
   ```bash
   # Ubuntu
   sudo ufw status
   sudo ufw allow 3000/tcp
   
   # CentOS
   sudo firewall-cmd --list-all
   sudo firewall-cmd --add-port=3000/tcp --permanent
   sudo firewall-cmd --reload
   ```

### 问题5: npm install 失败

```bash
# 清除npm缓存
ssh -i /path/to/server.pem ubuntu@123.45.67.89 'cd /home/ubuntu/arktab && npm cache clean --force'

# 重新安装依赖
ssh -i /path/to/server.pem ubuntu@123.45.67.89 'cd /home/ubuntu/arktab && rm -rf node_modules package-lock.json && npm install'
```

---

## 安全建议

### 1. 使用强密码（如果需要密码登录）

### 2. 配置SSH密钥（已使用PEM文件）

### 3. 限制root登录
```bash
# 编辑SSH配置
sudo nano /etc/ssh/sshd_config

# 设置 PermitRootLogin no
sudo systemctl restart sshd
```

### 4. 配置fail2ban（防止暴力破解）
```bash
sudo apt-get install -y fail2ban
sudo systemctl enable fail2ban
sudo systemctl start fail2ban
```

### 5. 定期更新系统
```bash
sudo apt-get update
sudo apt-get upgrade
```

### 6. 使用HTTPS（生产环境必须）
- 配置SSL证书（推荐Let's Encrypt免费证书）
- 强制HTTPS访问

---

## 性能优化

### 1. 使用PM2集群模式

```bash
# 根据CPU核心数启动多个实例
pm2 start server.js -i max --name arktab
```

### 2. 启用Nginx缓存

### 3. 使用CDN加速静态资源

### 4. 监控服务器性能
- 安装监控工具（如 New Relic、Datadog）
- 定期检查日志

---

## 备份策略

### 备份代码和配置

```bash
# 本地备份
tar -czf arktab-backup-$(date +%Y%m%d).tar.gz server.js package.json public/

# 服务器备份
ssh -i /path/to/server.pem ubuntu@123.45.67.89 'cd /home/ubuntu && tar -czf arktab-backup-$(date +%Y%m%d).tar.gz arktab/'
```

### 定期自动备份

使用cron任务自动备份：

```bash
# 编辑crontab
crontab -e

# 添加每天凌晨2点备份
0 2 * * * tar -czf /backup/arktab-$(date +\%Y\%m\%d).tar.gz /home/ubuntu/arktab/
```

---

## 技术支持

如遇到问题，请检查：
1. 服务器日志：`/home/ubuntu/arktab/server.log`
2. 系统日志：`/var/log/syslog`
3. Nginx日志（如使用）：`/var/log/nginx/`

---

**最后更新:** 2026-03-28