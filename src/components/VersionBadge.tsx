import React from 'react';

function formatBuildTime(): string {
  const buildTime = import.meta.env.VITE_APP_BUILD_TIME;
  
  if (!buildTime) {
    // 빌드 시간이 정의되지 않은 경우 (예: 개발 환경)
    return 'local';
  }

  try {
    const date = new Date(buildTime);
    
    // KST (UTC+9)로 시간 조정
    const kstOffset = 9 * 60 * 60 * 1000;
    const kstDate = new Date(date.getTime() + kstOffset);

    const month = (kstDate.getUTCMonth() + 1).toString().padStart(2, '0');
    const day = kstDate.getUTCDate().toString().padStart(2, '0');
    const hours = kstDate.getUTCHours().toString().padStart(2, '0');
    const minutes = kstDate.getUTCMinutes().toString().padStart(2, '0');

    return `v${month}-${day}-${hours}:${minutes}`;
  } catch (error) {
    console.error("Error formatting build time:", error);
    return 'unknown';
  }
}

export default function VersionBadge() {
  const version = formatBuildTime();

  return (
    <div className="fixed bottom-2 right-3 z-[9999]">
      <span className="select-none text-[10px] px-2 py-1 rounded-full bg-black/70 text-white tracking-wider">
        {version}
      </span>
    </div>
  );
}
