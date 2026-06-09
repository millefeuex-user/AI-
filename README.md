# AI课题评审台

这是一个按飞书方案重做的评分系统：前端评分页面、后端 API、飞书 OAuth 登录、多维表格读取、评分保存和管理汇总都已拆开。当前代码支持本地/ngrok 测试，也支持 GitLab + 公司内部服务器部署。

## 目录结构

```text
ai-scoring-system/
├── frontend/        # Web评分页面
├── backend/         # Node.js API服务
├── database/        # MySQL/PostgreSQL建表脚本
├── Dockerfile       # 可选：容器部署
└── .gitlab-ci.example.yml # 可选：GitLab CI部署模板
```

## 本地运行

```bash
cd outputs/ai-scoring-system
npm run dev
```

默认是 `MOCK_MODE=true`，不需要飞书 App ID，也不需要真实多维表格。

打开：

```text
http://127.0.0.1:5173
```

## GitLab + 公司服务器部署

推荐正式环境使用公司内部服务器，而不是 ngrok。服务器只要能跑 Node.js 18+，并能访问飞书开放平台即可。

### 服务器要求

- Node.js 18+，或 Docker；
- 可访问 `https://open.feishu.cn` 和 `https://accounts.feishu.cn`；
- 有稳定 HTTPS 域名，例如 `https://ai-score.example.com`；
- Nginx/Caddy 反向代理到本服务端口；
- 环境变量由服务器或 GitLab CI/CD Variables 管理，不写进仓库。

### 生产环境变量

复制 `.env.example` 到服务器环境变量配置中，至少配置：

```bash
NODE_ENV=production
HOST=127.0.0.1
PORT=5173
MOCK_MODE=false
SESSION_SECRET=replace_with_a_stable_random_secret
COOKIE_SECURE=true

FEISHU_APP_ID=cli_xxx
FEISHU_APP_SECRET=xxx
FEISHU_REDIRECT_URI=https://ai-score.example.com/auth/callback

FEISHU_WIKI_TOKEN=wikcnxxx
FEISHU_TABLE_LEADER=tblxxx
FEISHU_TABLE_TEAM=tblxxx
FEISHU_TABLE_TD=tblxxx
FEISHU_TABLE_PX_GP=tblxxx
FEISHU_TABLE_SG=tblxxx
FEISHU_TABLE_FI_RA=tblxxx
FEISHU_TABLE_PD_UX=tblxxx
FEISHU_TABLE_OC=tblxxx
FEISHU_TABLE_FC=tblxxx
FEISHU_TABLE_HR_AD_MUXI=tblxxx
FEISHU_RESULT_TABLE_ID=tblxxx
```

`SESSION_SECRET` 必须长期固定，服务重启后用户登录态才稳定。可以这样生成：

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### Node 常驻部署

```bash
git clone <your-gitlab-repo-url>
cd ai-scoring-system
npm run check
NODE_ENV=production MOCK_MODE=false HOST=127.0.0.1 PORT=5173 node backend/server.js
```

建议用 `pm2` 或系统服务托管：

```bash
pm2 start backend/server.js --name ai-scoring-system
pm2 save
```

### Docker 部署

```bash
docker build -t ai-scoring-system .
docker run -d --name ai-scoring-system --env-file .env -p 127.0.0.1:5173:5173 ai-scoring-system
```

### Nginx 反向代理示例

```nginx
server {
    listen 443 ssl;
    server_name ai-score.example.com;

    location / {
        proxy_pass http://127.0.0.1:5173;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-Host $host;
        proxy_set_header X-Forwarded-Proto https;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

部署后可访问：

```text
https://ai-score.example.com/api/health
```

返回 `{"ok":true,...}` 即服务正常。

### 飞书后台配置

部署到正式域名后，在飞书开放平台配置一次即可：

```text
重定向 URL:
https://ai-score.example.com/auth/callback

H5 可信域名:
https://ai-score.example.com
```

后续代码更新、GitLab 部署、服务重启，都不需要重新配置飞书后台。只有域名变化时才需要重新改。

## 飞书接入

1. 在飞书开放平台创建自建应用。
2. 配置网页应用地址，例如：

```text
https://your-domain.com
```

3. 申请权限：
   - 获取用户身份；
   - 读取多维表格；
   - 如需回写，再申请更新多维表格；
   - 如需部门信息，再申请通讯录相关权限。

4. 将自建应用加入目标多维表格协作者。
5. 配置环境变量：

```bash
export MOCK_MODE=false
export FEISHU_APP_ID=cli_xxx
export FEISHU_APP_SECRET=xxx
export FEISHU_REDIRECT_URI=https://your-domain.com/auth/callback
export FEISHU_WIKI_TOKEN=wikcnxxx

