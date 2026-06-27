# 光仔卡牌 H5 小游戏

训练营可部署版本：一个 Node 服务同时提供 H5 前端和后端接口。  
本地没有 Supabase 环境变量时会使用 `backend/db.json` 兜底；部署时配置 Supabase 后会写入云数据库。

## 技术结构

- 前端：原生 HTML / CSS / JavaScript
- 后端：Node.js 原生 HTTP 服务
- 数据：Supabase，未配置时使用本地 `backend/db.json`
- 分享：生成二维码海报，二维码指向分享页，进入分享页后记录跳转并给奖励

## 本地运行

```bash
cd guangzai-card-game
npm start
```

打开：

```text
http://localhost:8787
```

## Supabase 配置

1. 在 Supabase 的 SQL Editor 运行：

```text
supabase-schema.sql
```

2. 创建 `.env`：

```bash
cp .env.example .env
```

3. 填入：

```env
SUPABASE_URL=https://你的项目.supabase.co
SUPABASE_SERVICE_ROLE_KEY=你的 secret key
HOST=0.0.0.0
PORT=8787
```

注意：`.env` 不要提交到 Gitee。

## 腾讯云部署思路

服务器安装 Node.js 后：

```bash
git clone 你的Gitee仓库地址
cd guangzai-card-game
cp .env.example .env
nano .env
npm start
```

正式运行建议用 `pm2`：

```bash
npm install -g pm2
pm2 start backend/server.js --name guangzai-card-game
pm2 save
```

## 已实现功能

- 昵称 + 密码注册 / 登录
- 用户 ID 后端自动生成
- 后端保存玩家数据
- 抽卡、重复卡转碎片
- 每一次抽卡写入 `draw_records`
- 卡册展示
- 碎片兑换
- 今日任务
- 系列完成奖励
- 排行榜
- 分享邀请 / 分享排名 / 分享稀有卡
- 二维码海报
- 分享页跳转检测

## 重要说明

二维码里必须放公网可访问的网址。  
本地 `localhost` 只能自己电脑打开，老师转发海报给别人时必须使用腾讯云公网 IP 或域名。
