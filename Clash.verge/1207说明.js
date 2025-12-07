// clash nyanpasu 需要更换函数声明为 export default function (params) {
function main(params) {

  // === 1. 常量定义 ===
  const ICON_BASE = "https://fastly.jsdelivr.net/gh/Koolson/Qure/IconSet/Color/";
  
  // 排除关键词（垃圾节点过滤）
  const excludeRegex = /(自动|故障|流量|官网|套餐|机场|订阅|年|月|失联|频道|重置|到期|通知)/;

  // === 2. 核心逻辑 ===

  // 获取所有“干净”的节点名称
  const allProxies = params.proxies
    .filter(p => !excludeRegex.test(p.name))
    .map(p => p.name);

  // 记录已经被分配到具体国家组的节点
  const usedProxies = new Set();

  // 定义区域
  const regions = [
    { name: "HongKong", regex: /香港|HK|Hong|🇭🇰/, icon: "Hong_Kong.png" },
    { name: "TaiWan", regex: /台湾|TW|Taiwan|Wan|🇹🇼/, icon: "Taiwan.png" },
    { name: "Singapore", regex: /新加坡|狮城|SG|Singapore|🇸🇬/, icon: "Singapore.png" },
    { name: "Japan", regex: /日本|JP|Japan|🇯🇵/, icon: "Japan.png" },
    { name: "America", regex: /美国|US|United\s*States|America|🇺🇸/, icon: "United_States.png" },
    { name: "Korea", regex: /韩国|KR|Korea|🇰🇷/, icon: "Korea.png" } 
  ];

  // === 工具函数 (修复了图标拼接逻辑) ===
  function createProxyGroup(name, type, icon, proxies) {
    const safeProxies = proxies.length > 0 ? proxies : ["DIRECT"];
    
    const base = {
      name,
      type,
      url: "http://www.gstatic.com/generate_204",
      icon: ICON_BASE + icon, // 🔧 修复点：这里加回了 ICON_BASE
      interval: 300,
      lazy: true,
      proxies: safeProxies
    };

    if (type === "url-test") {
      base.tolerance = 20;
      base.timeout = 2000;
    } else if (type === "load-balance") {
      base.strategy = "consistent-hashing";
    }

    return base;
  }

  // 创建国家分组
  const regionGroups = regions.map(r => {
    const groupProxies = allProxies.filter(name => r.regex.test(name));
    groupProxies.forEach(name => usedProxies.add(name));
    return createProxyGroup(r.name, "url-test", r.icon, groupProxies);
  });

  // 计算 Others 分组
  const otherProxies = allProxies.filter(name => !usedProxies.has(name));
  const othersGroup = createProxyGroup("Others", "select", "World_Map.png", otherProxies);

  // 汇总所有动态节点
  const allDynamicProxies = [...new Set([...usedProxies, ...otherProxies])];

  // 创建通用策略组
  const strategyGroups = [
    createProxyGroup("Auto", "url-test", "Auto.png", allDynamicProxies),
    createProxyGroup("Balance", "load-balance", "Available.png", allDynamicProxies),
    createProxyGroup("Fallback", "fallback", "Bypass.png", allDynamicProxies)
  ];

  // === 3. 预定义功能组 ===
  const standardOptions = ["Proxy", "Auto", "Balance", "Fallback"];
  const regionNames = [...regions.map(r => r.name), "Others"];

  const predefinedGroups = [
    { name: "Final", type: "select", proxies: ["DIRECT", "Global", "Proxy"], icon: "Final.png" },
    { name: "Proxy", type: "select", proxies: allDynamicProxies.length ? allDynamicProxies : ["DIRECT"], icon: "Proxy.png" },
    { name: "Global", type: "select", proxies: [...standardOptions, ...regionNames], icon: "Global.png" },
    { name: "Mainland", type: "select", proxies: ["DIRECT", "Proxy", "Auto"], icon: "Direct.png" },
    { name: "AI", type: "select", proxies: ["Proxy", "America", "Japan", "Singapore", "TaiWan", ...regionNames], icon: "AI.png" },
    { name: "YouTube", type: "select", proxies: ["Proxy", ...standardOptions, ...regionNames], icon: "YouTube.png" },
    { name: "BiliBili", type: "select", proxies: ["DIRECT", "HongKong", "TaiWan"], icon: "bilibili.png" },
    { name: "Streaming", type: "select", proxies: ["Proxy", ...standardOptions, ...regionNames], icon: "ForeignMedia.png" },
    { name: "Telegram", type: "select", proxies: ["Proxy", ...standardOptions, ...regionNames], icon: "Telegram.png" },
    { name: "Google", type: "select", proxies: ["Proxy", ...standardOptions, ...regionNames], icon: "Google.png" },
    { name: "Games", type: "select", proxies: ["Proxy", ...standardOptions, ...regionNames], icon: "Game.png" }
  ].map(g => {
    g.icon = ICON_BASE + g.icon;
    g.proxies = [...new Set(g.proxies)]; 
    return g;
  });

  // 写入代理组
  params["proxy-groups"] = [
    ...predefinedGroups,
    ...regionGroups,
    othersGroup,
    ...strategyGroups
  ];

  // === 4. 规则集 ===
  params.rules = [
    // --- 拦截与直连 ---
    "AND,(AND,(DST-PORT,443),(NETWORK,UDP)),(NOT,((GEOIP,CN,no-resolve))),REJECT", // QUIC 阻断
    "GEOSITE,Private,DIRECT",
    "GEOSITE,Category-games@cn,Mainland",
    "GEOSITE,CN,Mainland",
    "GEOIP,CN,Mainland,no-resolve",
    // --- AI 服务 ---
    "GEOSITE,category-ai-!cn,AI", // 包含 ChatGPT, Gemini 等
    "DOMAIN-KEYWORD,dreamina,America",
    // --- 特定服务 ---
    "GEOSITE,Github,Global",
    "GEOIP,Telegram,Telegram,no-resolve",
    // --- 视频流媒体 ---
    "GEOSITE,Bilibili,BiliBili",
    "GEOSITE,Youtube,YouTube",
    "GEOSITE,Disney,Streaming",
    "GEOSITE,Netflix,Streaming",
    "GEOSITE,HBO,Streaming",
    "GEOSITE,Primevideo,Streaming",
    // --- 常用大厂 ---
    "GEOSITE,Google,Google",
    "GEOSITE,Microsoft@cn,Mainland",
    "GEOSITE,Apple@cn,Mainland",
    "GEOSITE,Geolocation-!cn,Global",
    // --- 兜底 ---
    "MATCH,Final"
  ];

  return params;
}