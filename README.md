# 📟 btop++ 极客终端主题 (Komari & Cyber Probe)

<p align="center">
  <img src="https://img.shields.io/badge/Theme-btop%2B%2B%20Terminal-cyan?style=flat-square&logo=linux" alt="btop++" />
  <img src="https://img.shields.io/badge/Compatibility-Komari%20%26%20Probe-emerald?style=flat-square" alt="Compatibility" />
  <img src="https://img.shields.io/badge/Version-1.0.0-blue?style=flat-square" alt="Version" />
  <img src="https://img.shields.io/badge/License-MIT-gray?style=flat-square" alt="License" />
</p>

真实还原 Linux 顶级终端监控工具 **btop++** 硬核字符与霓虹点阵风格的监控看板主题，面向 **Komari** 与 **Cyber Probe** 探针系统开发。全等宽字符排版、四象限终端模块布局、高刷新率动态盲文图谱，为您带来沉浸式 TUI 极客运维体验。

---

## 📸 界面预览 (Screenshots)

### 1. 单机拟真终端监控视图 (Single Host Dedicated Monitor)
![btop++ 拟真单机监控](preview.png)

### 2. 多节点集群看板视图 (Fleet Hosts List Overview)
![btop++ 主机集群列表](preview-hosts.png)

---

## ✨ 核心亮点 (Key Features)

- **纯正 btop++ TUI 终端美学**：采用纯直角硬朗形态、全等宽字体与字符边框，原汁原味还原原生 Linux 终端监控交互。
- **高保真动态图谱**：
  - 基于 Unicode Braille（盲文点阵 `⡇⡎⡍⣹⣽⣻⣷⣾⣿`）渲染 CPU 核心波形、内存梯级占用与网卡即时吞吐字符画；
  - 18 格与 10 格分段式霓虹发光量表，多状态高密度实时呈现。
- **三重视图自由穿梭**：
  - `[1] hosts`：集群多节点汇总与实时列表，支持根据地区、状态过滤、实时排序及关键字检索；
  - `[2] monitor`：拟真单机终端监控，包含 CPU 核心群、内存与 Swap 占用、磁盘 I/O、实时上下行网速、三网 Ping 与延迟抖动矩阵、财务到期计费等；
  - `[3] details`：全屏四大诊断象限（系统环境、计费与汇率、网络诊断、磁盘分区与实时曲线）。
- **双色终端外观**：
  - 🌙 **暗色终端（btop++ Dark）**：经典深黑底色配霓虹青绿与暗紫量表；
  - ☀️ **截图浅色（btop++ Light）**：原汁原味还原 btop++ 官方淡灰紫复古终端高亮外观，适合明亮环境与汇报截图。
- **双通道协议自适应**：
  - 接入 **Cyber Probe** 时，自动启用秒级原生高频 WebSocket 数据流；
  - 接入 **Komari 监控** 时，自动无缝适配 `/api/nodes` 与 `/api/clients` 协议。
- **隐私脱敏支持**：右上角提供一键【遮掩 IP / 显示 IP】切换，公开展示无泄露风险。

---

## 🚀 安装与使用 (Installation)

### 方式一：Komari / Probe 管理后台一键上传（推荐）
1. 在 [Releases 页面](https://github.com/wildalley/komari-theme-btop/releases) 下载最新发行版压缩包 `btop-terminal.zip`；
2. 登录您的 Komari 或 Cyber Probe 管理后台（`/admin`）；
3. 进入「主题中心」 $\rightarrow$ 点击「上传本地主题包」 $\rightarrow$ 选择 `btop-terminal.zip`；
4. 点击「设为生效」即可完成安装与切换。

### 方式二：服务器手动解压安装
直接在服务器端将本仓库克隆或解压至主题目录：

```bash
# 进入探针程序所在的主题目录
cd themes

# 下载并解压
wget -O btop-terminal.zip https://github.com/wildalley/komari-theme-btop/releases/download/v1.0.0/btop-terminal.zip
unzip btop-terminal.zip
rm btop-terminal.zip

# 重启探针服务端后，在后台主题中心启用即可
```

---

## ⚙️ 主题设置项 (Configuration)

主题支持在 Komari / Cyber Probe 后台主题设置中进行自定义：

| 配置键名 | 类型 | 默认值 | 说明 |
| :--- | :--- | :--- | :--- |
| `defaultColorMode` | `select` | `dark` | 默认色彩模式：`dark`（经典深色终端）或 `light`（复古浅色终端） |
| `refreshInterval` | `number` | `2` | 数据刷新周期（秒），建议设置为 1 ~ 3 秒 |

---

## 📄 开源许可证 (License)

本项目基于 [MIT License](LICENSE) 开源。欢迎 Star、Fork 与提交 Pull Request！
