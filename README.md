# Pantyhose — GitHub Pages

这是一个无需构建步骤的静态 Three.js 页面。模型、动画、贴图和 Three.js 模块都放在本仓库中，页面通过相对路径加载资源。

## 发布到 GitHub Pages

1. 在 GitHub 创建名为 `pantyhose` 的仓库。
2. 将本文件夹中的**全部内容**放到仓库根目录并推送到 `main` 分支。只上传 ZIP 文件不会发布网站。
3. 打开仓库 **Settings → Pages**。
4. 在 **Build and deployment** 中选择 **Deploy from a branch**，分支选 `main`，目录选 `/(root)`，点击 **Save**。
5. 部署完成后，项目页地址通常是 `https://<你的 GitHub 用户名>.github.io/pantyhose/`。

如从仓库根目录访问，`index.html` 会自动作为网站入口。
