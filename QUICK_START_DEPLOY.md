# 快速部署指南

一分钟快速部署Arktab后端服务到服务器。

## 🚀 快速部署（三步走）

### 步骤1: 准备PEM文件

```bash
# 设置PEM文件权限
chmod 400 /path/to/your-server.pem
```

### 步骤2: 测试连接

```bash
# 替换为你的服务器IP和用户名
ssh -i /path/to/your-server.pem ubuntu@123.45.67.89
```

### 步骤3: 执行部署

```bash
# 在项目根目录执行（替换为你的服务器信息）
./deploy.sh 123.45.67.89 ubuntu /path/to/your-server.pem
```

## ✅ 验证部署

部署完成后，访问以下地址验证服务是否正常运行：

```bash
# 方式1: 使用curl
curl http://123.45.67.89:3000

# 方式2: 浏览器访问
# http://123.45.67.89:3000
```

## 📋 部署前检查清单

- [ ] 服务器IP地址正确
- [ ] 服务器用户名正确（ubuntu/ec2-user/root）
- [ ] PEM文件路径正确
- [ ] 服务器安全组已开放22端口
- [ ] 服务器安全组已开放3000端口
- [ ] 服务器已安装Node.js（如未安装，部署脚本会提示）

## 📝 常用命令

```bash
# 查看服务日志
ssh -i /path/to/server.pem ubuntu@123.45.67.89 'tail -f /home/ubuntu/arktab/server.log'

# 停止服务
ssh -i /path/to/server.pem ubuntu@123.45.67.89 'cd /home/ubuntu/arktab && kill $(cat .pid)'

# 重新部署（更新代码）
./deploy.sh 123.45.67.89 ubuntu /path/to/your-server.pem
```

## ❓ 常见问题

### 问题1: 权限错误
```
Permissions 0644 for 'server.pem' are too open.
```
**解决:** `chmod 400 /path/to/server.pem`

### 问题2: 连接超时
```
Connection timed out
```
**解决:** 检查服务器安全组是否开放22端口

### 问题3: 端口3000无法访问
**解决:** 检查服务器安全组是否开放3000端口

## 📚 详细文档

需要更详细的部署说明？请查看 [DEPLOYMENT.md](DEPLOYMENT.md)

---

**提示:** 首次部署建议先阅读完整的 [DEPLOYMENT.md](DEPLOYMENT.md) 文档