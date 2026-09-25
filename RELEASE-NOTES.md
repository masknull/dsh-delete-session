# dsh-delete-session v0.1.2

修复部分已知问题

- 修复「删除会话」入口消失：0.1.7 起官方侧边栏把会话行的重命名 prop 改名为 onRenameRequest，插件的归属判定仍只认 onRename，匹配不上即按设计静默不注入。现在两个名字都认。
- 修复确认弹窗文字发灰：0.1.7-rc.2 把菜单表面色改为 58% 不透明的毛玻璃填充（需配合 ackdrop-filter 才可读），弹窗只借了底色没有借滤镜。改为与宿主 Modal 相同的配方——不透明 g-layer-2 + elevation-prominent + adius-panel。

宿主要求：DSH ≥ 0.1.7-rc.1（不再支持 0.1.5）。
