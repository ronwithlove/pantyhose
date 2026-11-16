const messages = {
  zh: {
    tearAppearanceTitle: '洞边与抽丝调节', resetTearAppearance: '恢复这组默认值', tearAppearanceValues: '参数记录（选中复制发给我）', rimDarkness: '洞边深浅', rimWidth: '洞边宽度', rimRelief: '洞边凹凸', warpStrength: '纵丝强度', weftStrength: '横丝强度', warpDensity: '纵丝密度', weftDensity: '横丝密度', yarnThickness: '纱线粗细', yarnBend: '纱线弯曲', yarnGloss: '纱线反光',
    pageTitle: '织物实验室 · Fabric study', stageLabel: '可拖拽的三维弹性织物', brand: 'MATTER<span> / </span>织物实验室', live: 'THREE.JS 实时渲染', heroTitle: '丝袜，<br>随形而动。', heroDescription: '贴合腿脚，跟随动作。<br>拖拽感受局部张力与回弹。',
    fabricTab: '织物', lightsTab: '灯光', panelOpen: '展开控制面板', panelClose: '收起控制面板', musicPlay: '播放背景音乐', musicPause: '暂停背景音乐',
    idleLoading: 'Idle 动画加载中', idleUnavailable: '无 Idle 动画', idlePause: '暂停 Idle 动画', idlePlay: '播放 Idle 动画', stockingsHide: '隐藏丝袜 · 裸腿对照', stockingsShow: '显示丝袜',
    opacity: '织物密度', tightness: '贴身紧度', tightnessHint: '0% 宽松 → 100% 贴身；膝踝余量堆褶，调高后收紧', elasticity: '延展弹性', elasticityHint: '低：紧实、拉不远；高：柔软、可拉更远', stiffness: '回弹速度', damping: '回弹阻尼', dampingHint: '低：弹跳、余振多；高：回位平稳、余振少', influence: '拉伸影响范围', influenceHint: '小范围更贴腿，大范围带动更多织物', reflection: '反光强度', reflectionTitle: '100% 为原效果；0% 关闭织物高光', sparkle: '纤维闪点', sparkleTitle: '降低后反光更均匀；100% 为原纤维闪点',
    fabricColor: '织物颜色', pearl: '珍珠灰', ink: '墨黑', rose: '烟粉', auto: '自动演示', wire: '查看网格', damage: '拉伸撕裂', tearStrength: '耐撕程度', repair: '恢复完整', damageHint: '用力拉到极限会撕裂；低耐撕更易破，高耐撕更结实。', reset: '重置视角与织物',
    lightSelect: '选择灯光', keyLight: '主光 · 暖白（投射阴影）', rimLight: '轮廓光 · 冷白', fillLight: '补光 · 柔白', lightColor: '灯光颜色', lightPower: '灯光强度', lightX: '左右 X', lightY: '高度 Y', lightZ: '前后 Z', moveLights: '在场景中移动灯光', lightHint: '拖动彩色球移动灯光；按住右键可旋转视角。用 X / Y / Z 精确定位。平行光的位置改变照射方向，距离不影响亮度。', environment: '环境与织物反射', ambientColor: '环境上方颜色', ambientPower: '环境照明', environmentPower: '织物环境反射', environmentHint: '反射棚景独立于三盏灯；关闭灯光后，仍可能看到环境反射。', resetLights: '恢复原灯光',
    viewFront: '正面', viewSide: '侧面', viewLegs: '腿脚特写', statusLoading: '角色与丝袜加载中', statusBare: '裸腿对照 · 右键旋转视角', statusAuto: '自动拉伸中 · 拖拽可接管', statusReady: '拖拽丝袜拉伸 · 右键旋转视角 · 松手回弹', statusDragging: '正在拉伸 · 松开后回弹',
    noticeLoading: '角色与丝袜加载中。', noticeReady: '左键拖拽丝袜；按住右键旋转。', noticeBare: '裸腿对照。点击显示丝袜可恢复织物控制。', damageDone: '已拉破：抓取松脱，洞边纱线和抽丝保留。可继续拉其他位置或恢复完整。', damageHintText: '用力拉到极限会撕裂；低耐撕更易破，高耐撕更结实。', tightnessAdjusting: '调整中', tightnessFailure: '本次调整未完成，请重试。', errorWebGL: '无法启动 WebGL。请用支持硬件加速的现代浏览器打开此演示。', errorModel: '角色或丝袜加载失败。请检查本地模型与贴图资源后刷新页面。', errorStatus: '角色或丝袜加载失败', colorName: '墨黑',
  },
  en: {
    tearAppearanceTitle: 'Tear edges and yarns', resetTearAppearance: 'Reset these values', tearAppearanceValues: 'Settings (select and copy to share)', rimDarkness: 'Edge darkness', rimWidth: 'Edge width', rimRelief: 'Edge relief', warpStrength: 'Vertical yarn strength', weftStrength: 'Cross yarn strength', warpDensity: 'Vertical yarn density', weftDensity: 'Cross yarn density', yarnThickness: 'Yarn thickness', yarnBend: 'Yarn curvature', yarnGloss: 'Yarn sheen',
    pageTitle: 'Fabric Study · MATTER', stageLabel: 'Interactive 3D elastic fabric', brand: 'MATTER<span> / </span>Fabric Study', live: 'THREE.JS REALTIME', heroTitle: 'Nylon,<br>in motion.', heroDescription: 'Fitted to the legs and moving with them.<br>Drag to feel local tension and rebound.',
    fabricTab: 'Fabric', lightsTab: 'Lighting', panelOpen: 'Open controls', panelClose: 'Close controls', musicPlay: 'Play background music', musicPause: 'Pause background music',
    idleLoading: 'Loading Idle animation', idleUnavailable: 'No Idle animation', idlePause: 'Pause Idle animation', idlePlay: 'Play Idle animation', stockingsHide: 'Hide stockings · bare-leg view', stockingsShow: 'Show stockings',
    opacity: 'Fabric density', tightness: 'Fit', tightnessHint: '0% loose → 100% fitted; increase to reduce folds at knees and ankles', elasticity: 'Stretch', elasticityHint: 'Low: firm, shorter pull; high: softer, stretches farther', stiffness: 'Recovery speed', damping: 'Recovery damping', dampingHint: 'Low: more bounce; high: steadier return', influence: 'Stretch influence', influenceHint: 'A smaller area hugs the leg; a larger area moves more fabric', reflection: 'Reflection strength', reflectionTitle: '100% is the original look; 0% disables fabric highlights', sparkle: 'Fiber sparkle', sparkleTitle: 'Lower values even out reflections; 100% keeps the original fiber sparkle',
    fabricColor: 'Fabric color', pearl: 'Pearl gray', ink: 'Ink black', rose: 'Dusty rose', auto: 'Auto demo', wire: 'Show mesh', damage: 'Tear on stretch', tearStrength: 'Tear resistance', repair: 'Restore fabric', damageHint: 'Pull far enough to rupture. Lower resistance tears more easily.', reset: 'Reset view and fabric',
    lightSelect: 'Select light', keyLight: 'Key · warm white (casts shadows)', rimLight: 'Rim · cool white', fillLight: 'Fill · soft white', lightColor: 'Light color', lightPower: 'Light intensity', lightX: 'Left / right X', lightY: 'Height Y', lightZ: 'Depth Z', moveLights: 'Move lights in scene', lightHint: 'Drag a colored marker to move a light; hold right mouse to rotate the view. Set precise positions with X / Y / Z. Directional-light position changes its direction, not its brightness.', environment: 'Environment and fabric reflections', ambientColor: 'Environment top color', ambientPower: 'Ambient light', environmentPower: 'Fabric environment reflection', environmentHint: 'The reflection studio is separate from the three lights, so reflections may remain when lights are off.', resetLights: 'Restore default lighting',
    viewFront: 'Front', viewSide: 'Side', viewLegs: 'Leg detail', statusLoading: 'Loading character and stockings', statusBare: 'Bare-leg view · right mouse rotates', statusAuto: 'Auto stretch · drag to take over', statusReady: 'Drag the stockings to stretch · right mouse rotates · release to rebound', statusDragging: 'Stretching · release to rebound',
    noticeLoading: 'Loading character and stockings.', noticeReady: 'Drag the stockings with the left mouse; hold the right mouse to rotate.', noticeBare: 'Bare-leg view. Show the stockings to restore fabric controls.', damageDone: 'Fabric ruptured and released. Frayed edges and runs remain; pull another spot or restore fabric.', damageHintText: 'Pull far enough to rupture. Lower resistance tears more easily.', tightnessAdjusting: 'Adjusting', tightnessFailure: 'That adjustment did not finish. Please try again.', errorWebGL: 'WebGL could not start. Open this demo in a modern browser with hardware acceleration.', errorModel: 'The character or stockings failed to load. Check the model and texture assets, then refresh.', errorStatus: 'Character or stockings failed to load', colorName: 'Ink black',
  },
  ja: {
    tearAppearanceTitle: '破れの縁と伝線', resetTearAppearance: 'この設定をリセット', tearAppearanceValues: '設定（選択してコピー）', rimDarkness: '縁の濃さ', rimWidth: '縁の幅', rimRelief: '縁の凹凸', warpStrength: '縦糸の強さ', weftStrength: '横糸の強さ', warpDensity: '縦糸の密度', weftDensity: '横糸の密度', yarnThickness: '糸の太さ', yarnBend: '糸の湾曲', yarnGloss: '糸の光沢',
    pageTitle: 'ファブリックスタディ · MATTER', stageLabel: 'ドラッグ操作できる3D伸縮ファブリック', brand: 'MATTER<span> / </span>ファブリックスタディ', live: 'THREE.JS リアルタイム描画', heroTitle: 'ナイロン、<br>動きに沿って。', heroDescription: '脚にフィットし、動きに追従。<br>ドラッグして張りと戻りを体感できます。',
    fabricTab: 'ファブリック', lightsTab: '照明', panelOpen: '操作パネルを開く', panelClose: '操作パネルを閉じる', musicPlay: 'BGMを再生', musicPause: 'BGMを一時停止',
    idleLoading: 'Idle アニメーションを読み込み中', idleUnavailable: 'Idle アニメーションなし', idlePause: 'Idle アニメーションを一時停止', idlePlay: 'Idle アニメーションを再生', stockingsHide: 'ストッキングを隠す · 素足表示', stockingsShow: 'ストッキングを表示',
    opacity: '生地の密度', tightness: 'フィット感', tightnessHint: '0% ゆったり → 100% フィット。値を上げると膝や足首のたるみが減ります', elasticity: '伸縮性', elasticityHint: '低：硬く伸びにくい／高：柔らかく遠くまで伸びる', stiffness: '戻りの速さ', damping: '戻りの減衰', dampingHint: '低：弾みが多い／高：安定して戻る', influence: '伸縮の影響範囲', influenceHint: '範囲が小さいと脚に密着し、大きいと広い生地が動きます', reflection: '反射の強さ', reflectionTitle: '100% は元の見た目、0% で生地のハイライトを無効化', sparkle: '繊維のきらめき', sparkleTitle: '値を下げると反射が均一になります。100% は元のきらめきです',
    fabricColor: '生地の色', pearl: 'パールグレー', ink: 'インクブラック', rose: 'ダスティローズ', auto: '自動デモ', wire: 'メッシュ表示', damage: '引っ張って破る', tearStrength: '破れにくさ', repair: '生地を修復', damageHint: '強く引くと破れます。値を下げると破れやすくなります。', reset: '視点と生地をリセット',
    lightSelect: '照明を選択', keyLight: 'キーライト · 暖色（影あり）', rimLight: 'リムライト · 寒色', fillLight: 'フィルライト · ソフト', lightColor: 'ライトの色', lightPower: 'ライトの強さ', lightX: '左右 X', lightY: '高さ Y', lightZ: '奥行き Z', moveLights: 'シーン内でライトを移動', lightHint: '色付きマーカーをドラッグしてライトを移動します。右ボタンを押しながら視点を回転できます。X / Y / Z で位置を指定します。平行光は位置で照射方向が変わり、距離では明るさは変わりません。', environment: '環境光と生地の反射', ambientColor: '環境上部の色', ambientPower: '環境光', environmentPower: '生地の環境反射', environmentHint: '反射用スタジオは3つのライトとは別です。ライトを消しても環境反射が見える場合があります。', resetLights: '照明を初期状態に戻す',
    viewFront: '正面', viewSide: '側面', viewLegs: '脚部拡大', statusLoading: 'モデルとストッキングを読み込み中', statusBare: '素足表示 · 右ボタンで回転', statusAuto: '自動伸縮中 · ドラッグで操作', statusReady: 'ストッキングをドラッグして伸縮 · 右ボタンで回転 · 離すと戻ります', statusDragging: '伸縮中 · 離すと戻ります',
    noticeLoading: 'モデルとストッキングを読み込み中。', noticeReady: '左ボタンでストッキングをドラッグし、右ボタンを押したまま視点を回転します。', noticeBare: '素足表示です。ストッキングを表示すると生地の操作に戻ります。', damageDone: '生地が破れて手を離れました。ほつれと伝線が残ります。別の場所を引くか修復できます。', damageHintText: '強く引くと破れます。値を下げると破れやすくなります。', tightnessAdjusting: '調整中', tightnessFailure: '調整が完了しませんでした。もう一度お試しください。', errorWebGL: 'WebGLを起動できません。ハードウェアアクセラレーション対応の最新ブラウザーで開いてください。', errorModel: 'モデルまたはストッキングを読み込めませんでした。モデルとテクスチャを確認して再読み込みしてください。', errorStatus: 'モデルまたはストッキングを読み込めませんでした', colorName: 'インクブラック',
  },
};

