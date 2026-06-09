# AI课题评审台

这是一个按飞书方案重做的评分系统工程雏形：前端页面、后端 API、飞书免登、多维表格读取封装、评分保存和管理汇总都已拆开。

## 目录结构

```text
ai-scoring-system/
├── frontend/        # Web评分页面
├── backend/         # Node.js API服务
└── database/        # MySQL/PostgreSQL建表脚本
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

## 正式接飞书

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
| `GET /api/config` | 获取前端配置 |
| `POST /api/auth/login` | 飞书 code 换用户信息 |
| `GET /api/topics` | 从多个子表获取课题列表 |
| `GET /api/assignments/me` | 按当前用户身份自动生成待评分课题 |
| `POST /api/scores` | 提交评分 |
| `GET /api/admin/summary` | 管理端评分汇总 |
| `POST /api/dev/reset` | Mock模式重置演示数据 |

## 说明

当前后端为了便于本地演示，评分结果保存在 `backend/data/scores.json`。正式环境建议替换为 MySQL 或 PostgreSQL，建表脚本在 `database/` 目录下。
