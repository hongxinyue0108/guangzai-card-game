# 光仔卡牌 H5 小游戏

训练营可部署版本：一个 Node 服务同时提供 H5 前端和后端接口。  
正式多人扫码建议使用 MySQL 存储数据、Redis 做缓存；本地没有数据库环境变量时会使用 `backend/db.json` 兜底。

## 技术结构

- 前端：原生 HTML / CSS / JavaScript
- 后端：Node.js 原生 HTTP 服务
- 数据：MySQL，未配置时使用本地 `backend/db.json`
- 缓存：Redis，可选，用于登录态和排行榜缓存
- 分享：生成二维码海报，二维码指向分享页，进入分享页后记录跳转并给奖励

## 本地运行

```bash
cd guangzai-card-game
npm install
npm start
```

打开：

```text
http://localhost:8787
```

## MySQL + Redis 配置

1. 创建 MySQL 数据库表：

```bash
mysql -u root -p < mysql-schema.sql
```

2. 创建 `.env`：

```bash
cp .env.example .env
```

3. 填入：

```env
HOST=0.0.0.0
PORT=8787
PUBLIC_BASE_URL=http://你的服务器公网IP:8787

MYSQL_HOST=127.0.0.1
MYSQL_PORT=3306
MYSQL_USER=guangzai
MYSQL_PASSWORD=你的数据库密码
MYSQL_DATABASE=guangzai_card_game

REDIS_URL=redis://127.0.0.1:6379
```

注意：`.env` 不要提交到 Gitee 或 GitHub。

只要 `.env` 里配置了 `MYSQL_HOST`、`MYSQL_USER`、`MYSQL_DATABASE`，后端就会使用 MySQL；没有配置 MySQL 时才会退回本地 `db.json`。

## 腾讯云部署思路

服务器安装 Node.js 后：

```bash
git clone 你的Gitee仓库地址
cd guangzai-card-game
cp .env.example .env
nano .env
npm install
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