export const dictionaries = messages;

export function selectLanguage(preferences = globalThis.navigator?.languages ?? [globalThis.navigator?.language ?? '']) {
  for (const preference of preferences) {
    const code = String(preference).toLowerCase().split(/[-_]/)[0];
    if (code === 'zh' || code === 'ja' || code === 'en') return code;
  }
  return 'en';
}

export const language = selectLanguage();
export const t = key => messages[language][key] ?? messages.en[key] ?? key;

export function localizeStaticUi() {
  document.documentElement.lang = language === 'zh' ? 'zh-CN' : language;
  const title = document.querySelector('title');
  if (title) title.textContent = t('pageTitle');
  for (const element of document.querySelectorAll('[data-i18n]')) {
    const value = t(element.dataset.i18n);
    if (element.dataset.i18nHtml !== undefined) {
      element.innerHTML = value;
      continue;
    }
    const textNode = [...element.childNodes].find(node => node.nodeType === Node.TEXT_NODE && node.textContent.trim());
    if (textNode) textNode.textContent = value;
    else element.textContent = value;
  }
  for (const element of document.querySelectorAll('[data-i18n-aria]')) element.setAttribute('aria-label', t(element.dataset.i18nAria));
  for (const element of document.querySelectorAll('[data-i18n-title]')) element.title = t(element.dataset.i18nTitle);
}