export FEISHU_TABLE_LEADER=tblxxx
export FEISHU_TABLE_TEAM=tblxxx
export FEISHU_TABLE_TD=tblxxx
export FEISHU_TABLE_PX_GP=tblxxx
export FEISHU_TABLE_SG=tblxxx
export FEISHU_TABLE_FI_RA=tblxxx
export FEISHU_TABLE_PD_UX=tblxxx
export FEISHU_TABLE_OC=tblxxx
export FEISHU_TABLE_FC=tblxxx
export FEISHU_TABLE_HR_AD_MUXI=tblxxx
```

`FEISHU_WIKI_TOKEN` 用于从 wiki 链接自动解析真实多维表格 `app_token`。如果已经有真实 `app_token`，也可以直接配置 `FEISHU_APP_TOKEN`。

## 飞书多维表格建议字段

当前版本不再依赖单独的“评委关系表”。系统会读取多个课题子表，并根据当前登录人姓名、组内成员、负责人关系和班委名单自动生成待评分任务。

### 多个课题子表

建议按现有飞书表结构配置这些子表：

| 子表 | 类型 | 评分规则 |
|---|---|---|
| Leader组 | Leader组 | 组内互评50% + 班委评分50% |
| 团队课题 | 团队课题 | 团队负责人互评50% + 班委评分50% |
| TD | 普通个人组 | 组内互评50% + 知行评分50% |
| PX+GP | 普通个人组 | 组内互评50% + 林博评分50% |
| SG | 普通个人组 | 组内互评50% + Louisa、白起评分50% |
| FI+RA | 普通个人组 | 组内互评50% + Louisa、白起评分50% |
| PD+UX | 普通个人组 | 组内互评50% + 萧何、唐举评分50% |
| OC | 普通个人组 | 组内互评50% + 萧何、唐举评分50% |
| FC | 普通个人组 | 组内互评50% + 洪欣、郝里、林博评分50% |
| HR+AD+木夕 | 普通个人组 | 组内互评50% + 洪欣、郝里、林博评分50% |

班委固定为：萧何、罗莹、白起、陶白。班委需要评分 Leader组和团队课题所有项目。

### 子表字段映射

| 字段 | 说明 |
|---|---|
| 负责人 / 项目负责人 / 团队负责人 / 花名 / 提出人 | 项目负责人 |
| 课题名称 / 主题 / 项目名称 | 被评分课题名称 |
| 所在部门 / 部门 / 所属部门 | 部门 |
| 当前痛点/现状 / 当前痛点 / 原流程痛点 / 内容 | 痛点摘要 |
| 预期达成效果 / 预期效果 / 效果说明 | 预期效果 |
| 交付物 / 交付物成果 / 核心交付成果 | 交付物说明 |
| 交付物链接 / 成果介绍 / 材料链接 / 产品链接 / Demo链接 | 材料或产品链接 |

没有负责人或没有课题名称的空行会被自动过滤。

### 原表回写字段

评分提交后，系统会聚合该项目的评分明细，并回写项目所在的原子表。默认识别这些字段；如果表里没有对应列，会自动跳过，不影响提交。

| 字段 | 说明 |
|---|---|
| 互评平均分 | 组内互评分平均值 |
| 负责人平均分 | 普通个人组负责人评分平均值 |
| 班委平均分 | Leader组/团队课题班委评分平均值 |
| 负责人/班委平均分 | 第二评分部分的统一展示字段 |
| 最终总分 | 按50% + 50%计算后的最终分 |
| 最终等级 | A优秀/B良好/C合格/不合格 |
| 已评分人数 | 当前已提交评分数量 |
| 评分状态 | 评分中/已完成 |
| 评分明细 | 每位评分人的分数和评语摘要 |
| 最后评分时间 | 最近一次提交时间 |

## 当前 API

| 接口 | 说明 |
|---|---|
| `GET /api/health` | 服务健康检查 |
| `GET /api/config` | 获取前端配置 |
| `GET /api/auth/me` | 获取当前 session 中的真实飞书用户 |
| `GET /api/auth/feishu/authorize` | 生成飞书 OAuth 授权地址 |
| `POST /api/auth/feishu/callback` | 飞书 code 换 user_access_token 并写入 session |
| `GET /api/topics` | 从多个子表获取课题列表 |
| `GET /api/assignments/me` | 按当前用户身份自动生成待评分课题 |
| `POST /api/scores` | 提交评分 |
| `GET /api/admin/summary` | 管理端评分汇总 |
| `POST /api/dev/reset` | Mock模式重置演示数据 |

## 说明

Mock 模式下评分结果保存在 `backend/data/scores.json`，该文件不建议提交到 Git。正式飞书模式下会优先用 session 中的 `user_access_token` 读取和回写多维表格；如果没有用户授权，默认返回 401，不会自动 fallback 到 `tenant_access_token`。
