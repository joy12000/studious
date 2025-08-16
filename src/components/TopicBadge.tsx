import React from 'react';

interface TopicBadgeProps {
  topic: string;
  variant?: 'default' | 'selected' | 'small';
  onClick?: () => void;
}

const topicColors: Record<string, string> = {
  Productivity: 'bg-blue-100 text-blue-800 border-blue-200',
  Learning: 'bg-green-100 text-green-800 border-green-200',
  Mindset: 'bg-purple-100 text-purple-800 border-purple-200',
  Health: 'bg-pink-100 text-pink-800 border-pink-200',
  Fitness: 'bg-orange-100 text-orange-800 border-orange-200',
  Finance: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  Career: 'bg-indigo-100 text-indigo-800 border-indigo-200',
  Tech: 'bg-gray-100 text-gray-800 border-gray-200',
  Relationships: 'bg-red-100 text-red-800 border-red-200',
  Creativity: 'bg-teal-100 text-teal-800 border-teal-200',
  Other: 'bg-slate-100 text-slate-800 border-slate-200'
};

export default function TopicBadge({ topic, variant = 'default', onClick }: TopicBadgeProps) {
  const baseClasses = 'inline-flex items-center border font-medium rounded-full transition-all duration-200';
  const sizeClasses = variant === 'small' ? 'px-2 py-1 text-xs' : 'px-3 py-1 text-sm';
  const colorClasses = topicColors[topic] || topicColors['Other'];
  
  const selectedClasses = variant === 'selected' 
    ? 'ring-2 ring-blue-500 ring-opacity-50 transform scale-105'
    : '';
  
  const hoverClasses = onClick ? 'cursor-pointer hover:scale-105 hover:shadow-sm' : '';

  return (
    <span
      className={`${baseClasses} ${sizeClasses} ${colorClasses} ${selectedClasses} ${hoverClasses}`}
      onClick={onClick}
    >
      {topic}
    </span>
  );
}