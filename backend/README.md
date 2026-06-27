# 光仔卡牌后端

Node.js 原生 HTTP 后端，同时托管 `frontend/` 静态文件。

## 运行

在项目根目录执行：

```bash
npm start
```

默认地址：

```text
http://localhost:8787
```

## 主要接口

- `POST /api/register` 注册
- `POST /api/login` 登录
- `GET /api/profile` 用户资料
- `POST /api/draw` 抽卡
- `POST /api/exchange` 碎片兑换
- `POST /api/share/create` 创建分享
- `POST /api/share/visit` 分享页访问，检测到跳转后给分享者奖励
- `GET /api/ranking` 排行榜
- `GET /api/stats` 数据统计
- `GET /api/users` 查看所有玩家与抽卡记录
